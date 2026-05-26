import type { TriageLevel } from '@medaccess/shared';

const COLORS: Record<TriageLevel, { bg: string; text: string; ring: string; emoji: string }> = {
  RED: { bg: 'bg-danger-500/15', text: 'text-danger-500', ring: 'ring-danger-500/40', emoji: '🛑' },
  ORANGE: { bg: 'bg-warn-500/15', text: 'text-warn-500', ring: 'ring-warn-500/40', emoji: '⚠️' },
  YELLOW: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', ring: 'ring-yellow-500/40', emoji: '🟡' },
  GREEN: { bg: 'bg-ok-500/15', text: 'text-ok-500', ring: 'ring-ok-500/40', emoji: '🟢' },
  BLUE: { bg: 'bg-sky-500/10', text: 'text-sky-400', ring: 'ring-sky-500/40', emoji: '🔵' },
};

export default function TriageBadge({ level, label }: { level: TriageLevel; label?: string }) {
  const c = COLORS[level] ?? COLORS.YELLOW;
  return (
    <div
      className={[
        'inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ring-1',
        c.bg,
        c.text,
        c.ring,
      ].join(' ')}
    >
      <span aria-hidden>{c.emoji}</span>
      <span className="tracking-wide">{level}</span>
      {label && <span className="text-xs font-normal opacity-80">· {label}</span>}
    </div>
  );
}
