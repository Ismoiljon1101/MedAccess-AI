# MedAccess Image ML

> Python FastAPI sidecar for specialist medical-image inference.
> Called by the Node API (`apps/api/src/services/vision.ts`) for body-part-specific accuracy that generic multimodal LLMs cannot match.

**Owner:** Temirlan (models, preprocessing, eval) · **Interface owner:** Ismail (HTTP contract, Node integration)

---

## Why this service exists

Generic multimodal LLMs read medical images at roughly **70–90% accuracy** on common tasks. For specific conditions — skin lesions, chest X-ray nodules, diabetic retinopathy — purpose-built CV models reach **92–95%+** on the same datasets. We want specialist accuracy on the conditions that matter, with the LLM as a generalist fallback and natural-language explainer.

The Node API always calls the multimodal LLM **and** (when this sidecar is reachable) the specialist model. The patient sees both reads. Disagreements are surfaced, never silently overridden — clinical safety floor.

---

## Run it locally

```bash
cd services/image-ml
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS:    source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 5001
```

Then:
```bash
curl http://localhost:5001/healthz
# → { "ok": true, "service": "medaccess-image-ml", ... }
```

To call from Node, set `IMAGE_ML_URL=http://localhost:5001` in the root `.env`. If the env var is unset, the Node API skips this sidecar entirely (graceful degradation).

---

## HTTP contract (stable — do not break)

### `GET /healthz`
```json
{ "ok": true, "service": "medaccess-image-ml", "version": "0.1.0", "models_loaded": [] }
```

### `POST /analyze`
Multipart form: `image` (file, required), `hint` (string, optional — one of `skin` / `xray` / `eye`).

**Response (matches `AnalyzeResponse` in `main.py`):**
```json
{
  "image_type": "skin",
  "skipped": false,
  "skipped_reason": "",
  "findings": [
    { "label": "melanoma",      "confidence": 0.87, "notes": "ABCD criteria suggest..." },
    { "label": "seborrheic keratosis", "confidence": 0.09, "notes": "" }
  ],
  "model_used": "yolov8-ham10000-v1",
  "processing_ms": 412
}
```

`skipped: true` means no specialist model handled this image (e.g. body part not yet supported). Node ignores it and uses just the LLM reading.

---

## Roadmap (Temirlan's sprint)

**Research locked** (see [`research/00-overview.md`](../../research/00-overview.md) + [`research/Medical ML for Rural Settings.md`](../../research/Medical%20ML%20for%20Rural%20Settings.md)):

| Phase | Disease | Model | Dataset | License | Target accuracy | Status |
|---|---|---|---|---|---|---|
| **1. Malaria** (ship first — MIT, fastest inference) | Malaria smear | YOLOv8n-Malaria | NIH Thin Blood Smear | MIT ✅ | ≥ 96% sensitivity | 🔲 Todo |
| **2. Pneumonia** (coordinate with Otabek on X-ray alignment UI) | Pneumonia | TorchXRayVision DenseNet121 | VinDr-CXR + CheXpert + MIMIC-CXR + PadChest | Apache 2.0 ✅ | ≥ 0.85 AUROC | 🔲 Todo |
| **3. Skin lesions** (non-commercial pilot only) | Skin/melanoma | YOLOv8n-cls + CLAHE | HAM10000 (7 classes) | CC BY-NC ⚠️ | ≥ 91% top-3 (w/ CLAHE) | 🔲 Todo |
| *Defer v0.1* | Diabetic retinopathy | ResNet50-DR | EyePACS + APTOS + Messidor | Non-commercial ⚠️ | ≥ 0.89 AUROC | Deferred |
| *Defer v0.1* | Scabies | MobileNetV2-ScabAI | CMCH Scabio | Non-commercial ❌ | 87.5% accuracy | Deferred — dataset too small |

Eval results go into `services/image-ml/eval/results.md` per phase — committed alongside model code so reviewers can verify clinical claims.

---

## Don't commit

- Trained / downloaded model weights (use `download_weights.sh` instead)
- Local `.venv/`
- `__pycache__/`, `.pytest_cache/`
- Any dataset files

(Add to root `.gitignore` if not already there.)

---

## Escalation

- HTTP contract changes (request or response shape) → Ismail must approve. Node depends on it.
- Adding a new dataset or model → check the license and clinical-use restrictions. HAM10000 is CC BY-NC 4.0 (research/eval only) — fine for a demo, **not** fine for a commercial deployment without renegotiating.
- Anything internal (preprocessing pipeline, threshold tuning, code structure) → Temirlan's call.
