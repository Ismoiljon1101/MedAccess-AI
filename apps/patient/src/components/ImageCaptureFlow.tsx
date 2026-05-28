/**
 * ImageCaptureFlow — full image-quality-gated upload experience.
 *
 * Flow:
 *   1. Guidance modal   — do's / don'ts, modality picker
 *   2. File picker      — native OS camera/gallery
 *   3. Quality gate     — blur / brightness / glare checks (canvas)
 *   4a. Quality FAIL    — specific reason + Retake button
 *   4b. Quality PASS    — post-capture preview + 3-item checklist + Retake / Send
 *
 * Usage:
 *   <ImageCaptureFlow
 *     onConfirm={(file, modality) => { ... }}
 *     onCancel={() => { ... }}
 *   />
 */
import { useRef, useState } from 'react';
import {
  type LucideProps,
  X, Camera, RefreshCw, Check, AlertTriangle,
  Sun, Scan, Eye, Stethoscope, ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import { checkImageQuality } from '@/lib/imageQuality';
import type { QualityFail } from '@/lib/imageQuality';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImageModality = 'skin' | 'xray' | 'eye' | 'general';

interface Props {
  onConfirm: (file: File, modality: ImageModality) => void;
  onCancel:  () => void;
}

// ── Modality config ───────────────────────────────────────────────────────────

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>;

const MODALITIES: {
  key: ImageModality;
  label: string;
  Icon: LucideIcon;
  hint: string;
  overlayClass: string;
}[] = [
  { key: 'skin',    label: 'Skin / Lesion', Icon: Scan,        hint: 'Keep the lesion centred in the circle. Fill at least 60 % of the frame.',       overlayClass: 'oval' },
  { key: 'xray',   label: 'X-ray',         Icon: Sun,         hint: 'Photograph the X-ray on a lightbox. Hold camera parallel to the film.',          overlayClass: 'rect' },
  { key: 'eye',    label: 'Eye / Fundus',  Icon: Eye,         hint: 'Centre the eye in the oval. Use the front camera with good ambient light.',       overlayClass: 'oval-sm' },
  { key: 'general',label: 'Other',         Icon: Stethoscope, hint: 'Fill the frame. Ensure good lighting. Avoid shadows and motion blur.',             overlayClass: 'grid' },
];

// ── Do's & Don'ts ─────────────────────────────────────────────────────────────

const DOS = [
  'Use natural daylight or a well-lit room',
  'Hold the camera steady — use both hands',
  'Fill at least half the frame with the area of interest',
  'Take the photo from directly above (not at an angle)',
];
const DONTS = [
  "Don't use flash — it causes glare",
  "Don't include other body parts unnecessarily",
  "Don't submit blurry or out-of-focus images",
];

// ── Quality fail icon / colour ────────────────────────────────────────────────

const FAIL_CONFIG: Record<QualityFail, { icon: string; color: string }> = {
  too_blurry:    { icon: '🌫️', color: 'text-warn-400' },
  too_dark:      { icon: '🌑', color: 'text-warn-400' },
  too_bright:    { icon: '☀️', color: 'text-warn-400' },
  glare:         { icon: '✨', color: 'text-warn-400' },
  invalid_image: { icon: '❌', color: 'text-danger-400' },
};

// ── Overlay SVG per modality ──────────────────────────────────────────────────

function ModalityOverlay({ modality }: { modality: ImageModality }) {
  if (modality === 'xray') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="8" y="8" width="84" height="84" fill="none" stroke="#22b8a3" strokeWidth="0.8" strokeDasharray="4 2" rx="2" />
        <line x1="50" y1="8"  x2="50" y2="92" stroke="#22b8a350" strokeWidth="0.4" />
        <line x1="8"  y1="50" x2="92" y2="50" stroke="#22b8a350" strokeWidth="0.4" />
      </svg>
    );
  }
  if (modality === 'eye') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
        <ellipse cx="50" cy="50" rx="32" ry="22" fill="none" stroke="#22b8a3" strokeWidth="0.8" strokeDasharray="4 2" />
        <circle  cx="50" cy="50" r="6"  fill="none" stroke="#22b8a380" strokeWidth="0.6" />
      </svg>
    );
  }
  if (modality === 'skin') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="36" fill="none" stroke="#22b8a3" strokeWidth="0.8" strokeDasharray="4 2" />
        <circle cx="50" cy="50" r="4"  fill="none" stroke="#22b8a360" strokeWidth="0.6" />
      </svg>
    );
  }
  // general — grid
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1="33" y1="0"  x2="33" y2="100" stroke="#22b8a340" strokeWidth="0.5" />
      <line x1="67" y1="0"  x2="67" y2="100" stroke="#22b8a340" strokeWidth="0.5" />
      <line x1="0"  y1="33" x2="100" y2="33" stroke="#22b8a340" strokeWidth="0.5" />
      <line x1="0"  y1="67" x2="100" y2="67" stroke="#22b8a340" strokeWidth="0.5" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type Step =
  | 'guidance'     // step 1 — do's / don'ts + modality
  | 'checking'     // transient — running quality checks
  | 'fail'         // quality gate failed
  | 'preview';     // post-capture checklist

