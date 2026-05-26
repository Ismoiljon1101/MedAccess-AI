import { useState, useRef } from 'react';
import { Upload, Loader2, AlertTriangle, FileImage, X } from 'lucide-react';
import { analyzeReport, type ReportAnalysisResult } from '@/lib/api';
import { useAppStore } from '@/store/app';

export default function Reports() {
  const { language } = useAppStore();
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<ReportAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(f: File) {
    if (!f.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, etc.)');
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setError('Image is too large (max 15 MB)');
      return;
    }
    setFile(f);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function submit() {
    if (!file || loading) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await analyzeReport(file, language);
      setResult(res);
      setFile(null);
      setPreview(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to analyze image. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
    <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-white">Analyze a medical image</h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload an X-ray, scan, or other medical image for AI analysis.
        </p>
      </div>

      {/* Upload area */}
      <div
        className="card card-pad border-2 border-dashed border-surface-600 hover:border-brand-500/50 transition cursor-pointer text-center space-y-3 py-8"
        onClick={() => fileInputRef.current?.click()}
      >
        <FileImage size={32} className="mx-auto text-brand-400" />
        <div>
          <p className="text-sm font-medium text-white">Click to upload an image</p>
          <p className="text-xs text-slate-400 mt-1">or drag and drop (JPG, PNG, max 15 MB)</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) handleFileSelect(f);
          }}
        />
      </div>

      {/* Preview + actions */}
      {preview && (
        <div className="space-y-3">
          <div className="card card-pad space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{file?.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(file!.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setFile(null); setPreview(null); }}
                className="btn btn-danger text-xs py-1 px-2"
              >
                <X size={14} /> Remove
              </button>
            </div>
            <img src={preview} alt="Preview" className="max-h-64 rounded-lg w-full object-contain" />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="btn-primary w-full justify-center py-3"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Analyzing…</>
            ) : (
              <><Upload size={16} /> Analyze Image</>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="card card-pad border-danger-500/40 bg-danger-500/10 flex items-start gap-2 text-sm text-danger-400">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Image type */}
          <div className="card card-pad">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Image type</p>
            <p className="text-sm text-white">{result.imageType}</p>
          </div>

          {/* Quality notes */}
          {result.qualityNotes && (
            <div className="card card-pad border-warn-500/30 bg-warn-500/5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-warn-400">Quality notes</p>
              <p className="text-sm text-slate-300">{result.qualityNotes}</p>
            </div>
          )}

          {/* Key observations */}
          {result.keyObservations.length > 0 && (
            <div className="card card-pad space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Key observations</p>
              <ul className="space-y-1.5">
                {result.keyObservations.map((obs, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="shrink-0 text-brand-400">•</span> {obs}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Findings */}
          {result.findings.length > 0 && (
            <div className="card card-pad space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Findings</p>
              <div className="space-y-2">
                {result.findings.map((f, i) => (
                  <div key={i} className="border-l-2 border-brand-500/40 pl-3 py-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{f.finding}</span>
                      <span className={`chip text-[11px] ${
                        f.confidence === 'high' ? 'border-ok-500/40 bg-ok-500/10 text-ok-400' :
                        f.confidence === 'moderate' ? 'border-warn-500/40 bg-warn-500/10 text-warn-400' :
                        'border-slate-600/40 bg-slate-600/10 text-slate-400'
                      }`}>
                        {f.confidence}
                      </span>
                    </div>
                    {f.notes && <p className="text-xs text-slate-400">{f.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up */}
          {result.suggestedFollowUp.length > 0 && (
            <div className="card card-pad space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Suggested follow-up</p>
              <ul className="space-y-1.5">
                {result.suggestedFollowUp.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="shrink-0 text-brand-400">→</span> {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs italic text-slate-500 leading-relaxed">{result.disclaimer}</p>

          <button
            type="button"
            onClick={() => { setFile(null); setPreview(null); setResult(null); }}
            className="btn w-full justify-center"
          >
            Analyze another image
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
