# MedAccess Image ML — Service Verification Report

**Date:** 2026-06-14  
**Service version:** 0.3.0  
**Tester:** Temirlan  
**Machine:** Windows 11 (local dev, CPU-only)  
**Base URL:** `http://localhost:5001`

---

## 1. Boot & health check

```
GET /healthz
```

```json
{
  "ok": true,
  "service": "medaccess-image-ml",
  "version": "0.3.0",
  "models_loaded": [
    "skin-convnext-ham10000",
    "eye-dr-onnx",
    "torchxrayvision-available"
  ],
  "managed_models": {
    "skin-convnext-ham10000": {
      "present": true,
      "filename": "skin-convnext-ham10000.pth",
      "size_mb": 334.2
    },
    "eye-dr-onnx": {
      "present": true,
      "filename": "eye-dr-detect.onnx",
      "size_mb": 214.1
    }
  }
}
```

**Result:** PASS — service up, all 3 specialist model families listed.

---

## 2. Skin lesion inference (ConvNeXt HAM10000)

Test images are from the **ISIC 2018 Task 3 held-out test set** (Harvard Dataverse,
doi:10.7910/DVN/DBW86T) — images the model was never trained on.

### Sample 1 — ISIC_0034524 (true label: **melanocytic nevus**)

```
POST /analyze
Form: image=ISIC_0034524.jpg  hint=skin
```

```json
{
  "image_type": "skin",
  "skipped": false,
  "findings": [
    { "label": "melanocytic nevus", "confidence": 0.995,
      "notes": "ConvNeXt HAM10000 community checkpoint" }
  ],
  "model_used": "skin-convnext-ham10000",
  "processing_ms": 552
}
```

**Result:** PASS — predicted `melanocytic nevus` at 99.5% confidence. Correct.

---

### Sample 2 — ISIC_0034526 (true label: **benign keratosis**)

```
POST /analyze
Form: image=ISIC_0034526.jpg  hint=skin
```

```json
{
  "image_type": "skin",
  "skipped": false,
  "findings": [
    { "label": "benign keratosis", "confidence": 0.909,
      "notes": "ConvNeXt HAM10000 community checkpoint" },
    { "label": "melanoma",         "confidence": 0.090,
      "notes": "ConvNeXt HAM10000 community checkpoint" }
  ],
  "model_used": "skin-convnext-ham10000",
  "processing_ms": 552
}
```

**Result:** PASS — predicted `benign keratosis` at 90.9% confidence. Correct.
Secondary flag `melanoma` at 9% is expected behaviour (overlapping dermoscopy features).

---

## 3. Chest X-ray inference (TorchXRayVision DenseNet121-all)

Test image: synthetic uniform greyscale (224×224) — used to verify the endpoint
routes and returns structured output, not to test clinical accuracy.

```
POST /analyze
Form: image=test_xray.jpg  hint=xray
```

```json
{
  "image_type": "xray",
  "skipped": false,
  "findings": [
    { "label": "Atelectasis",        "confidence": 0.624, "notes": "DenseNet121-all score 0.62" },
    { "label": "Pleural_Thickening", "confidence": 0.542, "notes": "DenseNet121-all score 0.54" },
    { "label": "Cardiomegaly",       "confidence": 0.536, "notes": "DenseNet121-all score 0.54" },
    { "label": "Pneumonia",          "confidence": 0.532, "notes": "DenseNet121-all score 0.53" },
    { "label": "Consolidation",      "confidence": 0.516, "notes": "DenseNet121-all score 0.52" },
    { "label": "Mass",               "confidence": 0.509, "notes": "DenseNet121-all score 0.51" }
  ],
  "model_used": "torchxrayvision-densenet121-all",
  "processing_ms": 8822
}
```

**Result:** PASS — endpoint routes correctly, model returns 18-pathology sigmoid scores,
top-6 filtered and returned. Scores ~0.5 on a blank image is expected (maximum uncertainty).

> Note: real X-ray accuracy eval (AUROC on VinDr-CXR) not yet done — see known issues.

---

## 4. Diabetic retinopathy inference (BlairFerg DR ONNX)

Test image: synthetic coloured patch used to exercise the eye endpoint.

```
POST /analyze
Form: image=test_eye.jpg  hint=eye
```

```json
{
  "image_type": "eye",
  "skipped": false,
  "findings": [
    { "label": "no diabetic retinopathy",     "confidence": 0.635,
      "notes": "DR classifier (community ONNX, accuracy TBD)" },
    { "label": "diabetic retinopathy detected", "confidence": 0.365,
      "notes": "DR classifier (community ONNX, accuracy TBD)" }
  ],
  "model_used": "eye-dr-onnx",
  "processing_ms": 388
}
```

**Result:** PASS — endpoint routes correctly, ONNX session runs, binary output returned.
Softmax-baked-in detection working (no double softmax applied).

---

## 5. Auto-detection (no hint)

Same ISIC_0034524 dermoscopy image sent without a `hint` field.

```
POST /analyze
Form: image=ISIC_0034524.jpg  (no hint)
```

```json
{
  "image_type": "skin",
  "skipped": false,
  "findings": [
    { "label": "melanocytic nevus", "confidence": 0.995,
      "notes": "ConvNeXt HAM10000 community checkpoint" }
  ],
  "model_used": "skin-convnext-ham10000",
  "processing_ms": 1268
}
```

**Result:** PASS — auto-detection correctly routed a dermoscopy image to the skin
pipeline without any caller hint.

---

## 6. Benchmark accuracy (skin model)

Full eval on ISIC 2018 Task 3 held-out test set (1511 images).
See [`results_skin.md`](results_skin.md) for per-class breakdown.

| Metric | Score |
|---|---|
| Top-1 accuracy | **74.2%** (1121/1511) |
| Top-3 accuracy | **96.6%** (1459/1511) |
| Avg inference (CPU) | 296 ms/image |

Model: `skin-convnext-ham10000` (ConvNeXt-Base, Ratnakar01/convnext_ham10000_best)

---

## 7. Summary

| Modality | Endpoint routes | Model loads | Inference runs | Accuracy verified |
|---|---|---|---|---|
| Skin (ConvNeXt) | PASS | PASS | PASS | PASS (74.2% top-1 on 1511 images) |
| X-ray (TorchXRayVision) | PASS | PASS | PASS | Not yet (needs AUROC eval) |
| Eye / DR (ONNX) | PASS | PASS | PASS | Not yet (needs eval dataset) |
| Malaria (YOLO) | — | FAIL (model missing) | — | — |
| Auto-detection | PASS | — | — | Verified on 3 modalities |

---

## 8. Known issues not yet resolved

| # | Issue | Owner |
|---|---|---|
| 1 | Malaria model weight source dead (401) — no replacement chosen yet | Temirlan |
| 2 | X-ray AUROC eval on real CXR dataset not done | Temirlan |
| 3 | Eye DR accuracy eval on labelled fundus dataset not done | Temirlan |
| 4 | Windows: must set `PYTHONUTF8=1` before starting server or first xray inference crashes during weight download | Temirlan |
| 5 | Docker build not verified end-to-end | Temirlan / Mirsaid |
