import { Link } from 'react-router-dom';
import { Heart, Activity, Mic, Globe2, ShieldCheck, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center space-y-4 pt-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600/20 ring-1 ring-brand-500/30">
          <Heart size={28} className="text-brand-400" />
        </div>
        <h1 className="text-2xl font-semibold text-white">How are you feeling today?</h1>
        <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
          Describe your symptoms and get guidance in your language — free, voice-friendly,
          and available anywhere.
        </p>
      </section>

      {/* Main actions */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/symptoms"
          className="card card-pad group space-y-3 transition hover:border-brand-500/50 hover:shadow-glow"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20 text-brand-400 ring-1 ring-brand-500/30">
            <Heart size={18} />
          </div>
          <h2 className="text-base font-semibold text-white">Check my symptoms</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Tell me what you're experiencing. I'll help you understand what might be wrong
            and what to do next.
          </p>
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand-400 opacity-0 group-hover:opacity-100 transition">
            Get started <ArrowRight size={12} />
          </div>
        </Link>

        <Link
          to="/emergency"
          className="card card-pad group space-y-3 transition hover:border-danger-500/40"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-500/15 text-danger-400 ring-1 ring-danger-500/30">
            <Activity size={18} />
          </div>
          <h2 className="text-base font-semibold text-white">Is this an emergency?</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Not sure if you need to go to the hospital right now? Describe the situation
            and get an immediate answer.
          </p>
          <div className="flex items-center gap-1.5 text-xs font-medium text-danger-400 opacity-0 group-hover:opacity-100 transition">
            Check now <ArrowRight size={12} />
          </div>
        </Link>
      </section>

      {/* Features */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Why use MedAccess</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Globe2,      title: 'Your language',  desc: '16+ languages, auto-detected' },
            { icon: Mic,         title: 'Voice-friendly', desc: 'Speak instead of type' },
            { icon: ShieldCheck, title: 'Safe & honest',  desc: 'Never replaces a real doctor' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card card-pad flex items-start gap-3">
              <Icon size={16} className="mt-0.5 shrink-0 text-brand-400" />
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Emergency CTA */}
      <section className="card card-pad border-danger-500/30 bg-danger-500/5 text-center space-y-2">
        <p className="text-sm font-semibold text-danger-400">Having a life-threatening emergency?</p>
        <p className="text-xs text-slate-400">
          Do not use this app. Call your local emergency number (<strong className="text-white">112 / 911 / 999</strong>) immediately.
        </p>
      </section>
    </div>
  );
}
