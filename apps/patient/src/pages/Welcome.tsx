/**
 * Welcome — first-time onboarding screen.
 * Shown when no patient profile exists yet.
 * Collects name + language, stores locally, then enters the app.
 * Patient can also skip and use the app anonymously.
 */
import { useState } from 'react';
import { Heart, ArrowRight, Globe2, Shield, Mic, Stethoscope, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/app';

const LANGUAGES = [
  'English', 'Uzbek', 'Russian', 'Spanish', 'French', 'Arabic',
  'Hindi', 'Bengali', 'Swahili', 'Chinese', 'Turkish', 'Indonesian',
];

type Step = 'hero' | 'setup';

export default function Welcome() {
  const { setPatientProfile, setLanguage } = useAppStore();
  const [step, setStep] = useState<Step>('hero');
  const [name, setName] = useState('');
  const [lang, setLang] = useState('English');
  const [city, setCity] = useState('');

  function handleStart() {
    const profile = {
      fullName: name.trim() || 'Guest',
      city:     city.trim() || undefined,
      preferredLanguage: lang,
    };
    setPatientProfile(profile);
    setLanguage(lang);
  }

  function handleSkip() {
    setPatientProfile({ fullName: 'Guest' });
  }

  if (step === 'hero') {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-between px-6 py-12 overflow-hidden">
        {/* Background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-brand-500/10 blur-[120px]" />
          <div className="absolute top-20 right-[-80px] h-[350px] w-[350px] rounded-full bg-purple-600/8 blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[300px] w-[600px] rounded-full bg-brand-600/8 blur-[120px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm">

          {/* Logo */}
          <div className="animate-fade-up flex flex-col items-center gap-4 pt-8">
            <div className="relative">
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-brand-500/30 to-brand-700/20 border border-brand-500/30 flex items-center justify-center shadow-glow">
                <Heart size={36} className="text-brand-400" strokeWidth={1.8} />
              </div>
              {/* Glow pulse */}
              <div className="absolute inset-0 rounded-3xl border border-brand-500/20 animate-ping opacity-30" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white tracking-tight">MedAccess AI</h1>
              <p className="text-brand-400 text-sm font-medium mt-1 tracking-wide">Your AI Health Companion</p>
            </div>
          </div>

          {/* Tagline */}
          <div className="animate-fade-up-delay-1 text-center space-y-2">
            <p className="text-ink-200 text-base leading-relaxed">
              Free health guidance in your language —<br />
              wherever you are, whenever you need it.
            </p>
          </div>

          {/* Feature pills */}
          <div className="animate-fade-up-delay-2 flex flex-col gap-3 w-full">
            {[
              { icon: Stethoscope, text: 'AI symptom check & triage', color: 'text-brand-400' },
              { icon: Mic,         text: 'Voice mode — speak, don\'t type',  color: 'text-purple-400' },
              { icon: Globe2,      text: '12+ languages, auto-detected',      color: 'text-ok-400'  },
              { icon: Shield,      text: 'Private — nothing stored on servers', color: 'text-warn-400' },
            ].map(({ icon: Icon, text, color }) => (
              <div key={text} className="flex items-center gap-3 rounded-2xl border border-ink-700/50 bg-ink-900/50 backdrop-blur-sm px-4 py-3">
                <Icon size={18} className={`${color} shrink-0`} strokeWidth={1.8} />
                <p className="text-sm text-ink-200">{text}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="animate-fade-up-delay-3 flex flex-col gap-3 w-full pb-4">
            <button
              type="button"
              onClick={() => setStep('setup')}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-brand-500/50 bg-brand-500/20 py-4 text-base font-semibold text-brand-400 hover:bg-brand-500/30 hover:shadow-glow transition-all"
            >
              Get Started <ArrowRight size={18} />
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="w-full text-sm text-ink-400 hover:text-ink-200 transition py-2"
            >
              Skip for now — use anonymously
            </button>
          </div>
        </div>

        {/* Bottom disclaimer */}
        <p className="relative z-10 text-[11px] text-ink-500 text-center max-w-xs">
          Educational only · Not a substitute for a doctor · For emergencies call 112 / 911 / 999
        </p>
      </div>
    );
  }

  // ── Setup step ────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-brand-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-purple-600/8 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-6">

        {/* Back + title */}
        <div className="animate-fade-up">
          <button
            type="button"
            onClick={() => setStep('hero')}
            className="text-xs text-ink-400 hover:text-ink-200 transition mb-5 flex items-center gap-1"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <Heart size={18} className="text-brand-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Quick setup</h2>
              <p className="text-xs text-ink-400">Takes 10 seconds</p>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="animate-fade-up-delay-1 rounded-3xl border border-ink-700/70 bg-ink-900/80 backdrop-blur-md p-6 space-y-5 shadow-xl shadow-black/40">

          <div>
            <label className="label">Your name</label>
            <input
              className="input"
              placeholder="e.g. Dilnoza"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <p className="text-[11px] text-ink-500 mt-1.5">Used to personalise your experience. Stays on your device.</p>
          </div>

          <div>
            <label className="label flex items-center gap-1.5"><Globe2 size={11} /> Language</label>
            <select
              className="input"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <p className="text-[11px] text-ink-500 mt-1.5">AI will respond in this language.</p>
          </div>

          <div>
            <label className="label">City <span className="text-ink-500 font-normal normal-case">(optional)</span></label>
            <input
              className="input"
              placeholder="e.g. Tashkent"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <p className="text-[11px] text-ink-500 mt-1.5">Helps Find Care sort nearby facilities.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="animate-fade-up-delay-2 space-y-3">
          <button
            type="button"
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-brand-500/50 bg-brand-500/20 py-4 text-base font-semibold text-brand-400 hover:bg-brand-500/30 hover:shadow-glow transition-all"
          >
            Enter MedAccess AI <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="w-full text-sm text-ink-400 hover:text-ink-200 transition py-2"
          >
            Skip — enter anonymously
          </button>
        </div>

        {/* Privacy note */}
        <div className="animate-fade-up-delay-3 flex items-start gap-2 rounded-2xl border border-ink-700/40 bg-ink-900/40 px-4 py-3">
          <Shield size={13} className="text-brand-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-ink-400 leading-relaxed">
            Your data never leaves your device. No account, no email, no server storage. You can delete everything in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
