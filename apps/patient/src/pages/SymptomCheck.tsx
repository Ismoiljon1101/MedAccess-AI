import { useState, useRef } from 'react';
import { Loader2, Mic, MicOff, Plus, X, AlertTriangle } from 'lucide-react';
import { checkSymptoms, transcribeAudio, type SymptomCheckResult } from '@/lib/api';
import { useAppStore } from '@/store/app';

const URGENCY_CONFIG = {
  emergency:            { label: 'Emergency — go to hospital NOW',  cls: 'chip-danger', dot: 'bg-danger-500' },
  urgent:               { label: 'Urgent — see a doctor today',     cls: 'chip-warn',   dot: 'bg-warn-500'   },
  'see-clinician-soon': { label: 'See a doctor soon',               cls: 'chip-warn',   dot: 'bg-warn-400'   },
  'self-care':          { label: 'Rest and self-care may help',     cls: 'chip-ok',     dot: 'bg-ok-500'     },
} as const;

const LIKELIHOOD_LABEL = { high: 'Likely', moderate: 'Possible', low: 'Less likely' } as const;

export default function SymptomCheck() {
  const { language } = useAppStore();
  const [input, setInput] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [age, setAge]         = useState('');
  const [sex, setSex]         = useState('');
  const [preg, setPreg]       = useState(false);
  const [result, setResult]   = useState<SymptomCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function addSymptom(text: string) {
    const t = text.trim();
    if (t && !symptoms.includes(t)) setSymptoms((p) => [...p, t]);
    setInput('');
  }

  async function toggleVoice() {
    if (recording) {
      mediaRef.current?.stop();
      return;
    }
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
          if (text) addSymptom(text);
        } catch {
          // fall back: browser speech
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      // mic not available
    }
  }

  async function submit() {
    if (!symptoms.length || loading) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await checkSymptoms({
        symptoms,
        patient: {
          age: age ? Number(age) : undefined,
          sex: (sex || undefined) as any,
          pregnancy: preg || undefined,
        },
        language,
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const urgencyMeta = result ? URGENCY_CONFIG[result.urgency] : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">What are your symptoms?</h1>
        <p className="mt-1 text-sm text-slate-400">Add each symptom separately, or speak them aloud.</p>
      </div>

      {/* Symptom input */}
      <div className="card card-pad space-y-3">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder='e.g. "headache" then press Enter…'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSymptom(input); } }}
          />
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={recording ? 'Stop recording' : 'Start voice input'}
            className={`btn ${recording ? 'border-danger-500/50 bg-danger-500/20 text-danger-400' : ''}`}
          >
            {recording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button type="button" onClick={() => addSymptom(input)} aria-label="Add symptom" className="btn">
            <Plus size={16} />
          </button>
        </div>
        {symptoms.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {symptoms.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSymptoms((p) => p.filter((x) => x !== s))}
                className="chip flex items-center gap-1.5 border-brand-500/30 text-brand-400 hover:border-danger-500/40 hover:text-danger-400 transition"
              >
                {s} <X size={10} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Basic context */}
      <div className="card card-pad space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">About you (optional)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Age</label>
            <input type="number" className="input" min={0} max={130} placeholder="e.g. 28"
              value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div>
            <label className="label">Sex</label>
            <select className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input id="preg" type="checkbox" className="h-4 w-4 rounded"
              checked={preg} onChange={(e) => setPreg(e.target.checked)} />
            <label htmlFor="preg" className="text-sm text-slate-300 cursor-pointer">Pregnant</label>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!symptoms.length || loading}
        className="btn-primary w-full justify-center py-3"
      >
        {loading ? <><Loader2 size={16} className="animate-spin" /> Checking…</> : 'Check my symptoms'}
      </button>

      {error && (
        <div className="card card-pad border-danger-500/40 bg-danger-500/10 flex items-start gap-2 text-sm text-danger-400">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {result && urgencyMeta && (
        <div className="space-y-4">
          {/* Urgency badge */}
          <div className={`card card-pad flex items-center gap-3 ${result.urgency === 'emergency' ? 'border-danger-500/50' : ''}`}>
            <div className={`h-3 w-3 rounded-full shrink-0 ${urgencyMeta.dot} animate-pulse`} />
            <span className={`text-sm font-semibold ${result.urgency === 'emergency' ? 'text-danger-400' : result.urgency === 'urgent' ? 'text-warn-400' : result.urgency === 'see-clinician-soon' ? 'text-warn-400' : 'text-ok-400'}`}>
              {urgencyMeta.label}
            </span>
          </div>

          {/* Red flags */}
          {result.redFlags.length > 0 && (
            <div className="card card-pad border-danger-500/30 bg-danger-500/5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-danger-400">Warning signs to watch for</p>
              <ul className="space-y-1">
                {result.redFlags.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="shrink-0 text-danger-400">!</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Possible conditions — plain language, no % */}
          {result.topConditions.length > 0 && (
            <div className="card card-pad space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">This could be</p>
              <div className="space-y-2">
                {result.topConditions.map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white">{c.name}</span>
                    <span className={`chip text-[11px] ${c.likelihood === 'high' ? 'chip-warn' : 'border-slate-600/40 bg-slate-600/10 text-slate-400'}`}>
                      {LIKELIHOOD_LABEL[c.likelihood]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next steps */}
          {result.nextSteps.length > 0 && (
            <div className="card card-pad space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">What to do</p>
              <ul className="space-y-1.5">
                {result.nextSteps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="shrink-0 text-brand-400">→</span> {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs italic text-slate-500 leading-relaxed">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
