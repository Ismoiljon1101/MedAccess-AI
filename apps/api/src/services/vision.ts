import type { VisionAnalysis } from '@medaccess/shared';
import { HttpError } from '../middleware/error.js';
import { chat, defaultChatModel, safeParseJson } from './llm.js';

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

// ── Merged result ────────────────────────────────────────────────────────────

export interface AnalyzeImageFullResult extends AnalyzeImageResult {
  /** Raw sidecar response, null if sidecar disabled or failed. */
  sidecar: MLAnalyzeResponse | null;
}

/**
 * Pipeline (the ONLY pipeline):
 *   1. Image → local Python sidecar (YOLO / TorchXRayVision / etc.) → structured findings
 *   2. Sidecar findings (TEXT) → main LLM → clinical summary JSON
 *
 * Images NEVER go to cloud LLMs. No Gemini. No OpenRouter vision.
 * The main LLM only sees text — specialist model output + user note.
 */
export async function analyzeImageFull(
  opts: AnalyzeImageOptions,
): Promise<AnalyzeImageFullResult> {
  if (!opts.buffer?.length) throw new HttpError(400, 'No image buffer provided');

  const mlUrl = process.env.IMAGE_ML_URL;
  if (!mlUrl) {
    throw new HttpError(503,
      'Image analysis requires the local ML sidecar. Set IMAGE_ML_URL (e.g. http://localhost:5001) and start services/image-ml.'
    );
  }

  const rawHint = (opts.userNote || '').toLowerCase();
  const hint =
    /xray|x-ray|chest|lung|pneumon/.test(rawHint) ? 'xray' :
    /skin|lesion|rash|melanom|dermat/.test(rawHint) ? 'skin' :
    /eye|retina|fundus|diabetic/.test(rawHint) ? 'eye' :
    undefined;

  // ── Step 1: local specialist models ───────────────────────────────
  const sidecarResult = await analyzeImageViaSidecar(mlUrl, opts.buffer, hint);

  // ── Step 2: sidecar has real findings → text LLM explains them ────
  if (!sidecarResult.skipped && sidecarResult.findings.length > 0) {
    const findingLines = sidecarResult.findings
      .map((f, i) => `${i + 1}. ${f.label} (confidence: ${(f.confidence * 100).toFixed(0)}%)${f.notes ? ' — ' + f.notes : ''}`)
      .join('\n');

    const prompt = [
      `A specialist medical CV model (${sidecarResult.model_used}) analyzed a ${sidecarResult.image_type} image and found:`,
      findingLines,
      opts.userNote ? `\nProvider note: "${opts.userNote}"` : '',
      `\nProduce a clinical summary for a frontline provider. Return strict JSON matching this schema exactly:`,
      `{ "imageType": string, "qualityNotes": string, "keyObservations": string[], "possibleFindings": [{ "finding": string, "confidence": "high"|"moderate"|"low", "notes": string }], "suggestedFollowUp": string[], "disclaimer": string }`,
      opts.language ? `\nRespond in language: ${opts.language}.` : '',
    ].filter(Boolean).join('\n');

    const { text, model } = await chat({
      messages: [{ role: 'user', content: prompt }],
      model: defaultChatModel(),
      temperature: 0.2,
      maxTokens: 1200,
      json: true,
    });

    return {
      model: `${sidecarResult.model_used}+${model}`,
      raw: text,
      analysis: safeParseJson<VisionAnalysis>(text),
      sidecar: sidecarResult,
    };
  }

  // ── Step 3: sidecar running but model skipped (not trained yet) ────
  const reason = sidecarResult.skipped_reason || 'Specialist model not yet loaded for this image type';
  const prompt = [
    `The patient uploaded a ${sidecarResult.image_type || 'medical'} image.`,
    `Specialist model status: ${reason}`,
    opts.userNote ? `Provider note: "${opts.userNote}"` : '',
    `Produce a clinical response acknowledging the image was received but the specialist model is not yet available for this image type.`,
    `Advise the patient on what the image type typically shows and recommend in-person evaluation.`,
    `Return strict JSON: { "imageType": string, "qualityNotes": string, "keyObservations": string[], "possibleFindings": [], "suggestedFollowUp": string[], "disclaimer": string }`,
    opts.language ? `Respond in language: ${opts.language}.` : '',
  ].filter(Boolean).join('\n');

  const { text, model } = await chat({
    messages: [{ role: 'user', content: prompt }],
    model: defaultChatModel(),
    temperature: 0.2,
    maxTokens: 800,
    json: true,
  });

  return { model, raw: text, analysis: safeParseJson<VisionAnalysis>(text), sidecar: sidecarResult };
}

/**
 * Call specialist medical-image models via the local Python sidecar.
 * This is the ONLY way images get analyzed. No cloud vision fallback.
 *
 * @param mlUrl Base URL of the sidecar (e.g. http://localhost:5001)
 * @param buffer Image bytes
 * @param hint Optional type hint: 'skin', 'xray', 'eye'. Helps triage the image.
 */
async function analyzeImageViaSidecar(
  mlUrl: string,
  buffer: Buffer,
  hint?: string,
): Promise<MLAnalyzeResponse> {
  const form = new FormData();
  form.append('image', new Blob([buffer]), 'image.jpg');
  if (hint) form.append('hint', hint);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${mlUrl}/analyze`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new HttpError(502, `ML sidecar returned HTTP ${res.status}: ${errBody}`);
    }

    return (await res.json()) as MLAnalyzeResponse;
  } catch (err: any) {
    clearTimeout(timer);
    if (err instanceof HttpError) throw err;
    // Network error = sidecar not running
    throw new HttpError(503,
      `Cannot reach local ML sidecar at ${mlUrl}/analyze. Is services/image-ml running? Error: ${err.message}`
    );
  }
}

// Legacy export kept for the reports route — now just calls analyzeImageFull
export async function analyzeMedicalImage(opts: AnalyzeImageOptions): Promise<AnalyzeImageResult> {
  return analyzeImageFull(opts);
}
