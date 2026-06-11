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
      `You are MA Agent, a warm and friendly health assistant. A patient just uploaded a photo and our AI analyzed it.`,
      ``,
      `Image type: ${sidecarResult.image_type}`,
      `AI model findings:`,
      findingLines,
      opts.userNote ? `Patient's description: "${opts.userNote}"` : '',
      ``,
      `Write a response that feels like a caring doctor talking to a friend — warm, reassuring, easy to understand.`,
      `Rules:`,
      `- Use simple everyday words. NO medical jargon (no "erythema", "occlusion", "exudate", "pathology").`,
      `- Keep sentences short. Use "you" and "your".`,
      `- Start keyObservations with what YOU see, in plain language (e.g. "It looks like you have a small bump on your skin").`,
      `- For possibleFindings, explain what each finding MEANS for the patient in simple terms.`,
      `- For suggestedFollowUp, give friendly actionable advice like a caring friend would (e.g. "Keep an eye on it", "See a doctor if it gets bigger").`,
      `- Keep the disclaimer SHORT and warm (1 sentence max).`,
      `- Be honest about confidence — if unsure, say so kindly.`,
      ``,
      `Return strict JSON:`,
      `{ "imageType": string, "qualityNotes": string, "keyObservations": string[], "possibleFindings": [{ "finding": string, "confidence": "high"|"moderate"|"low", "notes": string }], "suggestedFollowUp": string[], "disclaimer": string }`,
      opts.language ? `\nRespond in language: ${opts.language}.` : '',
    ].filter(Boolean).join('\n');

    const { text, model } = await chat({
      messages: [{ role: 'user', content: prompt }],
      model: defaultChatModel(),
      temperature: 0.2,
      maxTokens: 700,
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
  const imgType = sidecarResult.image_type || 'medical';
  const prompt = [
    `You are MA Agent, a warm and friendly health assistant. A patient uploaded a ${imgType} image.`,
    `Our specialist AI model for this image type is still being set up, so we can't do automated detection yet.`,
    opts.userNote ? `The patient described: "${opts.userNote}"` : '',
    '',
    `Even without AI detection, give the patient HELPFUL and FRIENDLY guidance:`,
    `- Use simple everyday words. NO medical jargon.`,
    `- Based on the image type and their description, explain what common conditions look like and what to watch for.`,
    `- Give practical, caring advice like a friend who happens to be a doctor.`,
    `- Be honest that our AI couldn't analyze it automatically, but still be helpful.`,
    `- Keep it warm and reassuring.`,
    '',
    `Return strict JSON: { "imageType": string, "qualityNotes": string, "keyObservations": string[], "possibleFindings": [{ "finding": string, "confidence": "low", "notes": string }], "suggestedFollowUp": string[], "disclaimer": string }`,
    `List the MOST LIKELY conditions for this image type based on their description, even at low confidence. Explain each in plain language.`,
    `Keep disclaimer to 1 warm sentence.`,
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
