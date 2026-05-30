# Temirlan — Python / Medical Image ML

> **Role:** Owner of the medical image accuracy pipeline (Python sidecar `services/image-ml/`).
> **Identity check:** confirm "you are Temirlan" before proceeding.

---

## Why this lane exists

Generic multimodal LLMs (Gemini Vision, Claude Sonnet 4.5) read medical images at ~70–90% accuracy. For specific conditions — skin lesions, chest X-ray nodules, diabetic retinopathy — purpose-built CV models hit 92–95%+ on the same images. We want **specialist accuracy on the conditions that matter**, with the multimodal LLM as a generalist fallback and a natural-language explainer.

Temirlan owns the Python sidecar service that runs the specialist models and returns structured findings to the Node API.

## Lane

- `services/image-ml/` — entire FastAPI Python service
- Model selection, weights, preprocessing pipeline (OpenCV CLAHE / segmentation), inference, postprocessing
- Eval harness — accuracy benchmarks on public datasets
- Docker packaging (so it deploys cleanly alongside Node)

Temirlan does **not** edit:
- Node files (`apps/api/**/*.ts`) — Ismail wires the call site
- Shared schemas — propose changes in PR description, Ismail merges

## Pipeline (architecture, jointly designed with Ismail)

```
Patient uploads image (Chat.tsx / Reports.tsx)
   → POST /api/reports/analyze (Node, multer)
   → services/vision.ts  ──┬──→ multimodal LLM (always — generalist read)
                            └──→ services/image-ml/ POST /analyze  (if IMAGE_ML_URL env set)
                                  ├─ Triage step: what kind of image? (skin / xray / eye / other)
                                  ├─ Route to specialist model
                                  │    ├─ skin    → YOLOv8 trained on HAM10000 (7 lesion classes)
                                  │    ├─ xray    → TorchXRayVision (14 pathologies, CheXpert-trained)
                                  │    ├─ eye     → DR (diabetic retinopathy) classifier
                                  │    └─ other   → return { skipped: true }
                                  └─ Return { findings: [...], confidence, modelUsed, processingMs }
   ← Node merges: { llmReading + specialistFindings } → patient sees both, specialist marked clearly
```

The merge rule is important: **never silently override** the LLM. If the specialist disagrees, show *both* and let the patient/clinician see the disagreement.

## Recommended models (start here)

| Body part | Model | Source | License |
|---|---|---|---|
| Skin lesions (7 classes) | YOLOv8 fine-tuned on HAM10000 | https://www.kaggle.com/datasets/kmader/skin-cancer-mnist-ham10000 | CC BY-NC 4.0 (eval only) |
| Chest X-ray (14 pathologies) | TorchXRayVision DenseNet121 | https://github.com/mlmed/torchxrayvision | Apache 2.0 |
| Diabetic retinopathy | EyePACS-pretrained ResNet50 | https://www.kaggle.com/c/diabetic-retinopathy-detection | competition data |
| Image triage (which body part?) | Vision-language model OR small CNN you train | — | — |

For day-1 demo, ship just the skin lesion model (cleanest dataset, most photogenic for the demo). Add chest X-ray in week 2.

## Current sprint priorities

1. **`services/image-ml/main.py` skeleton** is already scaffolded. Read [`services/image-ml/README.md`](../../services/image-ml/README.md) and run `pip install -r requirements.txt && uvicorn main:app --reload --port 5001`. Confirm `/healthz` returns OK.
2. **Implement `/analyze` skin path** — accept image bytes, run HAM10000 YOLOv8, return top-3 lesion classes with confidence.
3. **Eval harness** — `services/image-ml/eval/` with held-out HAM10000 test split; report accuracy / sensitivity / specificity per class. Commit results to `services/image-ml/eval/results.md`.
4. **Pair with Ismail** for one session to walk through the Node↔Python contract. Get him comfortable running both.
5. **Docker** — `services/image-ml/Dockerfile` so Mirsaid can deploy it without Python expertise.

## Working style notes

- You're confident in OOP and use AI agents while developing. Good — but every model choice goes through Ismail (clinical-safety implication). Justify in the PR description: dataset size, license, accuracy claims, training set bias warning.
- Comments in Python: docstrings on public functions, type hints on every signature. No `Any` without a `# reason:` line — same rule as TypeScript.
- Big binary model weights → **never commit**. Add a `download_weights.sh` script + `.gitignore` rule.

## Escalation

- Node integration (how `vision.ts` calls the sidecar) → Ismail
- Adding a new dataset / model → Ismail must approve license + clinical use
- Anything else (preprocessing, postprocessing, internal Python structure) → your call

## Agent skills available

| Task | Skill | Example |
|---|---|---|
| FastAPI endpoints / Pydantic models | `/fastapi` | "Add a /analyze/batch endpoint with proper validation" |
| MongoDB queries from Python | `/mongodb` | "Query the referrals collection for image analysis stats" |
| Review your own code | `/code-review` | "Review my changes to the inference pipeline" |

**Workflow:** When adding a new model endpoint, use `/fastapi` to get the route + Pydantic schema right. The agent will enforce FastAPI best practices (dependency injection, proper status codes, async patterns).

## How to ask the agent

When you confirm identity as Temirlan, the agent has full edit rights inside `services/image-ml/`. It will gate you (warn + ask "did Ismail sign off?") on any Node file changes — that's by design. Use Ismail-supervised PRs for cross-service work.
