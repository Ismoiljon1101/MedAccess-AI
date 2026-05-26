import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Metadata about a past chat session (persisted locally)
export interface ChatSessionMeta {
  sessionId: string;
  preview: string;      // first user message (truncated)
  messageCount: number;
  language: string;
  createdAt: number;    // Unix ms
  updatedAt: number;
}

interface AppState {
  // ── Preferences ───────────────────────────────────
  language: string;
  setLanguage: (l: string) => void;

  fontSize: 'sm' | 'md' | 'lg';
  setFontSize: (s: 'sm' | 'md' | 'lg') => void;

  voiceAutoPlay: boolean;
  setVoiceAutoPlay: (v: boolean) => void;

  // ── Chat history (local) ──────────────────────────
  chatHistory: ChatSessionMeta[];
  upsertSession: (meta: Omit<ChatSessionMeta, 'updatedAt'> & { updatedAt?: number }) => void;
  removeSession: (sessionId: string) => void;
  clearHistory: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Preferences
      language:       'English',
      fontSize:       'md',
      voiceAutoPlay:  false,

      setLanguage:      (language)      => set({ language }),
      setFontSize:      (fontSize)      => set({ fontSize }),
      setVoiceAutoPlay: (voiceAutoPlay) => set({ voiceAutoPlay }),

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
          // Newest first, cap at 50 entries
          return { chatHistory: [entry, ...s.chatHistory].slice(0, 50) };
        }),

      removeSession: (sessionId) =>
        set((s) => ({ chatHistory: s.chatHistory.filter((h) => h.sessionId !== sessionId) })),

      clearHistory: () => set({ chatHistory: [] }),
    }),
    { name: 'medaccess-patient-prefs' },
  ),
);
