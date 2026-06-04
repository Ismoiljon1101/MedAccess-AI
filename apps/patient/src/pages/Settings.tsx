import { Globe2, Type, Volume2, Trash2, Info, ChevronRight, LogOut, User, Sun, Moon, PhoneCall } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useNavigate } from 'react-router-dom';

const LANGUAGES = [
  'English', 'Spanish', 'French', 'Portuguese', 'Arabic', 'Hindi',
  'Bengali', 'Urdu', 'Swahili', 'Amharic', 'Hausa', 'Uzbek',
  'Russian', 'Chinese', 'Indonesian', 'Turkish',
];

/** Row — min 44px height (HIG). Interactive rows get role+tabIndex for keyboard nav. */
function Row({
  icon, label, sublabel, children, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  const interactive = typeof onClick === 'function';
  return (
    <div
      className={`flex items-center gap-3 px-4 py-4 min-h-[56px] transition ${
        interactive ? 'cursor-pointer hover:bg-ink-800/60 active:bg-ink-800' : ''
      }`}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-700 text-ink-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {sublabel && <p className="text-xs text-ink-500 mt-0.5">{sublabel}</p>}
      </div>
      {children}
      {interactive && !children && <ChevronRight size={16} className="text-ink-600 shrink-0" />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-4 text-[11px] font-semibold uppercase tracking-widest text-ink-500">{title}</p>
      <div className="card divide-y divide-ink-700/60">{children}</div>
    </div>
  );
}

/** Toggle switch — 44px tap target */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-ink-900 ${
        checked ? 'bg-brand-500' : 'bg-ink-600'
      }`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  );
}

export default function Settings() {
  const {
    language, setLanguage,
    theme, setTheme,
    fontSize, setFontSize,
    voiceAutoPlay, setVoiceAutoPlay,
    chatHistory, clearHistory,
    patientProfile, clearPatientProfile,
    clearAppointments,
  } = useAppStore();
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 py-5 space-y-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-white">Settings</h1>

        {/* ── Language & Display ───────────────────────────────── */}
        <Section title="Language & Display">
          <Row icon={<Globe2 size={18} />} label="Response language" sublabel="AI answers in this language">
            <select
              className="rounded-xl border border-ink-600 bg-ink-700 px-3 py-2 text-sm text-ink-100 outline-none cursor-pointer focus:border-brand-500"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label="Select response language"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l} className="bg-ink-800">{l}</option>
              ))}
            </select>
          </Row>

          <Row
            icon={theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
            label="Theme"
            sublabel={theme === 'light' ? 'Light mode' : 'Dark mode'}
          >
            <Toggle
              checked={theme === 'light'}
              onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              label="Toggle light/dark theme"
            />
          </Row>

          <Row icon={<Type size={18} />} label="Text size" sublabel="Adjusts chat bubble text size">
            {/* Min 44px per button via py-2.5 */}
            <div className="flex rounded-xl border border-ink-600 overflow-hidden text-xs font-semibold">
              {(['sm', 'md', 'lg'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFontSize(s)}
                  aria-label={`Text size ${s === 'sm' ? 'small' : s === 'md' ? 'medium' : 'large'}`}
                  aria-pressed={fontSize === s}
                  className={`px-3 py-2.5 transition min-h-[44px] ${
                    fontSize === s
                      ? 'bg-brand-600 text-white'
                      : 'bg-ink-700 text-ink-400 hover:bg-ink-600'
                  }`}
                >
                  {s === 'sm' ? 'A' : s === 'md' ? 'A' : 'A'}
                  <span className="sr-only">{s}</span>
                </button>
              ))}
            </div>
          </Row>
        </Section>

        {/* ── Voice ──────────────────────────────────────────────── */}
        <Section title="Voice">
          <Row
            icon={<Volume2 size={18} />}
            label="Auto-play AI responses"
            sublabel="Speak AI answers aloud (requires browser TTS)"
          >
            <Toggle
              checked={voiceAutoPlay}
              onChange={() => setVoiceAutoPlay(!voiceAutoPlay)}
              label="Toggle voice auto-play"
            />
          </Row>
        </Section>

        {/* ── Data ──────────────────────────────────────────────── */}
        <Section title="Data & History">
          <Row
            icon={<Trash2 size={18} />}
            label="Clear chat history"
            sublabel={`${chatHistory.length} saved conversation${chatHistory.length !== 1 ? 's' : ''}`}
          >
            <button
              type="button"
              disabled={chatHistory.length === 0}
              onClick={() => { if (confirm('Clear all chat history?')) clearHistory(); }}
              aria-label="Clear chat history"
              className="rounded-xl border border-danger-500/40 px-4 py-2.5 text-xs font-semibold text-danger-400 hover:bg-danger-500/10 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            >
              Clear
            </button>
          </Row>

          <Row
            icon={<Info size={18} />}
            label="View all conversations"
            sublabel="Browse and resume past chats"
            onClick={() => navigate('/records')}
          />
        </Section>

        {/* ── Profile ────────────────────────────────────────────── */}
        <Section title="Profile">
          <Row
            icon={<User size={18} />}
            label={
              patientProfile?.fullName && patientProfile.fullName !== 'Guest'
                ? patientProfile.fullName
                : 'My Profile'
            }
            sublabel="Edit name, health info, emergency contact"
            onClick={() => navigate('/profile')}
          />

          <Row
            icon={<PhoneCall size={18} />}
            label="Emergency triage"
            sublabel="Check if a situation is an emergency"
            onClick={() => navigate('/emergency')}
          />

          <Row
            icon={<LogOut size={18} />}
            label="Reset & start over"
            sublabel="Clears profile and all local data"
          >
            <button
              type="button"
              aria-label="Reset all data"
              onClick={() => {
                if (confirm('This will clear your profile, chat history, and appointments. Continue?')) {
                  clearHistory();
                  clearAppointments();
                  clearPatientProfile();
                }
              }}
              className="rounded-xl border border-danger-500/40 px-4 py-2.5 text-xs font-semibold text-danger-400 hover:bg-danger-500/10 transition min-h-[44px]"
            >
              Reset
            </button>
          </Row>
        </Section>

        {/* ── About ──────────────────────────────────────────────── */}
        <Section title="About">
          <Row icon={<Info size={18} />} label="MedAccess AI" sublabel="Patient portal v0.1.0">
            <span className="text-xs text-ink-500 bg-ink-700 px-2 py-1 rounded-full">Beta</span>
          </Row>
          <div className="px-4 py-4 text-[11px] text-ink-500 leading-relaxed">
            MedAccess AI is an educational tool and does not provide medical diagnosis.
            Always consult a licensed clinician for medical decisions.
          </div>
        </Section>
      </div>
    </div>
  );
}
