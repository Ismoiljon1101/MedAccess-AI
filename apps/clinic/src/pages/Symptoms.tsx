import { Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import CitationList from '@/components/CitationList';
import ProbabilityBar from '@/components/ProbabilityBar';
import VoiceButton from '@/components/VoiceButton';
import { analyzeSymptoms, type SymptomsResult } from '@/lib/api';
import { useAppStore } from '@/store/app';
import type { PatientContext } from '@medaccess/shared';

const URGENCY_STYLES: Record<string, string> = {
  emergency: 'border-danger-500/40 bg-danger-500/10 text-danger-500',
  urgent: 'border-warn-500/40 bg-warn-500/10 text-warn-500',
  'see-clinician-soon': 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
  'self-care': 'border-ok-500/40 bg-ok-500/10 text-ok-500',
};

export default function Symptoms() {
  const { language, model } = useAppStore();
  const [inputVal, setInputVal] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [patient, setPatient] = useState<PatientContext>({});
  const [result, setResult] = useState<SymptomsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addSymptom(text: string) {
    const t = text.trim();
    if (t && !symptoms.includes(t)) setSymptoms((prev) => [...prev, t]);
    setInputVal('');
  }

  async function submit() {
    if (!symptoms.length || loading) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await analyzeSymptoms({ symptoms, patient, language, model });
      setResult(res);
    } catch (err: any) {
      setError(err.message ?? 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card card-pad">
        <h1 className="text-lg font-semibold text-white">Symptom Analysis</h1>
        <p className="mt-1 text-sm text-ink-300">
          Enter symptoms, add patient context, and receive a ranked differential with red flags.
        </p>
      </div>

      <section className="card card-pad space-y-3">
        <label className="label">Symptoms</label>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Add a symptom and press Enter…"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSymptom(inputVal);
              }
            }}
          />
          <VoiceButton
            language={language}
            onTranscript={(t) => addSymptom(t)}
          />
          <button
            type="button"
            onClick={() => addSymptom(inputVal)}
            aria-label="Add symptom"
            className="btn"
          >
            <Plus size={16} />
          </button>
        </div>
        {symptoms.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {symptoms.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSymptoms((prev) => prev.filter((x) => x !== s))}
                className="chip flex items-center gap-1.5 border-accent-500/30 text-accent-400 hover:border-danger-500/40 hover:text-danger-500 transition"
              >
                {s} <X size={10} />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card card-pad space-y-4">
        <label className="label">Patient context (optional)</label>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label text-xs">Age</label>
            <input
              type="number"
              className="input"
              min={0}
              max={130}
              placeholder="e.g. 35"
              value={patient.age ?? ''}
              onChange={(e) =>
                setPatient((p) => ({ ...p, age: e.target.value ? Number(e.target.value) : undefined }))
              }
            />
          </div>
          <div>
            <label className="label text-xs">Sex</label>
            <select
              className="input"
              value={patient.sex ?? ''}
              onChange={(e) =>
                setPatient((p) => ({ ...p, sex: (e.target.value || undefined) as any }))
              }
            >
              <option value="">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="preg"
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={patient.pregnancy ?? false}
              onChange={(e) => setPatient((p) => ({ ...p, pregnancy: e.target.checked }))}
            />
            <label htmlFor="preg" className="label mb-0 cursor-pointer">
              Pregnancy
            </label>
          </div>
        </div>
        <div>
          <label className="label text-xs">Known conditions (comma-separated)</label>
          <input
            className="input"
            placeholder="e.g. hypertension, diabetes"
            onBlur={(e) => {
              const vals = e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              setPatient((p) => ({ ...p, knownConditions: vals.length ? vals : undefined }));
            }}
            defaultValue={patient.knownConditions?.join(', ') ?? ''}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label text-xs">Active medications (comma-separated)</label>
            <input
              className="input"
              placeholder="e.g. metformin, lisinopril"
              onBlur={(e) => {
                const vals = e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                setPatient((p) => ({ ...p, medications: vals.length ? vals : undefined }));
              }}
              defaultValue={patient.medications?.join(', ') ?? ''}
            />
          </div>
          <div>
            <label className="label text-xs">Allergies (comma-separated)</label>
            <input
              className="input"
              placeholder="e.g. penicillin, peanuts"
              onBlur={(e) => {
                const vals = e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                setPatient((p) => ({ ...p, allergies: vals.length ? vals : undefined }));
              }}
              defaultValue={patient.allergies?.join(', ') ?? ''}
            />
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={submit}
        disabled={!symptoms.length || loading}
        className="btn-primary w-full"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Analyzing…
          </>
        ) : (
          'Analyze symptoms'
        )}
      </button>

      {error && (
        <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div
            className={`inline-flex items-center rounded-xl border px-4 py-2 text-sm font-semibold ${URGENCY_STYLES[result.analysis.urgency] ?? ''}`}
          >
            Urgency: {result.analysis.urgency.replace(/-/g, ' ')}
          </div>

          <div className="space-y-3">
            {result.analysis.differentials.map((d) => (
              <ProbabilityBar key={d.condition} d={d} />
            ))}
          </div>

          {result.analysis.recommendedNextSteps.length > 0 && (
            <div className="card card-pad">
              <h3 className="mb-3 text-sm font-semibold text-white">Recommended next steps</h3>
              <ul className="space-y-1.5">
                {result.analysis.recommendedNextSteps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-200">
                    <span className="shrink-0 text-accent-400">→</span> {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <CitationList citations={result.citations} />

          {result.analysis.disclaimer && (
            <p className="text-xs italic text-ink-400">{result.analysis.disclaimer}</p>
          )}
        </div>
      )}
    </div>
  );
}
