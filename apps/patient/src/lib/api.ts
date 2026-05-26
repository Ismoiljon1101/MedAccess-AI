// Patient-facing API client — simplified subset of the full clinic API.
// No model picker exposed. Uses env default model on the server.

import type { SymptomsAnalysis, TriageResult, PatientContext } from '@medaccess/shared';

const BASE = import.meta.env.VITE_API_BASE || '';

async function safeError(res: Response): Promise<Error> {
  try {
    const d = await res.json();
    return new Error(d.message || d.error || `HTTP ${res.status}`);
  } catch {
    return new Error(`HTTP ${res.status}`);
  }
}

// ---------- health --------------------------------------------------------

export interface HealthInfo {
  status: 'ok';
  providers: { openrouter: boolean };
  rag: { ready: boolean };
}

export async function getHealth(): Promise<HealthInfo> {
  const res = await fetch(`${BASE}/api/health`);
  if (!res.ok) throw await safeError(res);
  return res.json();
}

// ---------- symptom check -------------------------------------------------

export interface SymptomCheckOptions {
  symptoms: string[];
  patient?: Pick<PatientContext, 'age' | 'sex' | 'pregnancy'>;
  language?: string;
}

export interface SymptomCheckResult {
  urgency: SymptomsAnalysis['urgency'];
  topConditions: { name: string; likelihood: 'high' | 'moderate' | 'low' }[];
  nextSteps: string[];
  redFlags: string[];
  disclaimer: string;
}

export async function checkSymptoms(opts: SymptomCheckOptions): Promise<SymptomCheckResult> {
  const res = await fetch(`${BASE}/api/symptoms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symptoms: opts.symptoms, patient: opts.patient, language: opts.language }),
  });
  if (!res.ok) throw await safeError(res);
  const data = await res.json();
  const analysis: SymptomsAnalysis = data.analysis;

  // Simplify — no raw probabilities exposed to patients
  const topConditions = analysis.differentials
    .filter((d) => d.likelihood !== 'low')
    .slice(0, 4)
    .map((d) => ({ name: d.condition, likelihood: d.likelihood }));

  const redFlags = analysis.differentials.flatMap((d) => d.redFlags ?? []);

  return {
    urgency: analysis.urgency,
    topConditions,
    nextSteps: analysis.recommendedNextSteps,
    redFlags: [...new Set(redFlags)],
    disclaimer: analysis.disclaimer,
  };
}

// ---------- emergency check -----------------------------------------------

export interface EmergencyCheckOptions {
  description: string;
  language?: string;
}

export interface EmergencyCheckResult {
  level: TriageResult['level'];
  label: string;
  targetTime: string;
  actions: string[];
  warningSigns: string[];
}

export async function checkEmergency(opts: EmergencyCheckOptions): Promise<EmergencyCheckResult> {
  const res = await fetch(`${BASE}/api/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseSummary: opts.description, language: opts.language }),
  });
  if (!res.ok) throw await safeError(res);
  const data = await res.json();
  const t: TriageResult = data.triage;
  return {
    level: t.level,
    label: t.levelLabel,
    targetTime: t.targetTimeToCare,
    actions: t.actions,
    warningSigns: t.warningSigns,
  };
}

// ---------- transcribe (voice) --------------------------------------------

export async function transcribeAudio(blob: Blob, language?: string): Promise<string> {
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  if (language) form.append('language', language);
  const res = await fetch(`${BASE}/api/transcribe`, { method: 'POST', body: form });
  if (!res.ok) throw await safeError(res);
  const data = await res.json();
  return data.text as string;
}
