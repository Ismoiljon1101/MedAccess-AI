import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Activity, Globe2, Heart, History, Settings, MapPin, FolderOpen } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { getHealth } from '@/lib/api';

const TABS = [
  { to: '/',          label: 'Chat',      Icon: MessageCircle, exact: true },
  { to: '/find-care', label: 'Find Care', Icon: MapPin,        exact: false },
  { to: '/emergency', label: 'Emergency', Icon: Activity,      exact: false },
  { to: '/records',   label: 'Records',   Icon: FolderOpen,    exact: false },
  { to: '/settings',  label: 'Settings',  Icon: Settings,      exact: false },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { language, setLanguage, fontSize } = useAppStore();
  const location = useLocation();
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    getHealth().then(() => setOnline(true)).catch(() => setOnline(false));
  }, []);

  // Only show language picker on non-settings pages (settings has it inline)
  const isSettings = location.pathname === '/settings';

  // Apply fontSize to the whole app via a CSS class on body
  useEffect(() => {
    document.documentElement.classList.remove('text-size-sm', 'text-size-md', 'text-size-lg');
    document.documentElement.classList.add(`text-size-${fontSize}`);
  }, [fontSize]);

  return (
    <div className="app-shell">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="app-header">
        <Link to="/" className="flex items-center gap-2 text-white min-w-0">
          <Heart size={15} className="text-brand-400 shrink-0" />
          <span className="font-semibold text-sm tracking-tight truncate">MedAccess</span>
          <span className="rounded-full bg-brand-600/20 px-2 py-0.5 text-[9px] font-semibold text-brand-400 uppercase tracking-wider shrink-0">
            Patient
          </span>
        </Link>

        <div className="flex items-center gap-2.5 shrink-0">
          <div
            title={online === null ? 'Connecting…' : online ? 'Connected' : 'Offline'}
            className={`h-1.5 w-1.5 rounded-full ${
              online === null ? 'bg-slate-500' : online ? 'bg-ok-500' : 'bg-danger-500'
            }`}
          />
          {/* History icon */}
          <Link
            to="/history"
            title="Chat History"
            className={`flex items-center justify-center rounded-lg p-1.5 transition-colors ${
              location.pathname === '/history'
                ? 'text-brand-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <History size={16} />
          </Link>
          {!isSettings && (
            <div className="flex items-center gap-1">
              <Globe2 size={13} className="text-slate-500" />
              <select
                className="bg-transparent text-xs text-slate-400 outline-none cursor-pointer max-w-[80px]"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {['English','Spanish','French','Portuguese','Arabic','Hindi','Bengali','Urdu','Swahili','Amharic','Hausa','Uzbek','Russian','Chinese','Indonesian','Turkish'].map((l) => (
                  <option key={l} value={l} className="bg-surface-800 text-slate-100">{l}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* ── Disclaimer ──────────────────────────────────────────── */}
      <div className="app-disclaimer">
        Educational only — not a substitute for a doctor.&nbsp;
        For emergencies call&nbsp;<strong className="text-warn-400">112 / 911 / 999</strong>
      </div>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {children}
      </main>

      {/* ── Bottom tab bar ──────────────────────────────────────── */}
      <nav className="app-bottom-nav">
        {TABS.map(({ to, label, Icon, exact }) => {
          const active = exact
            ? location.pathname === to || location.pathname === '/symptoms'
            : location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`app-tab ${active ? 'app-tab-active' : 'app-tab-inactive'}`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.5} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
