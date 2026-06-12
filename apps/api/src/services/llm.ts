import OpenAI from 'openai';
import type { ChatMessage } from '@medaccess/shared';
import { HttpError } from '../middleware/error.js';

let _client: OpenAI | null = null;
let _fallbackClient: OpenAI | null = null;

function buildClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost:5173',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'MedAccess AI',
    },
  });
}

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
  _client = buildClient(apiKey);
  return _client;
}

/** Secondary key used only when the primary returns 402 (out of credits). */
function openrouterFallback(): OpenAI | null {
  const key = process.env.OPENROUTER_API_KEY_FALLBACK;
  if (!key) return null;
  if (!_fallbackClient) _fallbackClient = buildClient(key);
  return _fallbackClient;
}

/**
 * Both keys are free-tier. The primary is "used up" when OpenRouter returns
 * 402 (credits) or 429 (daily free-model rate/quota limit) — in either case we
 * fail over to the second free key.
 */
function isExhaustedError(err: any): boolean {
  return err?.status === 402 || err?.status === 429
    || /402|429|more credits|can only afford|insufficient|rate limit|quota/i.test(err?.message ?? '');
}

/**
 * Run an OpenRouter call on the primary key; if it's exhausted (402/429),
 * transparently retry the same call on the fallback key if one is configured.
 */
async function withFallback<T>(fn: (client: OpenAI) => Promise<T>): Promise<T> {
  try {
    return await fn(openrouter());
  } catch (err) {
    const fb = openrouterFallback();
    if (isExhaustedError(err) && fb) {
      console.warn('[llm] primary key exhausted (402/429) — retrying on fallback key');
      return await fn(fb);
    }
    throw err;
  }
}

export function defaultChatModel(): string {
  return process.env.OPENROUTER_CHAT_MODEL || 'qwen/qwen3.6-flash';
}

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
  const model = opts.model || defaultChatModel();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
    ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const resp = await withFallback((client) => client.chat.completions.create({
    model,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1200,
    response_format: opts.json ? { type: 'json_object' } : undefined,
    messages,
  }));
  const text = resp.choices?.[0]?.message?.content ?? '';
  return { text, model };
}

export type StreamChunk =
  | { type: 'token'; text: string }
  | { type: 'thinking_start' }
  | { type: 'thinking_end' };

export async function* chatStream(opts: ChatOptions): AsyncGenerator<StreamChunk> {
  const model = opts.model || defaultStreamModel();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
    ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  // 402 surfaces when the stream is opened, so the fallback retry wraps creation.
  const stream = await withFallback((client) => client.chat.completions.create({
    model,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1200,
    stream: true,
    messages,
  }));

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
