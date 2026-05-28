# Research Results — Open-Source Model Survey

> **Status:** ✅ Filled from "Medical ML for Rural Settings.md" (Ismail, 2026-05-28)
> **Source of truth:** [`Medical ML for Rural Settings.md`](./Medical%20ML%20for%20Rural%20Settings.md)
> **Architecture decision (locked):** Python sidecar for v0.1 — Browser WASM rejected. See `00-overview.md §3`.

---

## Disease 1: Malaria

| Model | Architecture | Trained on | Reported accuracy | License | Weights size | CPU inference (ms) | WASM viable? | Notes |
|---|---|---|---|---|---|---|---|---|
| **YOLOv8n-Malaria** | YOLOv8 nano | NIH Thin Blood Smear (27,558 images, bounding boxes) | 99.1% F1, 96.4% sensitivity, 97.2% specificity | **MIT ✅** | 12 MB | ~120 ms (ARM CPU) | ❌ Rejected (see §3) | Best choice; real-world drop 10–15% from stain variation |
| YOLOv5-Malaria | YOLOv5 | Various microscopy datasets | ~95% F1 | MIT | ~14 MB | ~180 ms | ❌ | Anchor-based; less accurate than v8; skip |
| Mask-RCNN Malaria | Mask-RCNN | NIH dataset | ~92% F1 | Apache 2.0 | ~180 MB | ~1200 ms | ❌ | Too heavy for edge; skip |

**Recommended for v0.1:** YOLOv8n-Malaria — MIT license, 12 MB, 120 ms, highest accuracy. Needs focus-locking slide adapter.

**Paper:** https://doi.org/10.7717/peerj.4568

---

## Disease 2: Pneumonia

| Model | Architecture | Trained on | Reported accuracy | License | Weights size | CPU inference (ms) | WASM viable? | Notes |
|---|---|---|---|---|---|---|---|---|
| **TorchXRayVision (DenseNet121-all)** | DenseNet-121 | CheXpert + NIH ChestX-ray14 + MIMIC-CXR + PadChest | 0.82–0.89 AUROC | **Apache 2.0 ✅** (data: VinDr-CXR is CC BY-NC) | 135 MB | ~850 ms | ❌ | Best multi-pathology CXR model; memory too high for mobile; use sidecar |
| YOLOv8-CXR / YOLO-CXR | YOLOv8 | VinDr-CXR (18k images) | ~0.84 AUROC (lesion detection) | AGPL-3.0 ⚠️ | ~15 MB | ~200 ms | ❌ | License risk (AGPL); data license CC BY-NC; conditional |
| Fast-YOLO / YOLOv11-CXR | YOLOv11 | Various CXR | ~0.81 AUROC | AGPL-3.0 ⚠️ | ~12 MB | ~150 ms | ❌ | Newer; less validated on lightbox photos |

**Recommended for v0.1:** TorchXRayVision DenseNet121-all — Apache 2.0, highest clinical validation, multi-institutional training. Requires X-ray alignment UI (coordinate with Otabek).

**Paper:** https://doi.org/10.48550/arXiv.2111.00595

---

## Disease 3: Skin Lesions / Melanoma

| Model | Architecture | Trained on | Reported accuracy | License | Weights size | CPU inference (ms) | WASM viable? | Notes |
|---|---|---|---|---|---|---|---|---|
| **YOLOv8n-cls (HAM10000)** | YOLOv8 nano (classification) | HAM10000 7-class (10,015 dermoscopic images) | 86.2% acc (91.9% with CLAHE preprocessing) | **CC BY-NC 4.0 ⚠️** | 16 MB | ~15 ms | ❌ | Demo/pilot only; non-commercial; fastest inference |
| MobileSAM (lesion segmentation) | Tiny-ViT encoder + SAM decoder | SA-1B + medical fine-tune | 0.74 IoU on skin | Apache 2.0 ✅ | <50 MB | ~280 ms | ❌ | Segmentation helper; not standalone classifier |
| ResNet50 + ISIC | ResNet-50 | ISIC 2019 (25,331 images, 9 classes) | ~88% accuracy | CC BY-NC ⚠️ | ~98 MB | ~350 ms | ❌ | Heavier; same license risk as HAM10000 |

