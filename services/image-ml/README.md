# MedAccess Image ML

> Python FastAPI sidecar for specialist medical-image inference.
> Called by the Node API (`apps/api/src/services/vision.ts`) for body-part-specific accuracy that generic multimodal LLMs cannot match.

**Owner:** Temirlan (models, preprocessing, eval) · **Interface owner:** Ismail (HTTP contract, Node integration)

---

## Why this service exists

Generic multimodal LLMs read medical images at roughly **70–90% accuracy** on common tasks. For specific conditions — skin lesions, chest X-ray findings, diabetic retinopathy — purpose-built CV models reach **92–95%+** on the same datasets. We want specialist accuracy on the conditions that matter, with the LLM as a generalist fallback and natural-language explainer.

The Node API always calls the LLM **and** (when this sidecar is reachable) the specialist model. The patient sees both reads. Disagreements are surfaced, never silently overridden — clinical safety floor.

---

## Run it locally

```bash
cd services/image-ml
python -m venv venv
# Windows:  venv\Scripts\activate
# macOS:    source venv/bin/activate
pip install -r requirements.txt
python main.py   # boots on :5001, auto-downloads missing weights
```

> **Windows only:** TorchXRayVision's download progress bar uses Unicode block characters that
> Windows cp1252 can't encode. Set `PYTHONUTF8=1` before starting the server, or the first
> X-ray inference call will crash while downloading weights (~135 MB):
> ```
> $env:PYTHONUTF8 = "1"; python main.py
> ```

Then verify:
```bash
curl http://localhost:5001/healthz
# → { "ok": true, "models_loaded": ["skin-convnext-ham10000", "eye-dr-onnx", "torchxrayvision-available"], ... }
```

To call from Node, set `IMAGE_ML_URL=http://localhost:5001` in the root `.env`.

Set `SKIP_MODEL_DOWNLOADS=1` to boot without downloading (air-gapped / CI).

---

## Specialist models

On first boot, `model_manager.py` auto-downloads any missing weights from HuggingFace into `models/`.

| Modality | Model | Source | Size | Status |
|---|---|---|---|---|
| **Skin lesions** (7 classes) | ConvNeXt-Base HAM10000 | `Ratnakar01/convnext_ham10000_best` | 334 MB | Live — auto-downloads |
| **Chest X-ray** (18 pathologies) | TorchXRayVision DenseNet121-all | txrv CDN (Apache 2.0) | ~135 MB | Live — downloads on first inference |
| **Diabetic retinopathy** (binary) | DR ONNX classifier | `BlairFerg/diabetic-retinopathy-detection` | 214 MB | Live — auto-downloads |
| **Malaria** blood smear | YOLOv8s | ~~keremberke/yolov8s-malaria-detection~~ | — | Broken — HF source 401. Blocked on Temirlan picking replacement or training. |

**Planned upgrade (blocked):** EfficientNet-B0 (95.5% accuracy) is the locked skin model decision (Ismail, 2026-06-04). Blocked on ONNX conversion on x86/Mac. ConvNeXt is the temporary replacement until conversion is done. See `convert_skin_to_onnx.py`.

Manual download control:
```bash
python download_weights.py           # download any missing managed weights
python download_weights.py --force   # re-download everything

curl -X POST http://localhost:5001/admin/pull-models          # via API
curl -X POST 'http://localhost:5001/admin/pull-models?force=true'
```

---

## HTTP contract (stable — do not break without Ismail)

### `GET /healthz`
```json
{
  "ok": true,
  "service": "medaccess-image-ml",
  "version": "0.3.0",
  "models_loaded": ["skin-convnext-ham10000", "eye-dr-onnx", "torchxrayvision-available"],
  "managed_models": {
    "skin-convnext-ham10000": { "present": true, "size_mb": 334 },
    "eye-dr-onnx": { "present": true, "size_mb": 214 }
  }
}
```

### `POST /analyze`
Multipart form: `image` (file, required) · `hint` (string, optional: `skin` / `xray` / `eye` / `malaria`)

If no `hint` is passed, the sidecar auto-detects image type using:
- Low HSV saturation → X-ray
- High saturation + dark circular vignette + reddish hue → eye fundus
- High saturation (no fundus pattern) → skin

