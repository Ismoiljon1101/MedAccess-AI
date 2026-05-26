import type { Differential } from '@medaccess/shared';

const LIKELIHOOD_COLOR: Record<Differential['likelihood'], string> = {
  high: 'from-danger-500 to-danger-600',
  moderate: 'from-warn-500 to-amber-600',
  low: 'from-ok-500 to-emerald-600',
};

export default function ProbabilityBar({ d }: { d: Differential }) {
  const pct = Math.max(0, Math.min(100, d.probabilityPct));
  return (
    <div className="card card-pad">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white">{d.condition}</div>
          <div className="mt-0.5 text-xs uppercase tracking-wider text-ink-300">
            {d.likelihood} likelihood
          </div>
        </div>
        <div className="font-mono text-xl font-semibold text-white">{pct.toFixed(0)}%</div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${LIKELIHOOD_COLOR[d.likelihood]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-200">{d.reasoning}</p>
      {d.redFlags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {d.redFlags.map((rf, i) => (
            <span key={i} className="chip border-danger-500/40 text-danger-500">
              red flag · {rf}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