**Recommended for v0.1:** YOLOv8n-cls / HAM10000 — fastest, smallest. Must label output as **non-commercial demo only**. Pair with polarized dermoscope clip.

**Paper:** https://doi.org/10.1038/s41591-020-0942-0

---

## Disease 4: Diabetic Retinopathy

| Model | Architecture | Trained on | Reported accuracy | License | Weights size | CPU inference (ms) | WASM viable? | Notes |
|---|---|---|---|---|---|---|---|---|
| **ResNet50-DR** | ResNet-50 | EyePACS + APTOS 2019 + Messidor (143,669 images) | 84.1% accuracy, 0.89 AUROC | Research / Non-Commercial ⚠️ | 98 MB | ~350 ms | ❌ | Mixed dataset licenses; viable for charity screenings only |
| EfficientNet-DR | EfficientNet-B4 | APTOS 2019 | ~90% QWK | Research ⚠️ | ~74 MB | ~280 ms | ❌ | Better accuracy but same license issue; more memory |

**Recommended for v0.1:** ResNet50-DR — best validated on the EyePACS/APTOS combination. Non-profit / charity deployment only until dataset licensing resolved.

**Paper:** https://doi.org/10.5566/ias.1155

---

## Disease 5: Scabies

| Model | Architecture | Trained on | Reported accuracy | License | Weights size | CPU inference (ms) | WASM viable? | Notes |
|---|---|---|---|---|---|---|---|---|
| **MobileNetV2-ScabAI** | MobileNetV2 | CMCH Scabio (800 clinically annotated images) | 87.5% acc, 83.3% recall, 86.96% F1 | Academic / Non-Commercial ❌ | 14 MB | ~80 ms | ❌ | Dataset too small; blocks deployment; defer |

**Recommended for v0.1:** ❌ **Defer.** 800-image dataset is clinically insufficient. Re-train on larger corpus post-MVP. LLM fallback for scabies symptoms in the meantime.

**Paper:** https://ieeexplore.ieee.org/document/11491676

---

## Generic helpers (cross-disease)

| Model | What it does | Worth integrating? | Notes |
|---|---|---|---|
| **MobileSAM** | Zero-shot lesion boundary segmentation | ⚠️ Optional — Phase 3 | Apache 2.0; 5M params; ~280ms; good for ROI extraction before classification |
| SAM (ViT-H) | Full SAM segmentation | ❌ No | 632M params; crashes edge device; too heavy |
| TorchXRayVision (segmentation) | Lung field segmentation | ⚠️ Useful for pneumonia | Apache 2.0; can crop ROI for DenseNet classifier |
| MONAI | PyTorch medical imaging pipeline | ⚠️ Dev framework | Useful for Temirlan's training pipeline; not a deployable model |

---

## Deployment matrix

| Model | Python sidecar ✅ | WASM (browser) ❌ | Phone native (TFLite/ONNX Mobile) | Verdict |
|---|---|---|---|---|
| YOLOv8n-Malaria | ✅ 120ms | ❌ Rejected | ✅ Post-MVP | **Ship Phase 1** |
| TorchXRayVision | ✅ 850ms | ❌ Memory crash | ⚠️ Too heavy for low-end | **Ship Phase 2** |
| YOLOv8n-cls Skin | ✅ 15ms | ❌ Rejected | ✅ Post-MVP | **Phase 3 (non-commercial only)** |
| ResNet50-DR | ✅ 350ms | ❌ Rejected | ⚠️ Memory heavy | **Non-profit only** |
| MobileNetV2-Scabies | ✅ 80ms | ❌ Rejected | ✅ Post-MVP | **Deferred — dataset too small** |
