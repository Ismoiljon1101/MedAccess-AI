import type { VisionAnalysis } from '@medaccess/shared';
import { visionReportPrompt } from '@medaccess/shared';
import { HttpError } from '../middleware/error.js';
import { chat, defaultChatModel, defaultVisionModel, openrouter, safeParseJson } from './llm.js';

// ── Gemini vision (Google AI Studio) ─────────────────────────────────────────

async function callGeminiVision(
  base64: string,
  mimeType: string,
  systemPrompt: string,
  userText: string,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(503, 'GEMINI_API_KEY not configured');

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{
      parts: [
        { text: userText },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 1400 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new HttpError(502, `Gemini vision error ${res.status}: ${err}`);
  }
  // reason: Gemini wraps content in candidates[0].content.parts[0].text
  const data = await res.json() as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

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
  const base64 = opts.buffer.toString('base64');
  const system = visionReportPrompt({ language: opts.language });
  const userText = opts.userNote
    ? `Provider note about this image: "${opts.userNote}"\n\nAnalyze and return JSON per the schema.`
    : 'Analyze this medical image and return JSON per the schema.';

  // Prefer Gemini when key is present — supports vision natively
  if (process.env.GEMINI_API_KEY) {
    const raw = await callGeminiVision(base64, opts.mimetype, system, userText);
    return { model: 'gemini-2.0-flash', raw, analysis: safeParseJson<VisionAnalysis>(raw) };
  }

  // Fallback: OpenRouter (requires a vision-capable model)
  const client = openrouter();
  const model = opts.model || defaultVisionModel();
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
          { type: 'image_url', image_url: { url: `data:${opts.mimetype};base64,${base64}` } },
        ],
      },
    ],
  });

  const raw = resp.choices?.[0]?.message?.content ?? '';
  return { model, raw, analysis: safeParseJson<VisionAnalysis>(raw) };
}

// ── Merged result ────────────────────────────────────────────────────────────

export interface AnalyzeImageFullResult extends AnalyzeImageResult {
  /** Raw sidecar response, null if sidecar disabled or failed. */
  sidecar: MLAnalyzeResponse | null;
}

/**
 * Correct pipeline:
 *   1. Sidecar (local YOLO / TorchXRayVision) runs on the image → structured findings JSON
 *   2. If sidecar has findings → TEXT LLM explains them (image never sent to main LLM)
 *   3. If sidecar skipped / unavailable → Gemini vision fallback (rate-limited, last resort)
 *
 * The main LLM only ever sees text — specialist model output + user note.
 * This avoids Gemini vision quota hits and keeps clinical accuracy high.
 */
export async function analyzeImageFull(
  opts: AnalyzeImageOptions,
): Promise<AnalyzeImageFullResult> {
  const rawHint = (opts.userNote || '').toLowerCase();
  const hint =
    /xray|x-ray|chest|lung|pneumon/.test(rawHint) ? 'xray' :
    /skin|lesion|rash|melanom|dermat/.test(rawHint) ? 'skin' :
    /eye|retina|fundus|diabetic/.test(rawHint) ? 'eye' :
    undefined;

  // ── Step 1: specialist sidecar ─────────────────────────────────
  const sidecarResult = await analyzeImageViaSidecar(opts.buffer, hint);

  // ── Step 2: sidecar has real findings → text LLM explains them ─
  if (sidecarResult && !sidecarResult.skipped && sidecarResult.findings.length > 0) {
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

    const analysis = safeParseJson<VisionAnalysis>(text);
    return {
      model: `${sidecarResult.model_used}+${model}`,
      raw: text,
      analysis,
      sidecar: sidecarResult,
    };
  }

  // ── Step 3: sidecar configured but skipped (model not yet trained) ─
  // Do NOT call Gemini — sidecar is running, image type was detected,
  // specialist model just isn't trained yet. Tell the text LLM that.
  if (sidecarResult !== null) {
    const reason = sidecarResult.skipped_reason || 'Specialist model not yet loaded';
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

  // ── Step 4: sidecar not configured at all → Gemini vision fallback ─
  // IMAGE_ML_URL is unset — only then do we use Gemini.
  console.warn('[vision] sidecar not configured (IMAGE_ML_URL unset) — falling back to Gemini');
  const llmResult = await analyzeMedicalImage(opts);
  return { ...llmResult, sidecar: null };
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(`${mlUrl}/analyze`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timer);

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
