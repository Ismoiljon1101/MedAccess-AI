import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MODEL_ID } from '@/lib/models';

interface AppState {
  language: string;
  model: string;
  setLanguage: (lang: string) => void;
  setModel: (model: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      language: 'auto',
      model: DEFAULT_MODEL_ID,
      setLanguage: (language) => set({ language }),
      setModel: (model) => set({ model }),
    }),
    { name: 'medaccess-ai-prefs' }
  )
);
