import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MODEL_ID } from '@/lib/models';

interface AppState {
  language: string;
  model: string;
  theme: 'dark' | 'light';
  setLanguage: (lang: string) => void;
  setModel: (model: string) => void;
  setTheme: (t: 'dark' | 'light') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      language: 'auto',
      model: DEFAULT_MODEL_ID,
      theme: 'dark',
      setLanguage: (language) => set({ language }),
      setModel: (model) => set({ model }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'medaccess-ai-prefs' }
  )
);
