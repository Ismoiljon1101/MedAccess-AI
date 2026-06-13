import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatSessionMeta {
  sessionId: string;
  preview: string;
  messageCount: number;
  language: string;
  createdAt: number;
  updatedAt: number;
}

// phone is the server identity key (no auth, just phone lookup)
export interface PatientProfile {
  fullName: string;
  phone?: string;           // server identity key (empty = anonymous)
  serverPatientId?: string;
  email?: string;
  dob?: string;
  sex?: 'male' | 'female' | 'other';
  bloodType?: string;
  city?: string;
  country?: string;
  knownAllergies?: string;
  chronicConditions?: string;
  currentMedications?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface AppointmentMeta {
  appointmentId: string;
  facilityId: string;
  facilityName: string;
  facilityCity?: string;
  facilityType?: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string;            // YYYY-MM-DD (alias: scheduledDate)
  startTime: string;       // HH:MM
  endTime?: string;        // HH:MM
  scheduledDate?: string;  // from server response
  scheduledTime?: string;
  scheduledEndTime?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  bookedAt: number;
}

interface AppState {
  language: string;
  setLanguage: (l: string) => void;

  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;

  fontSize: 'sm' | 'md' | 'lg';
  setFontSize: (s: 'sm' | 'md' | 'lg') => void;

  voiceAutoPlay: boolean;
  setVoiceAutoPlay: (v: boolean) => void;

  patientProfile: PatientProfile | null;
  setPatientProfile: (p: PatientProfile) => void;
  clearPatientProfile: () => void;

  appointments: AppointmentMeta[];
  addAppointment: (a: AppointmentMeta) => void;
  updateAppointmentStatus: (appointmentId: string, status: AppointmentMeta['status']) => void;
  clearAppointments: () => void;

  chatHistory: ChatSessionMeta[];
  upsertSession: (meta: Omit<ChatSessionMeta, 'updatedAt'> & { updatedAt?: number }) => void;
  removeSession: (sessionId: string) => void;
  clearHistory: () => void;

  // The chat the user is currently in — persisted so navigating away from the
  // Chat tab and back resumes the same conversation instead of starting fresh.
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      language:      'English',
      theme:         'dark',
      fontSize:      'md',
      voiceAutoPlay: false,

      setLanguage:      (language)      => set({ language }),
      setTheme:         (theme)         => set({ theme }),
      setFontSize:      (fontSize)      => set({ fontSize }),
      setVoiceAutoPlay: (voiceAutoPlay) => set({ voiceAutoPlay }),

      patientProfile: null,
      setPatientProfile: (patientProfile) => set({ patientProfile }),
      clearPatientProfile: () => set({ patientProfile: null }),

      appointments: [],
      addAppointment: (appt) =>
        set((s) => ({ appointments: [appt, ...s.appointments].slice(0, 100) })),
      updateAppointmentStatus: (appointmentId, status) =>
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.appointmentId === appointmentId ? { ...a, status } : a,
          ),
        })),
      clearAppointments: () => set({ appointments: [] }),

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
        set((s) => ({
          chatHistory: s.chatHistory.filter((h) => h.sessionId !== sessionId),
          activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
        })),
      clearHistory: () => set({ chatHistory: [], activeSessionId: null }),

      activeSessionId: null,
      setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
    }),
    { name: 'medaccess-patient-prefs' },
  ),
);
