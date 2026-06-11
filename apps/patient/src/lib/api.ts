// Patient API client — MedAccess AI
// Korea market · phone-based identity · agent-driven booking

import type { SymptomsAnalysis, TriageResult, PatientContext, PatientCreate } from '@medaccess/shared';

const BASE = import.meta.env.VITE_API_BASE || '';

async function safeError(res: Response): Promise<Error> {
  try {
    const d = await res.json();
    return new Error(d.message || d.error || `HTTP ${res.status}`);
  } catch {
    return new Error(`HTTP ${res.status}`);
  }
}

// ---------- patient identity ------------------------------------------------

export interface PatientRecord {
  _id: string;
  fullName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  sex?: 'male' | 'female' | 'other';
  bloodType?: string;
  city?: string;
  country: string;
  preferredLanguage: string;
  knownAllergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  emergencyContact?: { name: string; phone: string; relationship: string };
}

export async function createPatient(data: PatientCreate): Promise<PatientRecord> {
  const res = await fetch(`${BASE}/api/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await safeError(res);
  const result = await res.json();
  return result.patient as PatientRecord;
}

export async function getMyPatient(phone: string): Promise<PatientRecord | null> {
  try {
    const res = await fetch(`${BASE}/api/patients/me`, {
      headers: { 'X-Patient-Phone': phone },
    });
    if (!res.ok) return null;
    const result = await res.json();
    return result.patient as PatientRecord;
  } catch {
    return null;
  }
}

export async function updateMyPatient(phone: string, data: Partial<PatientCreate>): Promise<PatientRecord | null> {
  try {
    const res = await fetch(`${BASE}/api/patients/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Patient-Phone': phone },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const result = await res.json();
    return result.patient as PatientRecord;
  } catch {
    return null;
  }
}

// ---------- health ----------------------------------------------------------

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

// ---------- symptom check ---------------------------------------------------

export interface SymptomCheckOptions {
  symptoms: string[];
  patient?: Pick<PatientContext, 'age' | 'sex' | 'pregnancy'>;
  language?: string;
  patientPhone?: string;
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
    body: JSON.stringify({
      symptoms: opts.symptoms,
      patient: opts.patient,
      language: opts.language,
      patientPhone: opts.patientPhone,
    }),
  });
  if (!res.ok) throw await safeError(res);
  const data = await res.json();
  const analysis: SymptomsAnalysis = data.analysis;

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

// ---------- emergency check -------------------------------------------------