**Response:**
```json
{
  "image_type": "skin",
  "skipped": false,
  "skipped_reason": "",
  "findings": [
    { "label": "melanoma", "confidence": 0.87, "notes": "ConvNeXt HAM10000 community checkpoint" },
    { "label": "benign keratosis", "confidence": 0.06, "notes": "" }
  ],
  "model_used": "skin-convnext-ham10000",
  "processing_ms": 412
}
```

`skipped: true` means no specialist model handled this image. Node falls back to LLM-only reading.

---

## Eval harness

Run accuracy benchmarks against the official ISIC 2018 Task 3 held-out test set (1512 images, no Kaggle required):

```bash
# Download test set + run eval (one command)
python eval/download_sample.py

# Re-run eval on already-downloaded images
python eval/download_sample.py --skip-download

# Full HAM10000 eval (if you have the dataset)
python eval/skin_eval.py --raw-dir data/ham10000_raw --meta-csv data/ham10000_metadata.csv
```

Results are written to `eval/results_skin.md` — commit this file after each eval run.

**Accuracy note:** The skin (ConvNeXt) and eye (DR ONNX) checkpoints are open-weight community models. See `eval/results_skin.md` for current benchmark numbers. None are FDA/CE cleared.

---

## Inference sanity check

Quick test that models load and forward-pass correctly (no dataset needed):

```bash
python test_inference.py              # synthetic images
python test_inference.py --image path/to/image.jpg  # real image
```

Checks: model loads without partial-weight failures, output probabilities are valid (sum ~1.0, no NaN/Inf), auto-detection heuristics work correctly.

---

## Development notes

### Adding a new model
1. Add a `ManagedModel` entry to `model_manager.py` → `MODELS` list
2. Add a loader function in `main.py` following the `get_skin_model()` pattern
3. Add inference logic in the `/analyze` endpoint
4. Add your modality to `detect_image_type()` if auto-detection is needed
5. Write an eval script in `eval/` before claiming accuracy numbers
6. Model choice / license / clinical use → Ismail must approve (soft gate)

### Preprocessing
- **Skin:** CLAHE contrast enhancement on L channel (LAB space) — boosts accuracy ~5% on dermoscopy vs raw
- **X-ray:** grayscale normalize to TorchXRayVision expected range, resize 224×224
- **Eye:** ImageNet normalization (mean/std), resize 224×224

### ONNX models
Some ONNX models (e.g. the DR eye classifier) bake softmax into the graph. Always check raw output before assuming it's logits. The sidecar detects this automatically: if raw output already sums to ~1.0, softmax is not applied again.

---

## Known issues and further work needed

### Your lane (Temirlan)
| # | Issue | Priority |
|---|---|---|
| 1 | **Malaria model** — HF source dead, no replacement wired. Pick checkpoint or train from `electricsheepafrica/malaria-parasite-detection-yolo` dataset. | High |
| 2 | **EfficientNet-B0 skin model** — blocked on ONNX conversion on x86/Mac (Ismail's machine). Once `models/skin-xception.onnx` arrives, sidecar auto-loads it. | Blocked on Ismail |
| 3 | **Eye eval harness** — no `eval/eye_eval.py` yet. DR ONNX accuracy unverified. | Medium |
| 4 | **X-ray eval harness** — no `eval/xray_eval.py` yet. TorchXRayVision AUROC on VinDr-CXR unverified. | Medium |
| 5 | **Docker verify** — run `docker build` and confirm container starts clean. | Medium |

### Node side (Ismail's lane — flag in PR)
| # | Issue |
|---|---|
| 6 | `MLAnalyzeResponse` in `vision.ts` is missing `"malaria"` from the `image_type` union |
| 7 | Hint regex in `vision.ts` has no malaria keywords (`blood smear`, `microscopy`, `malaria`) |
| 8 | `IMAGE_ML_URL` unset throws 503 — but architecture docs say graceful degradation. Clarify intent. |

---

## Don't commit

- Model weights (`models/*.pt`, `*.pth`, `*.onnx`) — use `download_weights.py` instead
- `venv/` — recreate with `pip install -r requirements.txt`
- `eval/sample_data/` — downloaded test images (large, re-downloadable)
- `data/` — training datasets
- `__pycache__/`

---

## Escalation

- HTTP contract changes (request/response shape) → Ismail must approve
- New model / dataset → Ismail approves license + clinical-use restrictions
- Preprocessing, inference internals, eval scripts → Temirlan's call
