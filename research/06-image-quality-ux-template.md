# Research Results — Image Quality UX

> **Template.** How to nudge patients to take medical-grade photos with their phones.
> **Owner once research lands:** Otabek (`apps/patient/src/pages/Chat.tsx`)

---

## What makes a good medical photo

| Property | Rule | Why |
|---|---|---|
| Lighting | Natural daylight, no flash | Flash creates glare, washes out color |
| Focus | Tap-to-focus, hold still 1s | Blur kills model accuracy |
| Framing | Lesion centered, fills ~50% of frame | Too small = no detail, too large = no context |
| Background | Plain (white paper, hand on table) | Cluttered background confuses model |
| Distance | 15–30cm for skin | Closer than 15cm = phone can't focus |
| Scale reference | Coin or ruler optional | Helps clinician judge size |
| Privacy | No face, no identifying marks unless needed | Patient dignity + reduces PII risk |
| Body coverage | Only the affected area | Avoid undressed patient photos |

---

## UX patterns from similar apps (research target)

| App | Onboarding pattern | What works | What we'd change |
|---|---|---|---|
| _SkinVision_ |  |  |  |
| _FirstDerm_ |  |  |  |
| _Aysa_ |  |  |  |

---

## Proposed UX (sketch)

```
Patient taps Image button in Chat
    ↓
┌─────────────────────────────┐
│ 📸 Take a clear photo        │
├─────────────────────────────┤
│ For best results:            │
│  ✅ Good natural light       │
│  ✅ Focus on the area        │
│  ❌ Avoid flash glare        │
│  ❌ No other body parts      │
│                              │
│ [Take photo] [Use existing]  │
└─────────────────────────────┘
    ↓ photo taken
┌─────────────────────────────┐
│ Preview:                     │
│   [image]                    │
│                              │
│ Does it look clear?          │
│   ☐ Sharp focus              │
│   ☐ Good lighting            │
│   ☐ Only the affected area   │
│                              │
│ [Looks good] [Retake]        │
└─────────────────────────────┘
    ↓ submitted
analyze normally
```

---

## Optional: client-side auto-quality gate

If we want to go further:

| Check | How | Library | Effort |
|---|---|---|---|
| Blur detection | Variance of Laplacian | OpenCV.js | Small |
| Low-light detection | Brightness histogram | Canvas API | Small |
| Multi-object detection | YOLO-tiny in browser | ONNX.js | Medium |
| Face detection (auto-blur) | Mediapipe / FaceMesh | Mediapipe | Medium |

Reject + reprompt if quality fails before sending to backend = save tokens + better results.

---

## Modal copy (locked once translated)

_To be filled per language during multilingual pass._

| Language | Modal title | Checklist items |
|---|---|---|
| English |  |  |
| Spanish |  |  |
| Uzbek |  |  |
| Hindi |  |  |
