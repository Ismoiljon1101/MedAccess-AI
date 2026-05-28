import { Moon, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useAppStore } from '@/store/app';

const LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en',   label: 'English' },
  { code: 'uz',   label: 'Uzbek' },
  { code: 'ru',   label: 'Russian' },
  { code: 'es',   label: 'Spanish' },
  { code: 'hi',   label: 'Hindi' },
  { code: 'fr',   label: 'French' },
  { code: 'ko',   label: 'Korean' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 space-y-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-white">{label}</p>
        {sub && <p className="text-[11px] text-ink-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { language, setLanguage } = useAppStore();
  const { user, logout } = useAuthStore();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-white">Settings</h1>

      <Section title="Language">
        <Row label="Portal language" sub="Affects the AI response language when set to a specific locale">
          <select
            className="input w-auto min-w-[160px]"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Notifications">
        <Row label="New referral alert" sub="Notify when a patient is referred via MA Agent">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" defaultChecked className="sr-only peer" />
            <div className="w-9 h-5 bg-ink-700 rounded-full peer peer-checked:bg-accent-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
          </label>
        </Row>
        <Row label="Urgent case alert" sub="Push notification for emergency + urgent cases">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" defaultChecked className="sr-only peer" />
            <div className="w-9 h-5 bg-ink-700 rounded-full peer peer-checked:bg-accent-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
          </label>
        </Row>
        <p className="text-[11px] text-ink-600">Push notifications require PWA install + browser permission. Coming fully in v0.2.</p>
      </Section>

      <Section title="Appearance">
        <Row label="Theme" sub="Dark mode only for v0.1">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-ink-800 border border-ink-700 text-xs text-ink-300">
            <Moon size={13} /> Dark
          </div>
        </Row>
      </Section>

      <Section title="Account">
        <Row label="Role" sub={`Signed in as ${user?.name}`}>
          <span className="capitalize text-xs px-2.5 py-1 rounded-full bg-accent-500/15 text-accent-400 border border-accent-500/30">
            {user?.role}
          </span>
        </Row>
        <Row label="Authentication" sub="Email/password auth coming in v0.2">
          <span className="text-[11px] text-ink-500">v0.2</span>
        </Row>
        <div className="pt-2 border-t border-ink-700/40">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition"
          >
            <LogOut size={14} /> Sign out of portal
          </button>
        </div>
      </Section>

      <Section title="About">
        <div className="space-y-2 text-xs text-ink-400">
          <div className="flex justify-between"><span>Version</span><span className="text-ink-300">v0.1.0</span></div>
          <div className="flex justify-between"><span>LLM Provider</span><span className="text-ink-300">OpenRouter (Qwen 3.6 Plus)</span></div>
          <div className="flex justify-between"><span>RAG Corpus</span><span className="text-ink-300">31 clinical documents</span></div>
          <div className="flex justify-between"><span>Image ML</span><span className="text-ink-300">Python sidecar (Phase 1 in progress)</span></div>
        </div>
        <p className="text-[11px] text-ink-600 pt-2 border-t border-ink-700/40">
          MedAccess AI is a clinical decision-support copilot. It is not a certified medical device and does not replace clinical judgment.
        </p>
      </Section>
    </div>
  );
}
