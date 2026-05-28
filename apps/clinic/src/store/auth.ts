import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'doctor' | 'pharmacist' | 'admin';

export interface AuthUser {
  name: string;
  role: Role;
  specialty?: string;   // doctor: cardiologist, GP, etc.
  occupation?: string;  // pharmacist: Clinical Pharmacist, etc.
  licenseNo?: string;
  clinicName?: string;
}

interface AuthStore {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    { name: 'medaccess-clinic-auth' }
  )
);
