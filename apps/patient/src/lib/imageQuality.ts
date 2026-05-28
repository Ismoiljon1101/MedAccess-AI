/**
 * Client-side image quality gate.
 *
 * Runs three checks on a File before it goes to the API:
 *   1. Blur    — variance-of-Laplacian on grayscale canvas
 *   2. Brightness — mean luminance
 *   3. Glare   — fraction of near-white pixels
 *
 * All checks run synchronously on a downscaled canvas (max 256 px wide)
 * so they complete in < 10 ms on any phone.
 */

export type QualityFail =
  | 'too_blurry'
  | 'too_dark'
  | 'too_bright'
  | 'glare'
  | 'invalid_image';

export interface QualityResult {
  pass: boolean;
  fail?: QualityFail;
  message?: string;
  /** Computed metrics for debug/logging */
  metrics?: {
    laplacianVariance: number;
    meanBrightness: number;
    glareFraction: number;
  };
}

/** Human-readable guidance for each failure reason */
export const QUALITY_MESSAGES: Record<QualityFail, string> = {
  too_blurry:    'Image is too blurry — hold the camera still and retake.',
  too_dark:      'Image is too dark — move to a brighter area and retake.',
  too_bright:    'Image is overexposed — reduce direct light and retake.',
  glare:         'Glare detected — tilt the camera slightly to remove reflections.',
  invalid_image: 'Could not read the image — try a different file.',
};

// ── Thresholds ────────────────────────────────────────────────────────────────
// Tuned conservatively so they only block clearly bad images, not marginal ones.
const BLUR_THRESHOLD        = 40;   // Laplacian variance < this → blurry
const DARK_THRESHOLD        = 35;   // Mean luminance < this → too dark
const BRIGHT_THRESHOLD      = 225;  // Mean luminance > this → overexposed
const GLARE_THRESHOLD       = 0.06; // Fraction of near-white pixels > this → glare

const MAX_SIDE = 256; // Downscale to at most this many pixels on the longer side

// ── Helpers ───────────────────────────────────────────────────────────────────

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width  = w;
  c.height = h;
  return c;
}

/** Draw image at downscaled size, return pixel data (RGBA). */
function getPixels(img: HTMLImageElement): { data: Uint8ClampedArray; w: number; h: number } {
  const scale = MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.round(img.naturalWidth  * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

/** Convert RGBA pixel array to grayscale Float32Array. */
function toGrayscale(rgba: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

/**
 * Variance of Laplacian — classic blur metric.
 * Higher = sharper. Lower = blurrier.
 * Kernel: [0,1,0, 1,-4,1, 0,1,0]
 */
function laplacianVariance(gray: Float32Array, w: number, h: number): number {
  const lap: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const v =
        gray[(y - 1) * w + x] +
        gray[(y + 1) * w + x] +
        gray[y * w + (x - 1)] +
        gray[y * w + (x + 1)] -
        4 * gray[y * w + x];
      lap.push(v);
    }
  }
  const mean = lap.reduce((s, v) => s + v, 0) / lap.length;
  const variance = lap.reduce((s, v) => s + (v - mean) ** 2, 0) / lap.length;
  return variance;
}

/** Mean luminance [0–255] */
function meanBrightness(gray: Float32Array): number {
  return gray.reduce((s, v) => s + v, 0) / gray.length;
}

/** Fraction of pixels where all channels > 240 (near-white = glare). */
function glareFraction(rgba: Uint8ClampedArray): number {
  let count = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] > 240 && rgba[i + 1] > 240 && rgba[i + 2] > 240) count++;
  }
  return count / (rgba.length / 4);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Load a File into an HTMLImageElement, run all quality checks, return result.
 * Call from a React event handler; resolves in < 50 ms on modern phones.
 */
export function checkImageQuality(file: File): Promise<QualityResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img  = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const { data, w, h } = getPixels(img);
        const gray = toGrayscale(data, w, h);

        const lv  = laplacianVariance(gray, w, h);
        const mb  = meanBrightness(gray);
        const gf  = glareFraction(data);

        const metrics = {
          laplacianVariance: Math.round(lv * 100) / 100,
          meanBrightness:    Math.round(mb),
          glareFraction:     Math.round(gf * 1000) / 1000,
        };

        if (lv  < BLUR_THRESHOLD)   return resolve({ pass: false, fail: 'too_blurry',  message: QUALITY_MESSAGES.too_blurry,  metrics });
        if (mb  < DARK_THRESHOLD)   return resolve({ pass: false, fail: 'too_dark',    message: QUALITY_MESSAGES.too_dark,    metrics });
        if (mb  > BRIGHT_THRESHOLD) return resolve({ pass: false, fail: 'too_bright',  message: QUALITY_MESSAGES.too_bright,  metrics });
        if (gf  > GLARE_THRESHOLD)  return resolve({ pass: false, fail: 'glare',       message: QUALITY_MESSAGES.glare,       metrics });

        resolve({ pass: true, metrics });
      } catch {
        resolve({ pass: false, fail: 'invalid_image', message: QUALITY_MESSAGES.invalid_image });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ pass: false, fail: 'invalid_image', message: QUALITY_MESSAGES.invalid_image });
    };

    img.src = url;
  });
}
