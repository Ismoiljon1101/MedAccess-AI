import { FileImage, Loader2, Upload, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { analyzeReport, type ReportAnalyzeResult } from '@/lib/api';
import { useAppStore } from '@/store/app';

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'border-ok-500/40 text-ok-500',
  moderate: 'border-warn-500/40 text-warn-500',
  low: 'border-ink-600 text-ink-400',
};

export default function Reports() {
  const { language, model } = useAppStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ReportAnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadFile(f: File) {
    setFile(f);
    setResult(null);
    setError(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, []);

  async function submit() {
    if (!file || loading) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await analyzeReport({ file, note: note || undefined, language, model });
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
        <h1 className="text-lg font-semibold text-white">Report Reading</h1>
        <p className="mt-1 text-sm text-ink-300">
          Upload an ECG, X-ray, lab photo, or dermatology image for multimodal AI analysis.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={[
          'card flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 transition',
          dragging ? 'border-accent-500 bg-accent-500/10' : 'border-ink-700 hover:border-ink-600',
        ].join(' ')}
      >
        {preview ? (
          <div className="relative">
            <img src={preview} alt="Uploaded report" className="max-h-64 rounded-xl object-contain" />
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setResult(null);
              }}
              aria-label="Remove image"
              className="absolute -right-2 -top-2 rounded-full bg-ink-800 p-1 text-ink-300 hover:text-white ring-1 ring-ink-700"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <FileImage size={40} className="text-ink-500" />
            <div className="text-center text-sm text-ink-300">
              <p>Drag & drop an image here, or</p>
              <label className="mt-1 cursor-pointer font-medium text-accent-400 hover:underline">
                browse to select
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadFile(f);
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-ink-500">PNG, JPEG, WEBP, GIF · max 10 MB</p>
          </>
        )}
      </div>

      {file && (
        <>
          <div className="card card-pad">
            <label className="label text-xs">Clinical note (optional)</label>
            <textarea
              className="input mt-1 min-h-[80px] resize-none"
              placeholder="e.g. 65-year-old male, chest pain, rule out pneumonia"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Analyzing image…
              </>
            ) : (
              <>
                <Upload size={16} /> Analyze report
              </>
            )}
          </button>
        </>
      )}

      {error && (
        <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          {error}
        </div>
      )}

      {result?.analysis && (
        <div className="space-y-4">
          <div className="card card-pad space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">{result.analysis.imageType}</h3>
              <span className="chip border-ink-600 text-ink-400 text-xs">via {result.model}</span>
            </div>
            {result.analysis.qualityNotes && (
              <p className="text-sm text-ink-300">{result.analysis.qualityNotes}</p>
            )}
          </div>

          {result.analysis.keyObservations.length > 0 && (
            <div className="card card-pad">
              <h3 className="mb-3 text-sm font-semibold text-white">Key observations</h3>
              <ul className="space-y-1.5">
                {result.analysis.keyObservations.map((obs, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-200">
                    <span className="shrink-0 text-accent-400">·</span> {obs}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.analysis.possibleFindings.length > 0 && (
            <div className="card card-pad">
              <h3 className="mb-3 text-sm font-semibold text-white">Possible findings</h3>
              <div className="space-y-3">
                {result.analysis.possibleFindings.map((f, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <p className="text-sm text-ink-200">{f.finding}</p>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`chip text-xs ${CONFIDENCE_STYLES[f.confidence] ?? ''}`}>
                        {f.confidence}
                      </span>
                      {f.notes && <span className="text-xs text-ink-400">{f.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.analysis.suggestedFollowUp.length > 0 && (
            <div className="card card-pad">
              <h3 className="mb-3 text-sm font-semibold text-white">Suggested follow-up</h3>
              <ul className="space-y-1.5">
                {result.analysis.suggestedFollowUp.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-200">
                    <span className="shrink-0 text-accent-400">→</span> {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.analysis.disclaimer && (
            <p className="text-xs italic text-ink-400">{result.analysis.disclaimer}</p>
          )}
        </div>
      )}

      {result && !result.analysis && (
        <div className="rounded-xl border border-warn-500/40 bg-warn-500/10 px-4 py-3 text-sm text-warn-500">
          The model returned a raw response that could not be parsed as structured analysis. Raw:{' '}
          <code className="text-xs">{result.raw}</code>
        </div>
      )}
    </div>
  );
}
