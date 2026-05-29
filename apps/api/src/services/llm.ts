import OpenAI from 'openai';
import type { ChatMessage } from '@medaccess/shared';
import { HttpError } from '../middleware/error.js';

let _client: OpenAI | null = null;

export function openrouter(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, 'OPENROUTER_API_KEY not configured', {
      code: 'NoProvider',
      publicMessage:
        'No LLM provider configured. Set OPENROUTER_API_KEY in .env at the repo root.',
    });
  }
  _client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost:5173',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'MedAccess AI',
    },
  });
  return _client;
}

export function defaultChatModel(): string {
  return process.env.OPENROUTER_CHAT_MODEL || 'deepseek/deepseek-r1:free';
}

export function defaultStreamModel(): string {
  return process.env.OPENROUTER_STREAM_MODEL
    || process.env.OPENROUTER_FAST_MODEL
    || 'deepseek/deepseek-r1:free';
}

/** Cheap/fast model for triage, symptoms quick-parse, and high-volume calls. */
export function defaultFastModel(): string {
  return process.env.OPENROUTER_FAST_MODEL || 'deepseek/deepseek-chat-v3-0324:free';
}

export function defaultVisionModel(): string {
  return process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.0-flash-exp:free';
}

export interface ChatOptions {
  system?: string;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}

export interface ChatResult {
  text: string;
  model: string;
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const client = openrouter();
  const model = opts.model || defaultChatModel();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
    ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const resp = await client.chat.completions.create({
    model,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1200,
    response_format: opts.json ? { type: 'json_object' } : undefined,
    messages,
  });
  const text = resp.choices?.[0]?.message?.content ?? '';
  return { text, model };
}

export type StreamChunk =
  | { type: 'token'; text: string }
  | { type: 'thinking_start' }
  | { type: 'thinking_end' };

export async function* chatStream(opts: ChatOptions): AsyncGenerator<StreamChunk> {
  const client = openrouter();
  const model = opts.model || defaultStreamModel();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
    ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const stream = await client.chat.completions.create({
    model,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1200,
    stream: true,
    messages,
  });

  // reason: reasoning models surface chain-of-thought in two ways:
  //   1. <think>...</think> tags inside delta.content  (DeepSeek R1 content-mode)
  //   2. delta.reasoning_content field (Qwen3.x, DeepSeek via certain routes)
  // We emit thinking_start/end so the UI shows "Reasoning…" during think phase.
  let inTagThink  = false;  // inside a <think> tag in content
  let inFieldThink = false; // receiving reasoning_content field chunks
  let buf = '';

  for await (const part of stream) {
    const choice = part.choices?.[0];

    // Path A: reasoning_content field (Qwen3, DeepSeek-via-provider field)
    const reasoningDelta: string = (choice?.delta as any)?.reasoning_content ?? '';
    if (reasoningDelta) {
      if (!inFieldThink) { inFieldThink = true; yield { type: 'thinking_start' }; }
      continue; // consume silently
    }

    // If we just finished a reasoning_content phase, close it
    if (inFieldThink) {
      inFieldThink = false;
      yield { type: 'thinking_end' };
    }

    const delta: string = choice?.delta?.content ?? '';
    if (!delta) continue;

    // Path B: <think> tags embedded in content (DeepSeek R1 content-mode)
    if (inTagThink) {
      buf += delta;
      const closeIdx = buf.indexOf('</think>');
      if (closeIdx !== -1) {
        const after = buf.slice(closeIdx + 8);
        buf = '';
        inTagThink = false;
        yield { type: 'thinking_end' };
        if (after) yield { type: 'token', text: after };
      }
    } else {
      const openIdx = delta.indexOf('<think>');
      if (openIdx !== -1) {
        const before = delta.slice(0, openIdx);
        if (before) yield { type: 'token', text: before };
        inTagThink = true;
        buf = delta.slice(openIdx + 7);
        yield { type: 'thinking_start' };
        const closeIdx = buf.indexOf('</think>');
        if (closeIdx !== -1) {
          const after = buf.slice(closeIdx + 8);
          buf = '';
          inTagThink = false;
          yield { type: 'thinking_end' };
          if (after) yield { type: 'token', text: after };
        }
      } else {
        yield { type: 'token', text: delta };
      }
    }
  }
}

// Strict JSON extraction with one repair attempt.
export function safeParseJson<T = unknown>(text: string | undefined | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
