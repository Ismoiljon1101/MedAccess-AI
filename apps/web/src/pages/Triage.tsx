import { Activity, Loader2 } from 'lucide-react';
import { useState } from 'react';
import TriageBadge from '@/components/TriageBadge';
import VoiceButton from '@/components/VoiceButton';
import { runTriage, type TriageResultPayload } from '@/lib/api';
import { useAppStore } from '@/store/app';
import type { Vitals } from '@medaccess/shared';

type VitalKey = keyof Vitals;

const VITAL_FIELDS: { key: VitalKey; label: string; unit: string; min: number; max: number; step?: number }[] = [
  { key: 'hrBpm', label: 'HR', unit: 'bpm', min: 0, max: 300 },
  { key: 'rrBpm', label: 'RR', unit: 'bpm', min: 0, max: 120 },
  { key: 'sbpMmHg', label: 'SBP', unit: 'mmHg', min: 0, max: 300 },
  { key: 'dbpMmHg', label: 'DBP', unit: 'mmHg', min: 0, max: 250 },
  { key: 'spo2Pct', label: 'SpO₂', unit: '%', min: 0, max: 100 },
  { key: 'tempC', label: 'Temp', unit: '°C', min: 20, max: 45, step: 0.1 },
  { key: 'gcs', label: 'GCS', unit: '/15', min: 3, max: 15 },
];

export default function Triage() {
  const { language, model } = useAppStore();
  const [caseSummary, setCaseSummary] = useState('');
  const [vitals, setVitals] = useState<Vitals>({});
  const [result, setResult] = useState<TriageResultPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setVital(key: VitalKey, val: string) {
    setVitals((prev) => ({
      ...prev,
      [key]: val === '' ? undefined : Number(val),
    }));
  }

  async function submit() {
    if (!caseSummary.trim() || loading) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await runTriage({ caseSummary, vitals, language, model });
      setResult(res);
    } catch (err: any) {
      setError(err.message ?? 'Triage failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card card-pad">
        <h1 className="text-lg font-semibold text-white">Triage</h1>
        <p className="mt-1 text-sm text-ink-300">
          Manchester-style emergency triage. Returns a color level, target time to care,
          recommended actions, and warning signs.
        </p>
      </div>

      <section className="card card-pad space-y-3">
        <label className="label">Case summary</label>
        <div className="flex gap-2">
          <textarea
            className="input min-h-[100px] flex-1 resize-none"
            placeholder="Describe the patient presentation, chief complaint, and any relevant history…"
            value={caseSummary}
            onChange={(e) => setCaseSummary(e.target.value)}
          />
          <div className="flex flex-col justify-end">
            <VoiceButton
              language={language}
              onTranscript={(t) => setCaseSummary((prev) => (prev ? `${prev} ${t}` : t))}
            />
          </div>
        </div>
      </section>

      <section className="card card-pad space-y-3">
        <label className="label">Vitals (optional)</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {VITAL_FIELDS.map(({ key, label, unit, min, max, step }) => (
            <div key={key}>
              <label className="label text-xs">
                {label} <span className="text-ink-500">{unit}</span>
              </label>
              <input
                type="number"
                className="input"
                min={min}
                max={max}
                step={step ?? 1}
                placeholder="–"
                value={vitals[key] ?? ''}
                onChange={(e) => setVital(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={submit}
        disabled={!caseSummary.trim() || loading}
        className="btn-primary w-full"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Running triage…
          </>
        ) : (
          <>
            <Activity size={16} /> Run triage
          </>
        )}
      </button>

      {error && (
        <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="card card-pad">
            <div className="flex flex-wrap items-center gap-4">
              <TriageBadge level={result.triage.level} label={result.triage.levelLabel} />
              <div className="text-sm text-ink-200">
                Target time to care:{' '}
                <span className="font-semibold text-white">{result.triage.targetTimeToCare}</span>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-200">{result.triage.rationale}</p>
          </div>

          {result.triage.actions.length > 0 && (
            <div className="card card-pad">
              <h3 className="mb-3 text-sm font-semibold text-white">Recommended actions</h3>
              <ul className="space-y-1.5">
                {result.triage.actions.map((action, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-200">
                    <span className="shrink-0 text-accent-400">→</span> {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.triage.warningSigns.length > 0 && (
            <div className="card card-pad">
              <h3 className="mb-3 text-sm font-semibold text-white">Warning signs — escalate if present</h3>
              <div className="flex flex-wrap gap-2">
                {result.triage.warningSigns.map((sign, i) => (
                  <span key={i} className="chip border-danger-500/40 text-danger-500">
                    {sign}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
