import OpenAI from 'openai';
import { HttpError } from '../middleware/error.js';

let _client: OpenAI | null = null;

function openai(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, 'OPENAI_API_KEY not configured', {
      code: 'NoTranscriber',
      publicMessage:
        'Server transcription requires OPENAI_API_KEY. The frontend will fall back to the browser Web Speech API.',
    });
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

export function whisperAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export interface TranscribeOptions {
  buffer: Buffer;
  filename?: string;
  mimetype?: string;
  language?: string;
}

export interface TranscribeResult {
  text: string;
  language?: string;
  duration?: number;
  model: string;
}

export async function transcribeAudio(opts: TranscribeOptions): Promise<TranscribeResult> {
  if (!opts.buffer?.length) throw new HttpError(400, 'Empty audio buffer');
  const client = openai();
  const model = process.env.OPENAI_WHISPER_MODEL || 'whisper-1';

  const file = new File(
    [opts.buffer],
    opts.filename || 'audio.webm',
    { type: opts.mimetype || 'audio/webm' }
  );

  const resp = await client.audio.transcriptions.create({
    model,
    file,
    language: opts.language,
    response_format: 'verbose_json',
  });

  // The verbose_json shape includes `language` and `duration`.
  const verbose = resp as unknown as { text: string; language?: string; duration?: number };

  return {
    text: verbose.text || '',
    language: verbose.language,
    duration: verbose.duration,
    model,
  };
}
