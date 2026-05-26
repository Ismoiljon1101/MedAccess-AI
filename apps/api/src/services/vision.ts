import type { VisionAnalysis } from '@medaccess/shared';
import { visionReportPrompt } from '@medaccess/shared';
import { HttpError } from '../middleware/error.js';
import { defaultVisionModel, openrouter, safeParseJson } from './llm.js';

export interface AnalyzeImageOptions {
  buffer: Buffer;
  mimetype: string;
  userNote?: string;
  language?: string;
  model?: string;
}

export interface AnalyzeImageResult {
  model: string;
  raw: string;
  analysis: VisionAnalysis | null;
}

export async function analyzeMedicalImage(opts: AnalyzeImageOptions): Promise<AnalyzeImageResult> {
  if (!opts.buffer?.length) throw new HttpError(400, 'No image buffer provided');
  const client = openrouter();
  const model = opts.model || defaultVisionModel();
  const base64 = opts.buffer.toString('base64');
  const system = visionReportPrompt({ language: opts.language });
  const userText = opts.userNote
    ? `Provider note about this image: "${opts.userNote}"\n\nAnalyze and return JSON per the schema.`
    : 'Analyze this medical image and return JSON per the schema.';

  const resp = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 1400,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          {
            type: 'image_url',
            image_url: { url: `data:${opts.mimetype};base64,${base64}` },
          },
        ],
      },
    ],
  });

  const raw = resp.choices?.[0]?.message?.content ?? '';
  return { model, raw, analysis: safeParseJson<VisionAnalysis>(raw) };
}