export default function ImageCaptureFlow({ onConfirm, onCancel }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [step,      setStep]      = useState<Step>('guidance');
  const [modality,  setModality]  = useState<ImageModality>('general');
  const [file,      setFile]      = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failMsg,   setFailMsg]   = useState('');
  const [failIcon,  setFailIcon]  = useState('');
  const [checks,    setChecks]    = useState([false, false, false]);

  const allChecked = checks.every(Boolean);

  // ── Open native file picker ────────────────────────────────────────────
  function openPicker() {
    fileRef.current?.click();
  }

  // ── File selected → run quality gate ──────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!e.target.files) return;
    // reset input so same file can be reselected after retake
    e.target.value = '';
    if (!f) return;

    // Show preview immediately for responsiveness
    const url = URL.createObjectURL(f);
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    setFile(f);
    setStep('checking');

    const result = await checkImageQuality(f);

    if (!result.pass && result.fail) {
      const cfg = FAIL_CONFIG[result.fail];
      setFailMsg(result.message ?? 'Image quality too low. Please retake.');
      setFailIcon(cfg.icon);
      setStep('fail');
    } else {
      setChecks([false, false, false]);
      setStep('preview');
    }
  }

  // ── Retake ─────────────────────────────────────────────────────────────
  function retake() {
    setStep('guidance');
    openPicker();
  }

  // ── Confirm ────────────────────────────────────────────────────────────
  function confirm() {
    if (!file || !allChecked) return;
    onConfirm(file, modality);
  }

  // ── Cleanup on cancel ──────────────────────────────────────────────────
  function cancel() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onCancel();
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-0 sm:px-4">
      <div className="w-full sm:max-w-md bg-ink-900 border border-ink-700 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] overflow-y-auto">

        {/* ── Hidden file input ─────────────────────────────────────── */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
          aria-hidden
        />

        {/* ════════════════════════════════════════════════════════════ */}
        {/* STEP 1 — Guidance modal                                     */}
        {/* ════════════════════════════════════════════════════════════ */}
        {step === 'guidance' && (
          <div className="p-5 space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Upload Medical Image</h2>
                <p className="text-xs text-ink-400 mt-0.5">Follow these tips for accurate analysis</p>
              </div>
              <button
                type="button"
                onClick={cancel}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-100 transition"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modality picker */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">Image type</p>
              <div className="grid grid-cols-2 gap-2">
                {MODALITIES.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setModality(key)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      modality === key
                        ? 'border-brand-500/60 bg-brand-500/15 text-brand-400'
                        : 'border-ink-700 bg-ink-800 text-ink-300 hover:border-ink-600'
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                    {modality === key && <CheckCircle2 size={13} className="ml-auto shrink-0 text-brand-400" />}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-500 leading-relaxed">
                {MODALITIES.find((m) => m.key === modality)?.hint}
              </p>
            </div>

            {/* Do's */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ok-400 mb-2">✓ Do</p>
              <ul className="space-y-1.5">
                {DOS.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-xs text-ink-300">
                    <Check size={12} className="text-ok-400 mt-0.5 shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            {/* Don'ts */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-danger-400 mb-2">✗ Don't</p>
              <ul className="space-y-1.5">
                {DONTS.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-xs text-ink-300">
                    <X size={12} className="text-danger-400 mt-0.5 shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={cancel}
                className="flex-1 rounded-xl border border-ink-700 bg-ink-800 py-3 text-sm font-medium text-ink-300 hover:border-ink-600 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={openPicker}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-brand-500/50 bg-brand-500/20 py-3 text-sm font-semibold text-brand-400 hover:bg-brand-500/30 transition"
              >
                <Camera size={16} /> Choose Image
                <ChevronRight size={14} className="ml-auto" />
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* STEP — Checking (transient spinner)                         */}
        {/* ════════════════════════════════════════════════════════════ */}
        {step === 'checking' && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            {previewUrl && (
              <div className="relative w-40 h-40 rounded-2xl overflow-hidden border border-ink-700">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                <ModalityOverlay modality={modality} />
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-ink-300">
              <svg className="animate-spin h-4 w-4 text-brand-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path  className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Checking image quality…
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* STEP — Quality FAIL                                         */}
        {/* ════════════════════════════════════════════════════════════ */}
        {step === 'fail' && (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Image Quality Check</h2>
              <button type="button" onClick={cancel} aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-100 transition">
                <X size={15} />
              </button>
            </div>

            {previewUrl && (
              <div className="relative w-full max-h-48 rounded-2xl overflow-hidden border border-ink-700">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover opacity-60" />
                <ModalityOverlay modality={modality} />
              </div>
            )}

            <div className="flex items-start gap-3 rounded-2xl border border-warn-500/30 bg-warn-500/10 px-4 py-3">
              <span className="text-2xl">{failIcon}</span>
              <div>
                <p className="text-sm font-semibold text-warn-400">Quality check failed</p>
                <p className="text-xs text-ink-300 mt-0.5 leading-relaxed">{failMsg}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancel}
                className="flex-1 rounded-xl border border-ink-700 bg-ink-800 py-3 text-sm font-medium text-ink-300 hover:border-ink-600 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={retake}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-brand-500/50 bg-brand-500/20 py-3 text-sm font-semibold text-brand-400 hover:bg-brand-500/30 transition"
              >
                <RefreshCw size={15} /> Retake
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* STEP — Post-capture preview + checklist                     */}
        {/* ════════════════════════════════════════════════════════════ */}
        {step === 'preview' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Confirm Image</h2>
                <p className="text-xs text-ink-400 mt-0.5">Check the preview before sending</p>
              </div>
              <button type="button" onClick={cancel} aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-100 transition">
                <X size={15} />
              </button>
            </div>

            {/* Preview + overlay */}
            {previewUrl && (
              <div className="relative w-full max-h-56 rounded-2xl overflow-hidden border border-ink-700 bg-ink-950">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                <ModalityOverlay modality={modality} />
                {/* Quality-pass badge */}
                <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full border border-ok-500/40 bg-ok-500/20 px-2 py-0.5 text-[10px] font-semibold text-ok-400">
                  <CheckCircle2 size={10} /> Quality OK
                </span>
              </div>
            )}

            {/* 3-item confirmation checklist */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Confirm before sending</p>
              {[
                'The area of interest is clearly visible and centred',
                'The image is in focus and well lit',
                'No personal identifying information is visible',
              ].map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setChecks((c) => c.map((v, j) => j === i ? !v : v))}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    checks[i]
                      ? 'border-ok-500/40 bg-ok-500/10 text-ok-300'
                      : 'border-ink-700 bg-ink-800 text-ink-300 hover:border-ink-600'
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                    checks[i] ? 'border-ok-500 bg-ok-500 text-white' : 'border-ink-600 bg-ink-700'
                  }`}>
                    {checks[i] && <Check size={11} strokeWidth={3} />}
                  </span>
                  {label}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={retake}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-sm font-medium text-ink-300 hover:border-ink-600 transition"
              >
                <RefreshCw size={14} /> Retake
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!allChecked}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-brand-500/50 bg-brand-500/20 py-3 text-sm font-semibold text-brand-400 hover:bg-brand-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <AlertTriangle size={14} className="text-warn-400" />
                Send for Analysis
              </button>
            </div>

            <p className="text-[10px] text-ink-500 text-center leading-relaxed">
              Image is analyzed by AI. Not a diagnostic tool. Always consult a clinician.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
