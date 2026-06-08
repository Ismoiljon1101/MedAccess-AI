import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, Languages, Sparkles } from 'lucide-react';
import { getHealth, type HealthInfo } from '@/lib/api';
import { LANGUAGES } from '@/lib/i18n';
import { MODEL_OPTIONS } from '@/lib/models';
import { useAppStore } from '@/store/app';

export default function Header() {
  const language = useAppStore((s) => s.language);
  const model = useAppStore((s) => s.model);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setModel = useAppStore((s) => s.setModel);

  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((e) => setError(e.message));
  }, []);

  const ok = health && health.providers.openrouter;

  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/60 bg-ink-950/70 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <div className="md:hidden flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles size={16} className="text-accent-400" /> MedAccess AI
        </div>
        <span
          className={[
            'chip',
            ok ? 'border-ok-500/40 text-ok-500 bg-ok-500/5' : 'border-danger-500/40 text-danger-500 bg-danger-500/10',
          ].join(' ')}
          title={error ?? undefined}
        >
          {ok ? <CheckCircle2 size={12} /> : <CircleAlert size={12} />}
          {ok ? 'API ready' : error ? 'API offline' : 'connecting...'}
        </span>
        {health?.rag.ready && (
          <span className="chip border-accent-500/30 text-accent-400">
            RAG · {health.rag.size} docs
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="chip cursor-pointer">
          <Languages size={12} className="text-ink-300" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent text-ink-100 outline-none rounded-md cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-500/40"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-ink-900">
                {l.label} {l.code !== 'auto' && l.code !== l.english.toLowerCase() ? `(${l.english})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="chip cursor-pointer">
          <Sparkles size={12} className="text-accent-400" />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-transparent text-ink-100 outline-none rounded-md cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-500/40"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id} className="bg-ink-900">
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
