import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ClipboardList,
  FileImage,
  Globe2,
  Languages,
  Mic,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const MODULES = [
  {
    to: '/interview',
    icon: MessagesSquare,
    title: 'Interview',
    desc: 'Conversational diagnostic intake. The copilot asks one focused question at a time and grounds answers in our medical knowledge base.',
  },
  {
    to: '/symptoms',
    icon: ClipboardList,
    title: 'Symptom Analysis',
    desc: 'Enter symptoms + patient context, get a ranked differential with calibrated probabilities, red flags, and next-step suggestions.',
  },
  {
    to: '/reports',
    icon: FileImage,
    title: 'Report Reading',
    desc: 'Upload an ECG, X-ray, lab photo, or dermatology image. Multimodal vision returns a structured plain-language reading.',
  },
  {
    to: '/triage',
    icon: Activity,
    title: 'Triage',
    desc: 'Manchester-style emergency triage. Returns a color level, target time to care, recommended actions, and warning signs.',
  },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Provider-agnostic LLMs',
    desc: 'One OpenRouter key gives runtime access to Claude, GPT, Gemini, Llama, DeepSeek and more.',
  },
  {
    icon: Languages,
    title: 'Multilingual',
    desc: 'Auto-detect or pick from 16+ languages. Responses mirror the user.',
  },
  {
    icon: Mic,
    title: 'Voice-first',
    desc: 'Whisper for high-quality multilingual STT, with browser Web Speech as fallback.',
  },
  {
    icon: Globe2,
    title: 'Offline-friendly PWA',
    desc: 'Installable on phones. Works on the spotty connectivity of rural clinics.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety-first prompts',
    desc: 'Hard-coded red-flag escalation, explicit uncertainty, no fabricated dosages.',
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <section className="card card-pad relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent-500/40 bg-accent-500/10 px-3 py-1 text-xs font-medium text-accent-400">
            <Sparkles size={12} /> AI Doctor Copilot · v0.1 MVP
          </div>
          <h1 className="mt-4 font-display text-3xl tracking-tight text-white md:text-4xl">
            MedAccess AI
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-200">
            An end-to-end clinical decision-support copilot built for frontline providers in
            rural and underserved areas. Multilingual, voice-first, multimodal — runs on any
            phone or laptop, demos in under a minute.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/interview" className="btn-primary">
              Start a patient interview <ArrowRight size={14} />
            </Link>
            <Link to="/triage" className="btn">
              Run a triage demo
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-300">
          Core modules
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {MODULES.map(({ to, icon: Icon, title, desc }) => (
            <Link
              key={to}
              to={to}
              className="card card-pad group transition hover:border-accent-500/50 hover:shadow-glow"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
                  <Icon size={18} />
                </div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-200">{desc}</p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent-400 opacity-0 transition group-hover:opacity-100">
                Open module <ArrowRight size={12} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-300">
          What makes it serious
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card card-pad">
              <div className="flex items-center gap-2.5 text-white">
                <Icon size={16} className="text-accent-400" />
                <span className="font-semibold">{title}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-200">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
