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
  return process.env.OPENROUTER_CHAT_MODEL || 'qwen/qwen3.5-plus-20260420';
}

// reason: reasoning models (qwen3.5-plus, deepseek-r1) hold delta.content null for
// 10-30s during the thinking phase — real-time streaming must use a non-reasoning model.
export function defaultStreamModel(): string {
  return process.env.OPENROUTER_STREAM_MODEL
    || process.env.OPENROUTER_FAST_MODEL
    || 'qwen/qwen3.6-flash';
}

/** Cheap/fast model for triage, symptoms quick-parse, and high-volume calls. */
export function defaultFastModel(): string {
  return process.env.OPENROUTER_FAST_MODEL || 'qwen/qwen3.6-flash';
}

export function defaultVisionModel(): string {
  return process.env.OPENROUTER_VISION_MODEL || 'qwen/qwen3.6-flash';
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

export async function* chatStream(opts: ChatOptions): AsyncGenerator<string> {
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

  // Strip <think>...</think> blocks emitted by Qwen 3.x / DeepSeek R1 reasoning models.
  // These models emit internal chain-of-thought before the actual response; the UI
  // should only show the final answer.
  let inThink = false;
  let thinkBuf = '';

  for await (const part of stream) {
    // reasoning_content is a separate field some providers use — always skip it
    const delta: string = part.choices?.[0]?.delta?.content ?? '';
    if (!delta) continue;

    if (inThink) {
      thinkBuf += delta;
      const end = thinkBuf.indexOf('</think>');
      if (end !== -1) {
        inThink = false;
        const after = thinkBuf.slice(end + 8);
        thinkBuf = '';
        if (after) yield after;
      }
    } else {
      const start = delta.indexOf('<think>');
      if (start !== -1) {
        const before = delta.slice(0, start);
        if (before) yield before;
        inThink = true;
        thinkBuf = delta.slice(start + 7);
        const end = thinkBuf.indexOf('</think>');
        if (end !== -1) {
          inThink = false;
          const after = thinkBuf.slice(end + 8);
          thinkBuf = '';
          if (after) yield after;
        }
      } else {
        yield delta;
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
