/**
 * Welcome — first-time onboarding screen.
 * Collects name + phone (server identity key), language, city.
 * Creates Patient record in MongoDB via POST /api/patients.
 */
import { useState } from 'react';
import { ArrowRight, Globe2, Shield, Mic, Stethoscope, ChevronRight, Phone, Loader2, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { createPatient } from '@/lib/api';

const LANGUAGES = [
  'English', 'Spanish', 'French', 'Portuguese', 'Arabic',
  'Hindi', 'Korean', 'Japanese', 'Chinese', 'Russian',
  'Turkish', 'Indonesian',
];

type Step = 'hero' | 'setup';

export default function Welcome() {
  const { setPatientProfile, setLanguage } = useAppStore();
  const [step, setStep] = useState<Step>('hero');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [lang, setLang] = useState('English');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    const trimmedName  = name.trim();
    const trimmedPhone = phone.trim().replace(/\s/g, '');

    if (!trimmedName) { setError('Please enter your name'); return; }
    if (!trimmedPhone) { setError('Phone number is required to link your records'); return; }
    setError(null);
    setLoading(true);

    try {
      const patient = await createPatient({
        fullName:           trimmedName,
        phone:              trimmedPhone,
        city:               city.trim() || undefined,
        country:            'South Korea',
        preferredLanguage:  lang,
        knownAllergies:     [],
        chronicConditions:  [],
        currentMedications: [],
      });

      setPatientProfile({
        fullName:        trimmedName,
        phone:           trimmedPhone,
        serverPatientId: patient._id,
        city:            city.trim() || undefined,
      });
      setLanguage(lang);
    } catch {
      // Server unreachable — still allow local use
      setPatientProfile({
        fullName: trimmedName,
        phone:    trimmedPhone,
        city:     city.trim() || undefined,
      });
      setLanguage(lang);
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    setPatientProfile({ fullName: 'Guest', phone: '' });
  }

  if (step === 'hero') {
    return (
      <div className="welcome-hero">
        <div className="welcome-grid" aria-hidden="true" />

        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-brand-500/12 blur-[110px]" />
          <div className="absolute top-24 right-[-60px] h-[320px] w-[320px] rounded-full bg-violet-600/8 blur-[90px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[280px] w-[560px] rounded-full bg-brand-600/8 blur-[110px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm px-6 pt-[calc(4rem+env(safe-area-inset-top,0px))] pb-8">
          <div className="animate-fade-up flex flex-col items-center gap-5">
            <div className="relative">
              <div className="welcome-logo-ring" />
              <div className="welcome-logo-inner">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                  <rect x="14" y="2" width="8" height="32" rx="4" fill="currentColor" className="text-brand-400" />
                  <rect x="2" y="14" width="32" height="8" rx="4" fill="currentColor" className="text-brand-400" />
                </svg>
              </div>
              <div className="absolute inset-0 rounded-3xl border border-brand-500/20 animate-ping opacity-25" />
            </div>
            <div className="text-center">
              <h1 className="welcome-title">MedAccess AI</h1>
              <p className="welcome-subtitle">Your AI Health Companion</p>
            </div>
          </div>

          <div className="animate-fade-up-delay-1 flex flex-col gap-2.5 w-full">
            {[
              { icon: Stethoscope, label: 'AI symptom analysis & triage',  color: 'text-brand-400' },
              { icon: Mic,         label: 'Voice mode — speak, don\'t type', color: 'text-violet-400' },
              { icon: Globe2,      label: '12+ languages supported',          color: 'text-ok-400'  },
              { icon: Shield,      label: 'Private — your data, your control', color: 'text-warn-400' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="welcome-feature-pill">
                <Icon size={16} className={`${color} shrink-0`} strokeWidth={1.8} />
                <span className="text-sm text-ink-200">{label}</span>
              </div>
            ))}
          </div>

          <div className="animate-fade-up-delay-2 flex flex-col gap-3 w-full">
            <button type="button" onClick={() => setStep('setup')} className="btn-primary-hero">
              Get Started <ArrowRight size={18} />
            </button>
            <button type="button" onClick={handleSkip} className="btn-ghost-hero">
              Use anonymously (no record linking)
            </button>
          </div>
        </div>

        <p className="relative z-10 mb-6 text-[11px] text-ink-500 text-center max-w-xs px-4">
          Educational only · Not a substitute for a doctor<br />
          Emergency: <a href="tel:119" className="text-danger-400 font-medium">119</a>
          {' · '}<a href="tel:112" className="text-danger-400 font-medium">112</a>
        </p>
      </div>
    );
  }

  return (
    <div className="welcome-setup">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-brand-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[280px] w-[280px] rounded-full bg-violet-600/8 blur-[90px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-6 space-y-5">
        <div className="animate-fade-up pt-[calc(3rem+env(safe-area-inset-top,0px))]">
          <button type="button" onClick={() => setStep('hero')} className="touch-target-sm text-xs text-ink-400 hover:text-ink-200 transition mb-4 inline-flex items-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
            ← Back
          </button>
          <h2 className="text-2xl font-bold text-ink-100 tracking-tight">Quick setup</h2>
          <p className="text-sm text-ink-400 mt-0.5">Takes 10 seconds</p>
        </div>

        <div className="animate-fade-up-delay-1 welcome-form-card">
          <div>
            <label className="label">Your name</label>
            <input
              className="input"
              placeholder="e.g. Dilnoza"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              autoComplete="name"
            />
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <Phone size={11} /> Phone number <span className="text-danger-400">*</span>
            </label>
            <input
              className="input"
              type="tel"
              inputMode="tel"
              placeholder="+82 10 0000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            <p className="text-[11px] text-ink-500 mt-1.5">Used to link your records across visits</p>
          </div>

          <div>
            <label className="label flex items-center gap-1.5"><Globe2 size={11} /> Language</label>
            <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <p className="text-[11px] text-ink-500 mt-1.5">AI will respond in this language</p>
          </div>

          <div>
            <label className="label">City <span className="text-ink-500 font-normal">(optional)</span></label>
            <input
              className="input"
              placeholder="Your city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2">
              <AlertCircle size={14} className="text-danger-400 shrink-0" />
              <p className="text-xs text-danger-400">{error}</p>
            </div>
          )}
        </div>

        <div className="animate-fade-up-delay-2 space-y-3 pb-8">
          <button
            type="button"
            onClick={handleStart}
            disabled={loading}
            className="btn-primary-hero"
          >
            {loading
              ? <><Loader2 size={18} className="animate-spin" /> Setting up…</>
              : <>Enter MedAccess AI <ChevronRight size={18} /></>}
          </button>
          <button type="button" onClick={handleSkip} className="btn-ghost-hero">
            Use anonymously
          </button>

          <div className="flex items-start gap-2 rounded-2xl border border-ink-700/40 bg-ink-900/40 px-4 py-3">
            <Shield size={13} className="text-brand-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-ink-400 leading-relaxed">
              Your phone number is used only to link your medical records across visits. No password, no account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
