import { Globe2, Type, Volume2, Trash2, Info, ChevronRight, LogOut, User } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useNavigate } from 'react-router-dom';

const LANGUAGES = [
  'English', 'Spanish', 'French', 'Portuguese', 'Arabic', 'Hindi',
  'Bengali', 'Urdu', 'Swahili', 'Amharic', 'Hausa', 'Uzbek',
  'Russian', 'Chinese', 'Indonesian', 'Turkish',
];

function Row({
  icon, label, sublabel, children,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-700 text-slate-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {sublabel && <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{title}</p>
      <div className="card divide-y divide-surface-700">{children}</div>
    </div>
  );
}

export default function Settings() {
  const {
    language, setLanguage,
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

      {/* ── Language ──────────────────────────────────────────── */}
      <Section title="Language & Display">
        <Row icon={<Globe2 size={18} />} label="Response language" sublabel="AI answers in this language">
          <select
            className="rounded-lg border border-surface-600 bg-surface-700 px-3 py-1.5 text-sm text-slate-100 outline-none cursor-pointer"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l} className="bg-surface-800">{l}</option>
            ))}
          </select>
        </Row>

        <Row icon={<Type size={18} />} label="Text size" sublabel="Adjust chat bubble text">
          <div className="flex rounded-lg border border-surface-600 overflow-hidden text-xs font-medium">
            {(['sm', 'md', 'lg'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFontSize(s)}
                className={`px-3 py-1.5 transition ${
                  fontSize === s
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-700 text-slate-400 hover:bg-surface-600'
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      {/* ── Voice ─────────────────────────────────────────────── */}
      <Section title="Voice">
        <Row
          icon={<Volume2 size={18} />}
          label="Auto-play AI responses"
          sublabel="Speak AI answers aloud (requires browser TTS)"
        >
          <button
            type="button"
            role="switch"
            aria-checked={voiceAutoPlay}
            onClick={() => setVoiceAutoPlay(!voiceAutoPlay)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              voiceAutoPlay ? 'bg-brand-600' : 'bg-surface-600'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                voiceAutoPlay ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </Row>
      </Section>

      {/* ── History ───────────────────────────────────────────── */}
      <Section title="History">
        <Row
          icon={<Trash2 size={18} />}
          label="Clear chat history"
          sublabel={`${chatHistory.length} saved conversation${chatHistory.length !== 1 ? 's' : ''}`}
        >
          <button
            type="button"
            disabled={chatHistory.length === 0}
            onClick={() => { if (confirm('Clear all chat history?')) clearHistory(); }}
            className="rounded-lg border border-danger-500/40 px-3 py-1.5 text-xs font-medium text-danger-400 hover:bg-danger-500/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </Row>

        <div
          className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-surface-700/50 transition"
          onClick={() => navigate('/history')}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-700 text-slate-400">
            <Info size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">View all conversations</p>
            <p className="text-xs text-slate-500 mt-0.5">Browse and resume past chats</p>
          </div>
          <ChevronRight size={16} className="text-slate-600" />
        </div>
      </Section>

      {/* ── Profile ───────────────────────────────────────────── */}
      <Section title="Profile">
        <div
          className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-surface-700/50 transition"
          onClick={() => navigate('/profile')}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-700 text-slate-400">
            <User size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              {patientProfile?.fullName && patientProfile.fullName !== 'Guest'
                ? patientProfile.fullName
                : 'My Profile'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Edit name, health info, emergency contact</p>
          </div>
          <ChevronRight size={16} className="text-slate-600" />
        </div>

        <Row
          icon={<LogOut size={18} />}
          label="Reset & start over"
          sublabel="Clears profile and all local data"
        >
          <button
            type="button"
            onClick={() => {
              if (confirm('This will clear your profile, chat history, and appointments. Continue?')) {
                clearHistory();
                clearAppointments();
                clearPatientProfile();
              }
            }}
            className="rounded-lg border border-danger-500/40 px-3 py-1.5 text-xs font-medium text-danger-400 hover:bg-danger-500/10 transition"
          >
            Reset
          </button>
        </Row>
      </Section>

      {/* ── About ─────────────────────────────────────────────── */}
      <Section title="About">
        <Row icon={<Info size={18} />} label="MedAccess AI" sublabel="Patient portal v0.1.0">
          <span className="text-xs text-slate-500">Beta</span>
        </Row>
        <div className="px-4 py-4 text-[11px] text-slate-500 leading-relaxed">
          MedAccess AI is an educational tool and does not provide medical diagnosis.
          Always consult a licensed clinician for medical decisions.
        </div>
      </Section>
    </div>
    </div>
  );
}
