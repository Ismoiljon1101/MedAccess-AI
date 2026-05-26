import { BookText } from 'lucide-react';
import type { Citation } from '@/lib/api';

export default function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-ink-400">
        <BookText size={11} /> sources
      </span>
      {citations.map((c) => (
        <span key={c.id} className="chip border-accent-500/30 text-accent-400" title={`score ${c.score}`}>
          {c.title}
        </span>
      ))}
    </div>
  );
}
