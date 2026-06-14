import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, AccountRole, RegisterRequest } from '@medaccess/shared';

export type Role = AccountRole;
export type { AuthUser };

const BASE = import.meta.env.VITE_API_BASE || '';

async function parseError(res: Response): Promise<string> {
  try {
    const d = await res.json();
    return d.message || d.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  /** True until the persisted token has been validated against the server. */
  bootstrapped: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  /** Frictionless demo entry — no account/password, no server call. */
  guestLogin: (u: { name: string; role: Role; specialty?: string; occupation?: string; clinicName?: string }) => void;
  logout: () => void;
  /** Validate a persisted token on app load; clears it if invalid. */
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      bootstrapped: false,

      login: async (email, password) => {
        const res = await fetch(`${BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) throw new Error(await parseError(res));
        const { token, user } = await res.json();
        set({ token, user, bootstrapped: true });
      },

      register: async (data) => {
        const res = await fetch(`${BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(await parseError(res));
        const { token, user } = await res.json();
        set({ token, user, bootstrapped: true });
      },

      guestLogin: (u) => set({
        token: null,
        bootstrapped: true,
        user: {
          id: `guest_${Math.random().toString(36).slice(2, 8)}`,
          email: '',
          name: u.name,
          role: u.role,
          specialty: u.specialty,
          occupation: u.occupation,
          clinicName: u.clinicName,
        },
      }),

      logout: () => set({ token: null, user: null }),

      bootstrap: async () => {
        const { token } = get();
        if (!token) { set({ bootstrapped: true }); return; }
        try {
          const res = await fetch(`${BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) { set({ token: null, user: null, bootstrapped: true }); return; }
          const { user } = await res.json();
          set({ user, bootstrapped: true });
        } catch {
          // Network error — keep the token, allow offline use of cached user.
          set({ bootstrapped: true });
        }
      },
    }),
    {
      name: 'medaccess-clinic-auth',
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
);

/** Non-react accessor for the current bearer token (used by the API client). */
export function getAuthToken(): string | null {
  return useAuthStore.getState().token;
}
