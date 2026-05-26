import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Heart, Globe2 } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { getHealth } from '@/lib/api';

const LANGUAGES = [
  'English', 'Spanish', 'French', 'Portuguese', 'Arabic', 'Hindi',
  'Bengali', 'Urdu', 'Swahili', 'Amharic', 'Hausa', 'Uzbek',
  'Russian', 'Chinese', 'Indonesian', 'Turkish',
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
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-surface-700 bg-surface-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-white">
            <Heart size={18} className="text-brand-400" />
            <span className="font-semibold tracking-tight">MedAccess</span>
            <span className="rounded-full bg-brand-600/20 px-2 py-0.5 text-[10px] font-medium text-brand-400">Patient</span>
          </Link>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                online === null ? 'bg-slate-500' : online ? 'bg-ok-500' : 'bg-danger-500'
              }`}
              title={online === null ? 'Connecting…' : online ? 'Connected' : 'Offline'}
            />
            <div className="flex items-center gap-1.5">
              <Globe2 size={14} className="text-slate-400" />
              <select
                className="bg-transparent text-sm text-slate-300 outline-none cursor-pointer"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l} className="bg-surface-800">{l}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Disclaimer */}
      <div className="border-b border-warn-500/30 bg-warn-500/10 px-4 py-2 text-center text-xs text-warn-400">
        This is an educational tool, not a substitute for a doctor. For emergencies, call your local emergency number immediately.
      </div>

      {/* Nav */}
      <nav className="border-b border-surface-700 bg-surface-800">
        <div className="mx-auto flex max-w-2xl gap-1 px-4 py-2">
          {[
            { to: '/symptoms', label: 'Check Symptoms', icon: Heart },
            { to: '/emergency', label: 'Emergency?', icon: Activity },
          ].map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                location.pathname === to
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={14} /> {label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-surface-700 px-4 py-4 text-center text-xs text-slate-500">
        MedAccess AI — Not a medical device. Always consult a licensed clinician.
        <span className="mx-2">·</span>
        <Link to="http://localhost:5173" className="text-brand-400 hover:underline">
          Clinician portal →
        </Link>
      </footer>
    </div>
  );
}
