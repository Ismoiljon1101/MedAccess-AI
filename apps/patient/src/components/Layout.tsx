import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  MessageCircle, MapPin, ClipboardList, SlidersHorizontal,
  Heart, User, Phone,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { getHealth } from '@/lib/api';

const TABS = [
  { to: '/',          label: 'Chat',      Icon: MessageCircle,    exact: true  },
  { to: '/find-care', label: 'Find Care', Icon: MapPin,           exact: false },
  { to: '/records',   label: 'Records',   Icon: ClipboardList,    exact: false },
  { to: '/settings',  label: 'Settings',  Icon: SlidersHorizontal,exact: false },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { fontSize, patientProfile } = useAppStore();
  const location = useLocation();
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    getHealth().then(() => setOnline(true)).catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('text-size-sm', 'text-size-md', 'text-size-lg');
    document.documentElement.classList.add(`text-size-${fontSize}`);
  }, [fontSize]);

  const initials = patientProfile?.fullName?.trim()
    ? patientProfile.fullName.trim().split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : null;

  return (
    <div className="app-shell">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="app-header">
        <Link to="/" className="flex items-center gap-2.5 text-white min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/40 to-brand-700/20 border border-brand-500/30">
            <Heart size={13} className="text-brand-400" />
          </div>
          <span className="font-semibold text-sm tracking-tight truncate text-ink-100">MedAccess AI</span>
          <span className="rounded-full bg-brand-500/15 border border-brand-500/25 px-2 py-0.5 text-[9px] font-semibold text-brand-400 uppercase tracking-wider shrink-0">
            Patient
          </span>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {/* Online status */}
          <div
            title={online === null ? 'Connecting…' : online ? 'Connected' : 'Offline'}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              online === null ? 'bg-ink-500' : online ? 'bg-ok-500' : 'bg-danger-500'
            }`}
          />

          {/* Emergency quick-dial — min 44px tap target */}
          <Link
            to="/emergency"
            aria-label="Emergency triage assessment"
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
              location.pathname === '/emergency'
                ? 'text-danger-400 bg-danger-500/15'
                : 'text-danger-400/70 hover:text-danger-400 hover:bg-danger-500/10'
            }`}
          >
            <Phone size={18} />
          </Link>

          {/* Profile avatar — min 44px tap target */}
          <Link
            to="/profile"
            aria-label="My Profile"
            className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-all ${
              location.pathname === '/profile'
                ? 'border-brand-500/50 bg-brand-500/20 text-brand-400'
                : 'border-ink-700 bg-ink-800 text-ink-400 hover:border-ink-600 hover:text-ink-200'
            }`}
          >
            {initials
              ? <span className="text-xs font-bold text-brand-400">{initials}</span>
              : <User size={16} />
            }
          </Link>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {children}
      </main>

      {/* ── Bottom tab bar ──────────────────────────────────────── */}
      <nav className="app-bottom-nav">
        {TABS.map(({ to, label, Icon, exact }) => {
          const active = exact
            ? location.pathname === to
            : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`app-tab ${active ? 'app-tab-active' : 'app-tab-inactive'}`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-brand-500/15' : ''}`}>
                <Icon size={18} strokeWidth={active ? 2.2 : 1.6} />
              </div>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
