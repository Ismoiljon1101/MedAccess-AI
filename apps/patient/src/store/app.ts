import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Chat session ──────────────────────────────────────────────────────────────
export interface ChatSessionMeta {
  sessionId: string;
  preview: string;
  messageCount: number;
  language: string;
  createdAt: number;
  updatedAt: number;
}

// ── Patient profile (stored locally, v0.1 — no auth) ─────────────────────────
export interface PatientProfile {
  fullName: string;
  phone?: string;
  email?: string;
  dob?: string;          // YYYY-MM-DD
  sex?: 'male' | 'female' | 'other';
  bloodType?: string;    // A+, A-, B+, etc.
  city?: string;
  country?: string;
  knownAllergies?: string;
  chronicConditions?: string;
  currentMedications?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

// ── Booked appointments (stored locally) ─────────────────────────────────────
export interface AppointmentMeta {
  appointmentId: string;
  facilityId: string;
  facilityName: string;
  facilityCity: string;
  facilityType: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM
  endTime: string;       // HH:MM
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  bookedAt: number;      // Unix ms
}

interface AppState {
  // ── Preferences ──────────────────────────────────────────────
  language: string;
  setLanguage: (l: string) => void;

  fontSize: 'sm' | 'md' | 'lg';
  setFontSize: (s: 'sm' | 'md' | 'lg') => void;

  voiceAutoPlay: boolean;
  setVoiceAutoPlay: (v: boolean) => void;

  // ── Patient profile ───────────────────────────────────────────
  patientProfile: PatientProfile | null;
  setPatientProfile: (p: PatientProfile) => void;
  clearPatientProfile: () => void;

  // ── Booked appointments ───────────────────────────────────────
  appointments: AppointmentMeta[];
  addAppointment: (a: AppointmentMeta) => void;
  clearAppointments: () => void;

  // ── Chat history ──────────────────────────────────────────────
  chatHistory: ChatSessionMeta[];
  upsertSession: (meta: Omit<ChatSessionMeta, 'updatedAt'> & { updatedAt?: number }) => void;
  removeSession: (sessionId: string) => void;
  clearHistory: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Preferences
      language:      'English',
      fontSize:      'md',
      voiceAutoPlay: false,

      setLanguage:      (language)      => set({ language }),
      setFontSize:      (fontSize)      => set({ fontSize }),
      setVoiceAutoPlay: (voiceAutoPlay) => set({ voiceAutoPlay }),

      // Patient profile
      patientProfile: null,
      setPatientProfile: (patientProfile) => set({ patientProfile }),
      clearPatientProfile: () => set({ patientProfile: null }),

      // Appointments
      appointments: [],
      addAppointment: (appt) =>
        set((s) => ({ appointments: [appt, ...s.appointments].slice(0, 100) })),
      clearAppointments: () => set({ appointments: [] }),

      // History
      chatHistory: [],

      upsertSession: (meta) =>
        set((s) => {
          const now = Date.now();
          const entry: ChatSessionMeta = { ...meta, updatedAt: meta.updatedAt ?? now };
          const existing = s.chatHistory.findIndex((h) => h.sessionId === meta.sessionId);
          if (existing >= 0) {
            const updated = [...s.chatHistory];
            updated[existing] = entry;
            return { chatHistory: updated };
          }
          return { chatHistory: [entry, ...s.chatHistory].slice(0, 50) };
        }),

      removeSession: (sessionId) =>
        set((s) => ({ chatHistory: s.chatHistory.filter((h) => h.sessionId !== sessionId) })),

      clearHistory: () => set({ chatHistory: [] }),
    }),
    { name: 'medaccess-patient-prefs' },
  ),
);
