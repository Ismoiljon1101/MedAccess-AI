// Typed API client. The server proxies to /api/* via Vite in dev.
// In production, override VITE_API_BASE in the build env.

import type {
  ChatMessage,
  SymptomsAnalysis,
  TriageResult,
  VisionAnalysis,
  TranscribeResponse,
  PatientContext,
  Vitals,
} from '@medaccess/shared';

const BASE = import.meta.env.VITE_API_BASE || '';

export interface Citation {
  id: string;
  title: string;
  score: number;
}

export interface HealthInfo {
  status: 'ok';
  version: string;
  providers: { openrouter: boolean; openaiWhisper: boolean };
  defaultModel: string;
  rag: { ready: boolean; size: number; reason?: string };
}

async function safeError(res: Response): Promise<Error> {
  try {
    const data = await res.json();
    return new Error(data.message || data.error || `HTTP ${res.status}`);
  } catch {
    return new Error(`HTTP ${res.status}`);
  }
}

export async function getHealth(): Promise<HealthInfo> {
  const res = await fetch(`${BASE}/api/health`);
  if (!res.ok) throw await safeError(res);
  return res.json();
}

export interface ChatSendOptions {
  sessionId?: string;
  message: string;
  history?: ChatMessage[];
  language?: string;
  model?: string;
  useRag?: boolean;
}

export interface ChatSendResult {
  sessionId: string;
  message: ChatMessage;
  model: string;
  citations: Citation[];
}

export async function sendChat(opts: ChatSendOptions): Promise<ChatSendResult> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw await safeError(res);
  return res.json();
}

export interface StreamCallbacks {
  onMeta?: (meta: { sessionId: string; citations: Citation[] }) => void;
  onToken?: (delta: string) => void;
  onDone?: (info: { sessionId: string }) => void;
  onError?: (err: Error) => void;
}

export async function streamChat(opts: ChatSendOptions, cb: StreamCallbacks): Promise<void> {
  const res = await fetch(`${BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok || !res.body) {
    const err = await safeError(res);
    cb.onError?.(err);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const lines = block.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const payload = JSON.parse(data);
        if (event === 'meta') cb.onMeta?.(payload);
        else if (event === 'token') cb.onToken?.(payload.delta);
        else if (event === 'done') cb.onDone?.(payload);
        else if (event === 'error') cb.onError?.(new Error(payload.message || 'stream error'));
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

export interface SymptomsSendOptions {
  symptoms: string[];
  patient?: PatientContext;
  language?: string;
  model?: string;
}

export interface SymptomsResult {
  analysis: SymptomsAnalysis;
  model: string;
  citations: Citation[];
}

export async function analyzeSymptoms(opts: SymptomsSendOptions): Promise<SymptomsResult> {
  const res = await fetch(`${BASE}/api/symptoms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw await safeError(res);
  return res.json();
}

export interface TriageSendOptions {
  caseSummary: string;
  vitals?: Vitals;
  language?: string;
  model?: string;
}

export interface TriageResultPayload {
  triage: TriageResult;
  model: string;
}

export async function runTriage(opts: TriageSendOptions): Promise<TriageResultPayload> {
  const res = await fetch(`${BASE}/api/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw await safeError(res);
  return res.json();
}

export interface ReportAnalyzeOptions {
  file: File;
  note?: string;
  language?: string;
  model?: string;
}

export interface ReportAnalyzeResult {
  model: string;
  analysis: VisionAnalysis | null;
  raw?: string;
}

export async function analyzeReport(opts: ReportAnalyzeOptions): Promise<ReportAnalyzeResult> {
  const form = new FormData();
  form.append('image', opts.file);
  if (opts.note) form.append('note', opts.note);
  if (opts.language) form.append('language', opts.language);
  if (opts.model) form.append('model', opts.model);

  const res = await fetch(`${BASE}/api/reports/analyze`, { method: 'POST', body: form });
  if (!res.ok) throw await safeError(res);
  return res.json();
}

export interface TranscribeOptions {
  blob: Blob;
  filename?: string;
  language?: string;
}

export async function transcribe(opts: TranscribeOptions): Promise<TranscribeResponse> {
  const form = new FormData();
  form.append('audio', opts.blob, opts.filename || 'recording.webm');
  if (opts.language) form.append('language', opts.language);

  const res = await fetch(`${BASE}/api/transcribe`, { method: 'POST', body: form });
  if (!res.ok) throw await safeError(res);
  return res.json();
}

export async function getTranscribeStatus(): Promise<{ available: boolean; provider: string }> {
  const res = await fetch(`${BASE}/api/transcribe/status`);
  if (!res.ok) throw await safeError(res);
  return res.json();
}

// ── Referrals (patient queue) ─────────────────────────────────────────

export interface ReferralRecord {
  _id: string;
  sessionId: string;
  patientName: string;
  patientPhone?: string;
  clinicId: string;
  clinicName: string;
  specialty: string;
  urgency: string;
  summary: string;
  preferredTime?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
  imageAnalysis?: {
    imageType: string;
    findings: Array<{ finding: string; confidence: string; notes: string }>;
    suggestedFollowUp: string[];
    model: string;
  };
}

export async function getReferrals(): Promise<ReferralRecord[]> {
  const res = await fetch(`${BASE}/api/clinics/referrals`);
  if (!res.ok) throw await safeError(res);
  const data = await res.json();
  return (data.referrals ?? []) as ReferralRecord[];
}

export async function updateReferral(
  id: string,
  status: 'confirmed' | 'cancelled' | 'pending',
): Promise<ReferralRecord> {
  const res = await fetch(`${BASE}/api/clinics/referrals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw await safeError(res);
  const data = await res.json();
  return data.referral as ReferralRecord;
}
