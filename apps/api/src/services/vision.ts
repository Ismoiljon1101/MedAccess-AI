import type { VisionAnalysis } from '@medaccess/shared';
import { visionReportPrompt } from '@medaccess/shared';
import { HttpError } from '../middleware/error.js';
import { defaultVisionModel, openrouter, safeParseJson } from './llm.js';

// ── Python sidecar contract (services/image-ml/main.py) ──────────────────

/**
 * Specialist medical-image model finding. One result per finding detected.
 * Example: { label: "melanoma", confidence: 0.94, notes: "irregular borders, color variation" }
 */
export interface MLFinding {
  label: string;
  confidence: number; // [0, 1]
  notes?: string;
}

/**
 * Response from POST /analyze on the Python sidecar.
 * Stable contract — do not break this without coordinating with Temirlan.
 */
export interface MLAnalyzeResponse {
  image_type: 'skin' | 'xray' | 'eye' | 'other' | 'unknown';
  skipped: boolean;
  skipped_reason?: string;
  findings: MLFinding[];
  model_used: string;
  processing_ms: number;
}

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

/**
 * Call specialist medical-image models via the Python sidecar.
 * Feature-flagged by IMAGE_ML_URL environment variable.
 *
 * @param buffer Image bytes
 * @param hint Optional type hint: 'skin', 'xray', 'eye'. Helps triage the image.
 * @returns MLAnalyzeResponse or null if sidecar is unavailable / disabled.
 */
export async function analyzeImageViaSidecar(
  buffer: Buffer,
  hint?: string,
): Promise<MLAnalyzeResponse | null> {
  const mlUrl = process.env.IMAGE_ML_URL;
  if (!mlUrl) {
    // Sidecar not configured — return null so caller can fall back to LLM.
    return null;
  }

  const form = new FormData();
  form.append('image', new Blob([buffer]), 'image.jpg');
  if (hint) form.append('hint', hint);

  try {
    const res = await fetch(`${mlUrl}/analyze`, {
      method: 'POST',
      body: form,
      timeout: 30_000, // 30s sidecar timeout
    });

    if (!res.ok) {
      console.warn(`[vision] ML sidecar /analyze failed: HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as MLAnalyzeResponse;
    return data;
  } catch (err) {
    // Network error, timeout, or JSON parse failure — fall back to LLM.
    console.warn(`[vision] ML sidecar call failed:`, err);
    return null;
  }
}
