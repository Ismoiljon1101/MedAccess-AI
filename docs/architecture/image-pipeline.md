# Medical Image Pipeline — Architecture

> **Owners:** Ismail (Node integration, clinical-safety merge rules) + Temirlan (Python specialist models)
> **Status:** scaffold shipped; specialist models not yet implemented

---

## Why a sidecar-only pipeline (v1.0 design)

Purpose-built CV models trained on labeled medical datasets (HAM10000 for skin, CheXpert for chest X-ray, EyePACS for diabetic retinopathy) reach **92–95%+** accuracy for the conditions they were trained on — well above what a generalist multimodal LLM achieves.

**The image NEVER goes to a cloud LLM.** Two reasons: privacy (medical images stay on local infra) and accuracy (the specialist sidecar is the source of truth). The pipeline is:

- **Specialist sidecar** (`services/image-ml/`) — runs the local CV models, returns structured per-class findings + confidence. This is the only thing that "sees" the image.
- **LLM** — receives the sidecar's findings **as text only** and writes a warm, plain-language explanation for the patient. It never reads the pixels.

**Graceful degradation (B6):** if the sidecar is unset or unreachable, the image is dropped (never uploaded anywhere) and the LLM returns general text-only guidance based on the image-type hint — the upload no longer hard-fails.

> Historical note: an earlier design proposed running a generalist LLM-vision read *and* the specialist in parallel and flagging disagreements. That "both reads" approach was dropped for v1.0 in favour of the privacy-preserving sidecar-only pipeline above.

---

## Request flow

```
Patient uploads image
    │
    ▼
apps/patient/src/pages/Chat.tsx  (or Reports.tsx)
    │   analyzeReport(file, language, sessionId)
    ▼
POST /api/reports/analyze   (Node, multer)
    │
    ├─────────────────────────────────────────────┐
    │                                              │
    ▼                                              ▼
services/vision.ts                          services/image-ml/  (Python, :5001)
   │ multimodal LLM call                       │ POST /analyze
   │ (always runs)                             │ (runs only if IMAGE_ML_URL env set,
   │                                           │  and service is reachable, and
   │                                           │  image type matches a loaded model)
   │                                           │
   │ returns:                                  │ returns:
   │   { imageType, qualityNotes,              │   { image_type, findings: [...],
   │     keyObservations, findings,            │     model_used, processing_ms,
   │     suggestedFollowUp, disclaimer }       │     skipped, skipped_reason }
   │                                           │
   └─────────────────┬─────────────────────────┘
                     ▼
            mergeReadings()  (Node)
                     │
                     ▼
            Combined response → patient sees both,
            with specialist findings marked "Specialist model: <name>"
            and any disagreement flagged
```

---

## Failure modes (all must degrade gracefully)

| What fails | Behaviour |
|---|---|
| `IMAGE_ML_URL` env not set | Node calls only the LLM. No degradation visible to user. |
| Python service unreachable (connection refused / timeout) | Log warning, fall back to LLM-only. Patient still gets a response. |
| Python returns `skipped: true` | LLM-only path. |
| Python returns malformed response | Log error, fall back to LLM-only. |
| LLM call fails | Return the specialist findings alone with a note "AI explanation unavailable, specialist model only." |
| Both fail | 503 with structured error. Patient sees "Image analysis temporarily unavailable. Please try again." |

---

## Why a Python sidecar (not Node-native)

- **Ecosystem.** Every serious medical-image model ships PyTorch / TF weights with Python loaders. Re-implementing in Node-native ONNX runtime is possible but doubles maintenance for zero accuracy gain.
- **Performance.** Inference loops belong in Python with NumPy/PyTorch SIMD, not in a single-threaded event loop.
- **Separation.** The Node API stays stateless, restart-fast, and the heavy Python service can be cold-started / scaled independently.
- **Skill match.** Temirlan is strong in Python. Ismail / Otabek are strong in TS. Clean split.

---

## Deployment notes

- Local dev: `cd services/image-ml && uvicorn main:app --reload --port 5001`. Node picks it up via `IMAGE_ML_URL=http://localhost:5001`.
- Docker: `docker build -t medaccess-image-ml services/image-ml && docker run -p 5001:5001 medaccess-image-ml`.
- Production (post-MVP): the sidecar runs as a separate service (Fly.io, Railway, or a GPU instance for chest X-ray). Node API and Python service communicate over private network.

---

## Open questions (decide before week 2)

- [ ] Do we run image triage (skin vs xray vs eye) inside the Python service or via a lightweight LLM call from Node?
- [ ] Per-condition confidence thresholds — fixed (e.g. 0.7) or per-model calibrated?
- [x] ~~Disagreement UI — display both reads.~~ Dropped: sidecar-only pipeline (no second LLM-vision read to disagree with).
