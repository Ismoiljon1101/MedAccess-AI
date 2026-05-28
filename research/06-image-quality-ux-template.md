# Research Results — Image Quality UX

> **Status:** ✅ Filled from "Medical ML for Rural Settings.md" (Ismail, 2026-05-28) — Otabek implements
> **Owner:** Otabek (`apps/patient/src/pages/Chat.tsx`)
> **Priority:** REQUIRED — models lose 10–25% without this. Not a nice-to-have.

---

## What makes a good medical photo

| Property | Rule | Why |
|---|---|---|
| Lighting | Natural daylight preferred; no flash | Flash creates glare, washes out color contrast critical for diagnosis |
| Focus | Tap-to-focus on lesion, hold still 1 second | Blur kills model accuracy; Laplacian variance drops below threshold |
| Framing | Lesion centered, fills ~50% of frame | Too small = insufficient detail pixels; too large = no border context |
| Background | Plain surface (white paper, clean skin nearby) | Cluttered background introduces spurious features into CNN |
| Distance | 15–30 cm for skin/scabies | Closer than 15 cm = phone can't macro-focus |
| X-ray alignment | Phone parallel to lightbox, perpendicular to film | Parallax + reflections = 15–25% AUROC drop in CXR models |
| Microscope capture | Stable, focused eyepiece image; no hand-holding | Focus drift on manual microscopes is #1 malaria false-positive source |
| Scale reference | Coin or ruler optional but recommended | Helps clinician judge lesion size for review |
| Privacy | Affected area only; no face or identifying marks | Patient dignity + reduces PII risk in stored images |

---

## UX patterns from similar apps (research)

| App | Onboarding pattern | What works | What we'd change |
|---|---|---|---|
| SkinVision | Pre-capture overlay circle guide + live blur warning | Real-time visual feedback prevents bad uploads | Too many steps; simplify for low-literacy users |
| FirstDerm | Photo checklist before upload, text-only | Simple, low-data | No visual guide; relies on text literacy |
| Aysa | ABCDE rule explanation pre-capture | Educational | Too medical-heavy for general outpatient use |

---

## Required UX (from Phase 3 research recommendations)

Three components are **required per the research** (not optional):

### 1. Pre-capture alignment overlay
Show on-screen template indicating where to position the lesion, X-ray, or fundus image before the shutter fires.

```
┌─────────────────────────────┐
│ 📸 Position the affected area │
│                              │
│    ┌─────────────┐           │
│    │   CENTER    │           │  ← dashed overlay box
│    │   LESION    │           │
│    │    HERE     │           │
│    └─────────────┘           │
│                              │
│  ✅ Fill ~half the frame     │
│  ✅ Plain background         │
│  ❌ No flash                 │
│                              │
│ [Take photo]  [Choose existing] │
└─────────────────────────────┘
```

### 2. Post-capture checklist (before send)
User confirms quality before image is submitted to the ML pipeline.

```
┌─────────────────────────────┐
│ Preview:                     │
│   [image thumbnail]          │
│                              │
│ Before submitting, confirm:  │
│   ☐ Image is in sharp focus  │
│   ☐ Lighting is adequate     │
│   ☐ Only the affected area   │
│   ☐ No face or ID visible    │
│                              │
│ [Looks good — Submit]        │
│ [Retake photo]               │
└─────────────────────────────┘
```

### 3. Ambient contrast verification (client-side, before send)
Automatic block on blown-out glare or severe motion blur. No server round-trip.

---

## Optional: client-side auto-quality gate (Phase 3 enhancement)

| Check | How | Library | Effort | Status |
|---|---|---|---|---|
| **Blur detection** | Variance of Laplacian on canvas | OpenCV.js or vanilla Canvas | Small | Recommended Phase 3 |
| **Low-light detection** | Brightness histogram mean < threshold | Canvas API `getImageData` | Small | Recommended Phase 3 |
| Multi-object detection | YOLO-tiny in browser | ONNX.js | Medium | Optional — WASM single-thread risk |
| Face detection (auto-blur) | Mediapipe FaceMesh | Mediapipe | Medium | Privacy bonus feature |

Reject + reprompt if quality fails before sending = save LLM tokens + better specialist model results.

**Thresholds (starting points, tune after field testing):**
- Blur: Laplacian variance < 100 → reject (too blurry)
- Brightness: Mean pixel value < 40 (too dark) or > 220 (blown out) → warn

---

## Modal copy (base English — to be translated per language)

| Element | Text |
|---|---|
| Pre-capture title | "Take a clear photo" |
| Pre-capture subtitle | "For best diagnostic results:" |
| Checklist item 1 | "Good natural light — no flash" |
| Checklist item 2 | "Tap to focus on the area" |
| Checklist item 3 | "Only the affected area in frame" |
| Checklist item 4 | "Hold still for 1 second" |
| CTA primary | "Take Photo" |
| CTA secondary | "Choose from Gallery" |
| Post-capture title | "Does this look clear?" |
| Post-checklist 1 | "Image is in sharp focus" |
| Post-checklist 2 | "Lighting is adequate" |
| Post-checklist 3 | "Only the affected area visible" |
| Submit | "Looks good — Analyze" |
| Retake | "Retake" |
| Blur error | "Photo looks blurry. Please retake in better light." |
| Dark error | "Photo is too dark. Move to a brighter area." |
| Glare error | "Too much glare. Turn off flash and try again." |

| Language | Status |
|---|---|
| English | ✅ Above |
| Spanish | 🔲 TODO — multilingual pass |
| Uzbek | 🔲 TODO — multilingual pass |
| Hindi | 🔲 TODO — multilingual pass |
| Korean | 🔲 TODO — multilingual pass |

---

## Where this lives in the codebase

| Component | File | Owner |
|---|---|---|
| Pre-capture overlay modal | `apps/patient/src/pages/Chat.tsx` | Otabek |
| Post-capture checklist | `apps/patient/src/pages/Chat.tsx` | Otabek |
| Client-side blur/brightness check | `apps/patient/src/lib/imageQuality.ts` (new) | Otabek |
| X-ray alignment overlay | `apps/patient/src/pages/Chat.tsx` (hint: `imageType === 'xray'`) | Otabek + Temirlan coord |
| Microscope alignment overlay | `apps/patient/src/pages/Chat.tsx` (hint: `imageType === 'smear'`) | Otabek + Temirlan coord |
