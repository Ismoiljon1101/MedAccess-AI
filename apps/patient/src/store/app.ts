import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  language: string;
  setLanguage: (l: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      language: 'English',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'medaccess-patient-prefs' },
  ),
);
