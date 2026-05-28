import { Link } from 'react-router-dom';
import { Heart, Activity, Mic, Globe2, ShieldCheck, ArrowRight, MapPin, FileText } from 'lucide-react';
import { useAppStore } from '@/store/app';

export default function Home() {
  const { patientProfile } = useAppStore();
  const firstName = patientProfile?.fullName?.split(' ')[0] ?? '';

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
      <div className="space-y-6 py-5 max-w-lg mx-auto">

        {/* Greeting */}
        <section className="text-center space-y-3 pt-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/30 to-brand-700/20 border border-brand-500/30 shadow-glow">
            <Heart size={28} className="text-brand-400" strokeWidth={1.8} />
          </div>
          {firstName && firstName !== 'Guest' ? (
            <>
              <h1 className="text-2xl font-bold text-white">Hello, {firstName}</h1>
              <p className="text-ink-300 text-sm">How are you feeling today?</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white">How are you feeling today?</h1>
              <p className="text-ink-400 text-sm leading-relaxed max-w-md mx-auto">
                Free AI health guidance in your language — voice-friendly, anywhere.
              </p>
            </>
          )}
        </section>

        {/* Primary actions */}
        <section className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/"
            className="card card-pad group space-y-3 transition-all hover:border-brand-500/50 hover:shadow-glow"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/25">
              <Heart size={18} strokeWidth={1.8} />
            </div>
            <h2 className="text-base font-semibold text-white">Talk to AI Doctor</h2>
            <p className="text-sm text-ink-300 leading-relaxed">
              Describe your symptoms. Get an AI assessment, next steps, and specialist recommendations.
            </p>
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-400 opacity-0 group-hover:opacity-100 transition">
              Start chat <ArrowRight size={12} />
            </div>
          </Link>

          <Link
            to="/emergency"
            className="card card-pad group space-y-3 transition-all hover:border-danger-500/40"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-500/15 text-danger-400 border border-danger-500/25">
              <Activity size={18} strokeWidth={1.8} />
            </div>
            <h2 className="text-base font-semibold text-white">Is this an emergency?</h2>
            <p className="text-sm text-ink-300 leading-relaxed">
              Not sure if you need to go to hospital right now? Get an immediate triage answer.
            </p>
            <div className="flex items-center gap-1.5 text-xs font-medium text-danger-400 opacity-0 group-hover:opacity-100 transition">
              Check now <ArrowRight size={12} />
            </div>
          </Link>
        </section>

        {/* Secondary actions */}
        <section className="grid grid-cols-2 gap-3">
          <Link to="/find-care" className="card p-4 flex items-center gap-3 hover:border-ink-600 transition-colors">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-brand-400">
              <MapPin size={16} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Find Care</p>
              <p className="text-[11px] text-ink-400">Hospitals & clinics</p>
            </div>
          </Link>

          <Link to="/records" className="card p-4 flex items-center gap-3 hover:border-ink-600 transition-colors">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-brand-400">
              <FileText size={16} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">My Records</p>
              <p className="text-[11px] text-ink-400">History & appointments</p>
            </div>
          </Link>
        </section>

        {/* Features */}
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">Why MedAccess</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { icon: Globe2,      color: 'text-ok-400',     title: 'Your language',  desc: '12+ languages, auto-detected' },
              { icon: Mic,         color: 'text-purple-400', title: 'Voice mode',     desc: 'Speak instead of type' },
              { icon: ShieldCheck, color: 'text-brand-400',  title: 'Private & free', desc: 'No account needed, ever' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="card p-3.5 flex items-start gap-3">
                <Icon size={15} className={`mt-0.5 shrink-0 ${color}`} strokeWidth={1.8} />
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-[11px] text-ink-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Emergency CTA */}
        <section className="card card-pad border-danger-500/25 bg-danger-500/5 text-center space-y-1.5">
          <p className="text-sm font-semibold text-danger-400">Life-threatening emergency?</p>
          <p className="text-xs text-ink-400">
            Don't use this app. Call <strong className="text-white">112 / 911 / 999</strong> immediately.
          </p>
        </section>

      </div>
    </div>
  );
}
