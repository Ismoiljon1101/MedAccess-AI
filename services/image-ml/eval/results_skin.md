# Skin Model Eval — ISIC 2018 Task 3 Test Set

**Date:** 2026-06-13 19:44 UTC  
**Model:** `skin-convnext-ham10000` (convnext)  
**Test set:** ISIC 2018 Task 3 held-out test set (1511 images, Harvard Dataverse doi:10.7910/DVN/DBW86T)  
**Errors/skipped:** 0  
**Avg inference time:** 296 ms/image (CPU)  

## Overall

| Metric | Score |
|---|---|
| Top-1 accuracy | **74.2%** (1121/1511) |
| Top-3 accuracy | **96.6%** (1459/1511) |

## Per-class recall (sensitivity)

| Class | Recall | Count |
|---|---|---|
| actinic keratosis | 58.1% | 25/43 |
| basal cell carcinoma | 55.9% | 52/93 |
| benign keratosis | 74.7% | 162/217 |
| dermatofibroma | 61.4% | 27/44 |
| melanoma | 60.2% | 103/171 |
| melanocytic nevus | 80.6% | 732/908 |
| vascular lesion | 57.1% | 20/35 |

## Notes

- Test set is the official ISIC 2018 Task 3 held-out set (not used in HAM10000 training).
- HAM10000 license: CC BY-NC 4.0 — research/eval only.
- None of these models are FDA/CE cleared.
- Inference on CPU only.