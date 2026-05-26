import { useState, useRef } from 'react';
import { Loader2, Mic, MicOff, AlertTriangle, Phone } from 'lucide-react';
import { checkEmergency, transcribeAudio, type EmergencyCheckResult } from '@/lib/api';
import { useAppStore } from '@/store/app';

const LEVEL_CONFIG = {
  RED:    { label: 'LIFE-THREATENING',    bg: 'bg-red-600',    border: 'border-red-500',    text: 'text-white',       sub: 'Call emergency services NOW — do not wait.' },
  ORANGE: { label: 'VERY URGENT',         bg: 'bg-orange-500', border: 'border-orange-400', text: 'text-white',       sub: 'Go to an emergency room immediately.' },
  YELLOW: { label: 'URGENT',              bg: 'bg-yellow-400', border: 'border-yellow-300', text: 'text-slate-900',   sub: 'See a doctor today, within a few hours.' },
  GREEN:  { label: 'NOT AN EMERGENCY',    bg: 'bg-green-500',  border: 'border-green-400',  text: 'text-white',       sub: 'You can see a doctor or clinic at a normal appointment.' },
  BLUE:   { label: 'MINOR / SELF-CARE',   bg: 'bg-blue-500',   border: 'border-blue-400',   text: 'text-white',       sub: 'Rest and monitor your symptoms at home.' },
} as const;

export default function EmergencyCheck() {
  const { language } = useAppStore();
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
        try { const text = await transcribeAudio(blob, language); if (text) setDescription(text); } catch {}
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {}
  }

  async function submit() {
    if (!description.trim() || loading) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await checkEmergency({ description, language });
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const meta = result ? LEVEL_CONFIG[result.level] : null;

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
    <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-white">Is this an emergency?</h1>
        <p className="mt-1 text-sm text-slate-400">
          Describe what's happening — patient's age, main complaint, and how long it's been going on.
        </p>
      </div>

      {/* 112 CTA — always visible */}
      <div className="card card-pad border-danger-500/40 bg-danger-500/5 flex items-center gap-3">
        <Phone size={16} className="shrink-0 text-danger-400" />
        <p className="text-sm text-slate-300">
          If someone is <strong className="text-white">unconscious, not breathing, or in immediate danger</strong>
          {' '}— call <strong className="text-danger-400">112 / 911 / 999</strong> now, don't use this app.
        </p>
      </div>

      {/* Input */}
      <div className="card card-pad space-y-3">
        <div className="relative">
          <textarea
            className="input min-h-[120px] resize-none pr-10"
            placeholder='Describe the situation… e.g. "45-year-old man, chest pain for 20 minutes, sweating, trouble breathing"'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={recording ? 'Stop recording' : 'Describe by voice'}
            className={`absolute right-2 top-2 rounded-lg p-2 transition ${
              recording
                ? 'bg-danger-500/20 text-danger-400'
                : 'bg-surface-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {recording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        </div>
        {recording && (
          <p className="text-xs text-danger-400 animate-pulse flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-danger-500 animate-pulse" /> Recording — tap the mic to stop
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!description.trim() || loading}
        className="btn-primary w-full justify-center py-3"
      >
        {loading ? <><Loader2 size={16} className="animate-spin" /> Checking…</> : 'Check now'}
      </button>

      {error && (
        <div className="card card-pad border-danger-500/40 bg-danger-500/10 flex items-start gap-2 text-sm text-danger-400">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {result && meta && (
        <div className="space-y-4">
          {/* Level badge */}
          <div className={`rounded-2xl border p-5 text-center ${meta.border} ${meta.bg}/20`}>
            <div className={`inline-block rounded-xl px-4 py-2 text-sm font-bold tracking-widest ${meta.bg} ${meta.text}`}>
              {meta.label}
            </div>
            <p className="mt-2 text-sm font-medium text-white">{result.label}</p>
            <p className="mt-1 text-sm text-slate-300">{meta.sub}</p>
            {result.targetTime && (
              <p className="mt-2 text-xs text-slate-400">Target time to care: <strong className="text-white">{result.targetTime}</strong></p>
            )}
          </div>

          {/* Actions */}
          {result.actions.length > 0 && (
            <div className="card card-pad space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Do this now</p>
              <ul className="space-y-1.5">
                {result.actions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="shrink-0 font-bold text-brand-400">{i + 1}.</span> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warning signs */}
          {result.warningSigns.length > 0 && (
            <div className="card card-pad border-warn-500/30 bg-warn-500/5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-warn-400">If any of these happen — call emergency immediately</p>
              <ul className="space-y-1.5">
                {result.warningSigns.map((w, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="shrink-0 text-warn-400">!</span> {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
