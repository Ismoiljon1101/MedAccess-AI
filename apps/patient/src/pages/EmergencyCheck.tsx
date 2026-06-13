import { useState, useRef } from 'react';
import { Loader2, Mic, MicOff, AlertTriangle, Phone, ChevronRight } from 'lucide-react';
import { checkEmergency, transcribeAudio, type EmergencyCheckResult } from '@/lib/api';
import { useAppStore } from '@/store/app';
import { useNavigate } from 'react-router-dom';

const LEVEL_CONFIG = {
  RED:    { label: 'LIFE-THREATENING',  bg: 'bg-red-600',    border: 'border-red-500',    text: 'text-white',   sub: 'Call emergency services NOW — do not wait.', callout: true },
  ORANGE: { label: 'VERY URGENT',       bg: 'bg-orange-500', border: 'border-orange-400', text: 'text-white',   sub: 'Go to an emergency room immediately.',       callout: true },
  YELLOW: { label: 'URGENT',            bg: 'bg-yellow-400', border: 'border-yellow-300', text: 'text-ink-950', sub: 'See a doctor today, within a few hours.',    callout: false },
  GREEN:  { label: 'NOT AN EMERGENCY',  bg: 'bg-green-500',  border: 'border-green-400',  text: 'text-white',   sub: 'See a doctor at a normal appointment.',       callout: false },
  BLUE:   { label: 'MINOR / SELF-CARE', bg: 'bg-blue-500',   border: 'border-blue-400',   text: 'text-white',   sub: 'Rest and monitor your symptoms at home.',     callout: false },
} as const;

export default function EmergencyCheck() {
  const { language } = useAppStore();
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [result, setResult]           = useState<EmergencyCheckResult | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [recording, setRecording]     = useState(false);
  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function toggleVoice() {
    if (recording) { mediaRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        try {
          const text = await transcribeAudio(blob, language);
          if (text) setDescription(text);
          else setError("Didn't catch that — try typing instead.");
        } catch {
          setError('Could not transcribe audio. Please type your description.');
        }
      };
      mr.start();
      mediaRef.current = mr;
      setError(null);
      setRecording(true);
    } catch {
      setError('Microphone unavailable. Please allow mic access or type instead.');
    }
  }

  async function submit() {
    if (!description.trim() || loading) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const r = await checkEmergency({ description, language });
      setResult(r);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const meta = result ? LEVEL_CONFIG[result.level] : null;

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto">

        {/* Header */}
        <div>
          <h1 className="font-display text-2xl text-white tracking-tight">Is this an emergency?</h1>
          <p className="mt-1 text-sm text-ink-400">
            Describe what's happening — age, main complaint, how long it's been going on.
          </p>
        </div>

        {/* Emergency call CTA — only show when no result yet */}
        {!result && (
          <a
            href="tel:119"
            className="flex items-center gap-3 rounded-2xl border border-danger-500/40 bg-danger-500/8 px-4 py-3.5 transition hover:bg-danger-500/12"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-500/15">
              <Phone size={18} className="text-danger-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Life-threatening? Call 119 now</p>
              <p className="text-xs text-ink-400 mt-0.5">Unconscious, not breathing, or in immediate danger — don't use this app</p>
            </div>
            <ChevronRight size={16} className="text-danger-400 shrink-0" />
          </a>
        )}

        {/* Input card */}
        <div className="card card-pad space-y-3">
          <div className="relative">
            <textarea
              className="input min-h-[112px] resize-none pr-14"
              placeholder='e.g. "45-year-old man, chest pain for 20 minutes, sweating, trouble breathing"'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {/* Voice button — 44×44px tap target */}
            <button
              type="button"
              onClick={toggleVoice}
              aria-label={recording ? 'Stop voice recording' : 'Describe by voice'}
              className={`absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-xl transition ${
                recording
                  ? 'bg-danger-500/20 text-danger-400'
                  : 'bg-ink-700 text-ink-400 hover:bg-ink-600 hover:text-ink-200'
              }`}
            >
              {recording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          </div>
          {recording && (
            <p className="text-xs text-danger-400 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-danger-500 animate-pulse" />
              Recording — tap the mic to stop
            </p>
          )}
        </div>

        {/* Submit — full width, tall enough (py-3.5 = ~52px) */}
        <button
          type="button"
          onClick={submit}
          disabled={!description.trim() || loading}
          className="btn-primary w-full justify-center py-3.5 text-base"
        >
          {loading ? <><Loader2 size={18} className="animate-spin" /> Checking…</> : 'Check now'}
        </button>

        {error && (
          <div className="card card-pad border-danger-500/40 bg-danger-500/10 flex items-start gap-2 text-sm text-danger-400">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {/* Result */}
        {result && meta && (
          <div className="space-y-3">

            {/* Level card — full-width colored block, highly visible */}
            <div className={`rounded-2xl overflow-hidden`}>
              <div className={`${meta.bg} px-5 py-6 text-center`}>
                <p className={`text-xs font-bold tracking-[0.2em] uppercase ${meta.text} opacity-80`}>
                  Triage Assessment
                </p>
                <p className={`text-2xl font-bold tracking-wide mt-1 ${meta.text}`}>
                  {meta.label}
                </p>
                <p className={`mt-2 text-sm font-medium ${meta.text}`}>{result.label}</p>
                <p className={`mt-1 text-sm ${meta.text} opacity-90`}>{meta.sub}</p>
                {result.targetTime && (
                  <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1`}>
                    <span className={`text-xs font-medium ${meta.text}`}>
                      Target: {result.targetTime}
                    </span>
                  </div>
                )}
              </div>

              {/* Emergency call repeat — only for RED/ORANGE */}
              {meta.callout && (
                <a
                  href="tel:119"
                  className="flex items-center justify-center gap-2 bg-black/30 px-4 py-3 transition hover:bg-black/40"
                >
                  <Phone size={16} className="text-white" />
                  <span className="text-sm font-semibold text-white">Call 119 Emergency Services</span>
                </a>
              )}
            </div>

            {/* Actions */}
            {result.actions.length > 0 && (
              <div className="card card-pad space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Do this now</p>
                <ol className="space-y-2">
                  {result.actions.map((a, i) => (
                    <li key={i} className="flex gap-3 text-sm text-ink-200">
                      <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{a}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Warning signs */}
            {result.warningSigns.length > 0 && (
              <div className="card card-pad border-warn-500/30 bg-warn-500/5 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-warn-400">
                  Warning signs — call emergency immediately if any occur
                </p>
                <ul className="space-y-1.5">
                  {result.warningSigns.map((w, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink-200">
                      <span className="shrink-0 text-warn-400 font-bold">!</span>
                      <span className="leading-relaxed">{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* After result — Find Care CTA if not emergency */}
            {!meta.callout && (
              <button
                type="button"
                onClick={() => navigate('/find-care')}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-brand-500/40 bg-brand-500/10 py-3.5 text-sm font-semibold text-brand-400 hover:bg-brand-500/15 transition"
              >
                Find a clinic near you <ChevronRight size={16} />
              </button>
            )}

            {/* Reset */}
            <button
              type="button"
              onClick={() => { setResult(null); setDescription(''); setError(null); }}
              className="w-full text-xs text-ink-500 hover:text-ink-200 transition py-2"
            >
              Check another situation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