export interface EmergencyCheckOptions {
  description: string;
  language?: string;
  patientPhone?: string;
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
    body: JSON.stringify({
      caseSummary: opts.description,
      language: opts.language,
      patientPhone: opts.patientPhone,
    }),
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

// ---------- voice mode (LiveKit) --------------------------------------------

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

// ---------- session ---------------------------------------------------------

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

// ---------- chat stream ------------------------------------------------------

export interface ChatStreamEvent {
  type: 'meta' | 'token' | 'thinking_start' | 'thinking_end' | 'booking_proposal' | 'done' | 'error' | string;
  data: Record<string, any>;
}

export async function* streamChatRequest(
  message: string,
  sessionId: string | undefined,
  language: string,
  opts?: {
    patientPhone?: string;
    lat?: number;
    lng?: number;
    signal?: AbortSignal;
    model?: string;
  },
): AsyncGenerator<ChatStreamEvent> {
  const res = await fetch(`${BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      sessionId,
      language,
      useRag: true,
      patientPhone: opts?.patientPhone,
      lat: opts?.lat,
      lng: opts?.lng,
      model: opts?.model,
    }),
    signal: opts?.signal,
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

// ---------- agent booking ---------------------------------------------------

export interface AgentBookingProposal {
  proposalKey: string;
  facilityId: string;
  facilityName: string;
  facilityAddress?: string;
  facilityPhone?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  proposedDate: string;
  proposedTime: string;
  proposedEndTime: string;
  specialty: string;
  urgency: string;
  distanceKm?: number;
}

export interface ConfirmBookingResult {
  appointmentId: string;
  scheduledDate: string;
  scheduledTime: string;
  scheduledEndTime: string;
  status: string;
}

export async function confirmAgentBooking(opts: {
  proposalKey: string;
  patientPhone: string;
  agentSummary?: string;
  sessionId?: string;
}): Promise<ConfirmBookingResult> {
  const res = await fetch(`${BASE}/api/appointments/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw await safeError(res);
  return res.json();
}

export interface AppointmentRecord {
  _id: string;
  patientId?: Record<string, any>;
  doctorId?: { _id: string; name: string; specialty: string };
  facilityId?: { _id: string; name: string; city: string; address?: string; phone?: string };
  specialty: string;
  urgency: string;
  agentSummary?: string;
  scheduledDate: string;
  scheduledTime: string;
  scheduledEndTime?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  doctorNotes?: string;
  createdAt: string;
}

export async function getMyAppointments(patientPhone: string): Promise<AppointmentRecord[]> {
  const res = await fetch(`${BASE}/api/appointments?patientPhone=${encodeURIComponent(patientPhone)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.appointments ?? []) as AppointmentRecord[];
}

// ---------- report analysis -------------------------------------------------

export interface ReportAnalysisResult {
  reportId?: string;   // saved ReportAnalysis _id — attach to a booking so the doctor sees it
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
  patientPhone?: string,
): Promise<ReportAnalysisResult> {
  const form = new FormData();
  form.append('image', imageBlob, `report.${imageBlob.type.split('/')[1] || 'jpg'}`);
  if (language)     form.append('language',     language);
  if (sessionId)    form.append('sessionId',    sessionId);
  if (patientPhone) form.append('patientPhone', patientPhone);

  const res = await fetch(`${BASE}/api/reports/analyze`, { method: 'POST', body: form });
  if (!res.ok) throw await safeError(res);
  const data = await res.json();
  const a = data.analysis ?? {};
  return {
    reportId:          data.reportId,
    imageType:         a.imageType         ?? '',
    qualityNotes:      a.qualityNotes      ?? '',
    keyObservations:   a.keyObservations   ?? [],
    findings:          a.possibleFindings  ?? a.findings ?? [],
    suggestedFollowUp: a.suggestedFollowUp ?? [],
    disclaimer:        a.disclaimer        ?? '',
  };
}

// ---------- facilities ------------------------------------------------------

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
  address?: string;
  city?: string;
  country: string;
  lat: number;
  lng: number;
  phone?: string;
  openingHours?: string;
  specialties: string[];
  enrolled: boolean;
  verified?: boolean;
  distanceKm: number | null;
  doctors: DoctorResult[];
}

// Accepts both old field names (date/startTime) and new (scheduledDate/scheduledTime)
export interface BookAppointmentPayload {
  patientPhone?: string;
  patientName?: string;
  patientEmail?: string;
  patientAge?: number;
  patientSex?: string;
  doctorId: string;
  facilityId: string;
  date?: string;           // old field name
  startTime?: string;      // old field name
  scheduledDate?: string;  // new field name
  scheduledTime?: string;  // new field name
  specialty: string;
  urgency?: string;
  maAgentSummary?: string;  // old field name
  agentSummary?: string;    // new field name
  agentAnalysis?: { symptomsId?: string; triageId?: string; imageReportId?: string };
  sessionId?: string;
}

export interface BookAppointmentResult {
  appointmentId: string;
  scheduledDate: string;
  scheduledTime: string;
  scheduledEndTime: string;
  // backwards compat aliases
  date: string;
  startTime: string;
  endTime: string;
  doctorName: string;
  status: string;
  message: string;
}

export async function bookAppointment(payload: BookAppointmentPayload): Promise<BookAppointmentResult> {
  // Normalize to server schema
  const body = {
    patientPhone:  payload.patientPhone || '',
    doctorId:      payload.doctorId,
    facilityId:    payload.facilityId,
    specialty:     payload.specialty,
    urgency:       payload.urgency || 'see-clinician-soon',
    scheduledDate: payload.scheduledDate || payload.date || '',
    scheduledTime: payload.scheduledTime || payload.startTime || '',
    agentSummary:  payload.agentSummary || payload.maAgentSummary,
    agentAnalysis: payload.agentAnalysis,
    sessionId:     payload.sessionId,
  };
  const res = await fetch(`${BASE}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await safeError(res);
  const r = await res.json();
  // Normalize result — add backwards-compat aliases
  return {
    appointmentId:   r.appointmentId,
    scheduledDate:   r.scheduledDate || r.date || '',
    scheduledTime:   r.scheduledTime || r.startTime || '',
    scheduledEndTime: r.scheduledEndTime || r.endTime || '',
    date:            r.scheduledDate || r.date || '',
    startTime:       r.scheduledTime || r.startTime || '',
    endTime:         r.scheduledEndTime || r.endTime || '',
    doctorName:      r.doctorName || '',
    status:          r.status || 'pending',
    message:         r.message || 'Appointment booked successfully.',
  };
}

export interface SlotResult {
  startTime: string;
  endTime: string;
}

export interface FacilitySlotsResponse {
  doctorId: string;
  facilityId: string;
  date: string;
  slots: SlotResult[];
  availableSlots: number;
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
  if (opts.lat != null)    params.set('lat',       String(opts.lat));
  if (opts.lng != null)    params.set('lng',       String(opts.lng));
  if (opts.specialty)      params.set('specialty', opts.specialty);
  if (opts.type)           params.set('type',      opts.type);
  if (opts.city)           params.set('city',      opts.city);
  if (opts.radius != null) params.set('radius',    String(opts.radius));
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

// ---------- transcribe (voice) ----------------------------------------------

export async function transcribeAudio(blob: Blob, language?: string): Promise<string> {
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  if (language) form.append('language', language);
  const res = await fetch(`${BASE}/api/transcribe`, { method: 'POST', body: form });
  if (!res.ok) throw await safeError(res);
  const data = await res.json();
  return data.text as string;
}

// ---------- maps (Naver-first, Tier 2 fallback) -----------------------------

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
  message?: string;
}

export async function searchMapNearby(opts: {
  lat?: number;
  lng?: number;
  type?: string;
  radius?: number;
  keyword?: string;
}): Promise<MapNearbyResult> {
  const params = new URLSearchParams({
    type:   opts.type   || 'hospital',
    radius: String(opts.radius || 5000),
  });
  if (opts.lat != null) params.set('lat', String(opts.lat));
  if (opts.lng != null) params.set('lng', String(opts.lng));
  if (opts.keyword) params.set('keyword', opts.keyword);
  const res = await fetch(`${BASE}/api/maps/nearby?${params}`);
  if (!res.ok) throw await safeError(res);
  return res.json();
}

export async function getNavLink(lat: number, lng: number, name: string, locale?: string): Promise<string> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), name });
  if (locale) params.set('locale', locale);
  try {
    const res = await fetch(`${BASE}/api/maps/navlink?${params}`);
    if (!res.ok) throw new Error('navlink failed');
    const data = await res.json();
    return data.url as string;
  } catch {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
}
