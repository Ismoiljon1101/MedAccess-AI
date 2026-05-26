import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Activity, Globe2, Heart } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { getHealth } from '@/lib/api';

const LANGUAGES = [
  'English', 'Spanish', 'French', 'Portuguese', 'Arabic', 'Hindi',
  'Bengali', 'Urdu', 'Swahili', 'Amharic', 'Hausa', 'Uzbek',
  'Russian', 'Chinese', 'Indonesian', 'Turkish',
];

const TABS = [
  { to: '/',          label: 'Chat',      Icon: MessageCircle },
  { to: '/emergency', label: 'Emergency', Icon: Activity },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { language, setLanguage } = useAppStore();
  const location = useLocation();
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    getHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  return (
    <div className="app-shell">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="app-header">
        <Link to="/" className="flex items-center gap-2 text-white min-w-0">
          <Heart size={15} className="text-brand-400 shrink-0" />
          <span className="font-semibold text-sm tracking-tight truncate">MedAccess</span>
          <span className="rounded-full bg-brand-600/20 px-2 py-0.5 text-[9px] font-semibold text-brand-400 uppercase tracking-wider shrink-0">
            Patient
          </span>
        </Link>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Connection dot */}
          <div
            title={online === null ? 'Connecting…' : online ? 'Connected' : 'Offline'}
            className={`h-1.5 w-1.5 rounded-full ${
              online === null ? 'bg-slate-500' : online ? 'bg-ok-500' : 'bg-danger-500'
            }`}
          />
          {/* Language picker */}
          <div className="flex items-center gap-1">
            <Globe2 size={13} className="text-slate-500" />
            <select
              className="bg-transparent text-xs text-slate-400 outline-none cursor-pointer max-w-[80px]"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l} className="bg-surface-800 text-slate-100">{l}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* ── Disclaimer bar ────────────────────────────────────── */}
      <div className="app-disclaimer">
        Educational only — not a substitute for a doctor.&nbsp;
        For emergencies call&nbsp;<strong className="text-warn-400">112 / 911 / 999</strong>
      </div>

      {/* ── Main content (flex-1, overflow handled by each page) ── */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {children}
      </main>

      {/* ── Bottom tab navigation ─────────────────────────────── */}
      <nav className="app-bottom-nav">
        {TABS.map(({ to, label, Icon }) => {
          const active = location.pathname === to || (to === '/' && location.pathname === '/symptoms');
          return (
            <Link
              key={to}
              to={to}
              className={`app-tab ${active ? 'app-tab-active' : 'app-tab-inactive'}`}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.5} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
