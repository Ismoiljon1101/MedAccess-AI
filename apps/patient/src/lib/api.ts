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

// ---------- voice mode (LiveKit) ─────────────────────────────────────

export interface VoiceToken {
  token: string;
  url: string;
  room: string;
  identity: string;
}

export async function getVoiceToken(sessionId?: string): Promise<VoiceToken> {
  const res = await fetch(`${BASE}/api/voice/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw await safeError(res);
  return res.json();
}

export async function getVoiceStatus(): Promise<{ configured: boolean }> {
  const res = await fetch(`${BASE}/api/voice/status`);
  if (!res.ok) return { configured: false };
  return res.json();
}

// ---------- session load (for history resume) ─────────────────────────

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function loadSession(sessionId: string): Promise<StoredMessage[]> {
  const res = await fetch(`${BASE}/api/chat/session/${sessionId}`);
  if (!res.ok) throw await safeError(res);
  const data = await res.json();
  return (data.messages ?? []) as StoredMessage[];
}

// ---------- chat (conversational AI) -------------------------------------

export interface ChatStreamEvent {
  type: 'meta' | 'token' | 'done' | 'error' | string;
  data: Record<string, any>;
}

export async function* streamChatRequest(
  message: string,
  sessionId: string | undefined,
  language: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const res = await fetch(`${BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, language, useRag: true }),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by double newline
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (!part.trim()) continue;
        let eventType = 'message';
        let dataStr = '';
        for (const line of part.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim();
          if (line.startsWith('data: '))  dataStr   = line.slice(6).trim();
        }
        if (dataStr) {
          try { yield { type: eventType, data: JSON.parse(dataStr) }; }
          catch { /* malformed — skip */ }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------- report analysis (image upload) ──────────────────────────────

export interface ReportAnalysisResult {
  imageType: string;
  qualityNotes: string;
  keyObservations: string[];
  findings: Array<{ finding: string; confidence: 'high' | 'moderate' | 'low'; notes: string }>;
  suggestedFollowUp: string[];
  disclaimer: string;
}

export async function analyzeReport(
  imageBlob: Blob,
  language?: string,
  sessionId?: string,
): Promise<ReportAnalysisResult> {
  const form = new FormData();
  form.append('image', imageBlob, `report.${imageBlob.type.split('/')[1] || 'jpg'}`);
  if (language) form.append('language', language);
  if (sessionId) form.append('sessionId', sessionId);

  const res = await fetch(`${BASE}/api/reports/analyze`, { method: 'POST', body: form });
  if (!res.ok) throw await safeError(res);
  const data = await res.json();
  return data.analysis;
}

// ---------- facilities (v0.2) ─────────────────────────────────────────────

export interface DoctorResult {
  id: string;
  facilityId: string;
  name: string;
  specialty: string;
  consultationMinutes: number;
  languages: string[];
  bio?: string;
}

export interface FacilityResult {
  id: string;
  name: string;
  type: 'hospital' | 'clinic' | 'pharmacy';
  address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  phone?: string;
  openingHours: string;
  specialties: string[];
  verified: boolean;
  source: string;
  distanceKm: number | null;
  doctors: DoctorResult[];
}

export interface SlotResult {
  startTime: string; // HH:MM
  endTime: string;
}

export interface FacilitySlotsResponse {
  doctorId: string;
  facilityId: string;
  date: string;
  consultationMinutes: number;
  slots: SlotResult[];
  totalSlots: number;
  availableSlots: number;
}

export interface BookAppointmentPayload {
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  patientAge?: number;
  patientSex?: string;
  doctorId: string;
  facilityId: string;
  date: string;
  startTime: string;
  specialty?: string;
  urgency?: string;
  maAgentSummary?: string;
  sessionId?: string;
}

export interface BookAppointmentResult {
  appointmentId: string;
  slotId: string;
  doctorName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  message: string;
}

export async function searchFacilities(opts: {
  lat?: number;
  lng?: number;
  specialty?: string;
  type?: string;
  city?: string;
  radius?: number;
}): Promise<FacilityResult[]> {
  const params = new URLSearchParams();
  if (opts.lat != null)     params.set('lat',       String(opts.lat));
  if (opts.lng != null)     params.set('lng',       String(opts.lng));
  if (opts.specialty)       params.set('specialty', opts.specialty);
  if (opts.type)            params.set('type',      opts.type);
  if (opts.city)            params.set('city',      opts.city);
  if (opts.radius != null)  params.set('radius',    String(opts.radius));
  const res = await fetch(`${BASE}/api/facilities?${params}`);
  if (!res.ok) throw await safeError(res);
  const data = await res.json();
  return data.facilities as FacilityResult[];
}

export async function getFacilitySlots(
  facilityId: string,
  doctorId: string,
  date: string,
): Promise<FacilitySlotsResponse> {
  const params = new URLSearchParams({ doctorId, date });
  const res = await fetch(`${BASE}/api/facilities/${facilityId}/slots?${params}`);
  if (!res.ok) throw await safeError(res);
  return res.json();
}

export async function bookAppointment(payload: BookAppointmentPayload): Promise<BookAppointmentResult> {
  const res = await fetch(`${BASE}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await safeError(res);
  return res.json();
}

// ---------- legacy clinics + referrals (kept for backward compat) ──────────

export interface ClinicResult {
  id: string;
  name: string;
  specialty: string[];
  phone: string;
  hours: string;
  rating: number;
  available: boolean;
  waitMinutes: number | null;
  distanceKm: number | null;
  distanceLabel: string;
}

export async function searchClinics(opts: {
  lat?: number;
  lng?: number;
  specialty?: string;
}): Promise<ClinicResult[]> {
  const params = new URLSearchParams();
  if (opts.lat != null) params.set('lat', String(opts.lat));
  if (opts.lng != null) params.set('lng', String(opts.lng));
  if (opts.specialty)   params.set('specialty', opts.specialty);
  const res = await fetch(`${BASE}/api/clinics?${params}`);
  if (!res.ok) throw await safeError(res);
  const data = await res.json();
  return data.clinics as ClinicResult[];
}

export interface ReferralPayload {
  sessionId?: string;
  patientName: string;
  patientPhone?: string;
  clinicId: string;
  clinicName: string;
  specialty: string;
  urgency?: string;
  summary?: string;
  preferredTime?: string;
}

export async function createReferral(payload: ReferralPayload): Promise<{ referralId: string; message: string }> {
  const res = await fetch(`${BASE}/api/clinics/referrals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await safeError(res);
  return res.json();
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

// ---------- maps proxy (Tier 2 facility fallback) -------------------------

export interface MapPlace {
  placeId: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  phone?: string;
  rating?: number;
  openNow?: boolean;
  types: string[];
  distanceKm?: number | null;
  navUrl: string;
  source: 'google' | 'naver' | 'stub';
}

export interface MapNearbyResult {
  places: MapPlace[];
  source: string;
  total?: number;
  message?: string; // present in stub mode
}

export async function searchMapNearby(opts: {
  lat: number;
  lng: number;
  type?: string;
  radius?: number;
  keyword?: string;
}): Promise<MapNearbyResult> {
  const params = new URLSearchParams({
    lat:    String(opts.lat),
    lng:    String(opts.lng),
    type:   opts.type   || 'hospital',
    radius: String(opts.radius || 5000),
  });
  if (opts.keyword) params.set('keyword', opts.keyword);
  const res = await fetch(`${BASE}/api/maps/nearby?${params}`);
  if (!res.ok) throw await safeError(res);
  return res.json();
}

/** Returns a navigation deep-link URL (Google or Naver by locale). */
export async function getNavLink(lat: number, lng: number, name: string, locale?: string): Promise<string> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), name });
  if (locale) params.set('locale', locale);
  try {
    const res = await fetch(`${BASE}/api/maps/navlink?${params}`);
    if (!res.ok) throw new Error('navlink failed');
    const data = await res.json();
    return data.url as string;
  } catch {
    // Fallback: inline Google Maps direction URL (no API key needed)
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
}
