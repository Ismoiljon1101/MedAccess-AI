# Research Results — Datasets & Licenses

> **Status:** ✅ Filled from "Medical ML for Rural Settings.md" (Ismail, 2026-05-28)
> **Source of truth:** [`Medical ML for Rural Settings.md`](./Medical%20ML%20for%20Rural%20Settings.md)

---

## License legend

- ✅ **Commercial-safe**: MIT, Apache 2.0, BSD, CC0, CC BY
- ⚠️ **Demo-only**: CC BY-NC (non-commercial), research-only, Kaggle competition terms
- ❌ **Blocked**: proprietary, no clear license, restrictive terms, academic-only

---

## Datasets reviewed

| Dataset | Disease | Size (labeled) | License | Commercial-safe? | Demographic bias | Quality | Notes |
|---|---|---|---|---|---|---|---|
| **NIH Thin Blood Smear** | Malaria | 27,558 images w/ bounding boxes | Public Domain / NIH ✅ | ✅ Yes | Sub-Saharan African samples | Expert-annotated via algorithm | Used by YOLOv8n-Malaria |
| **CheXpert** | Pneumonia / Chest pathologies | 224,316 CXR images | Stanford research ⚠️ | ❌ No (research only) | US hospital patients | Radiologist labels | Component of TorchXRayVision |
| **NIH ChestX-ray14** | Chest pathologies | 112,120 images | CC0 ✅ | ✅ Yes | NIH Clinical Center (US) | NLP-mined labels (noisier) | Component of TorchXRayVision |
| **MIMIC-CXR** | Chest pathologies | 227,827 images | PhysioNet (research) ⚠️ | ❌ No | Beth Israel Deaconess (US) | Radiologist reports | Component of TorchXRayVision |
| **VinDr-CXR** | Chest pathologies | 18,000 images | CC BY-NC ⚠️ | ❌ No | Vietnamese patients | 17-radiologist consensus | Blocks commercial CXR deployment |
| **PadChest** | Chest pathologies | 160,000 images | Research ⚠️ | ❌ No | Spanish hospital | Radiologist + NLP | Component of TorchXRayVision |
| **HAM10000** | Skin lesions (7 classes) | 10,015 dermoscopic | CC BY-NC 4.0 ⚠️ | ❌ No | Mostly Fitzpatrick I–III (fair skin) | Expert-labeled, polarized dermoscope | Blocks commercial skin model |
| **ISIC 2019** | Skin (9 classes) | 25,331 images | CC BY-NC ⚠️ | ❌ No | Mixed (mostly fair-skin) | Expert-labeled | Larger than HAM10000; same license |
| **EyePACS** | Diabetic retinopathy | ~35,000 labeled | Kaggle competition ⚠️ | ❌ Unclear | US diabetic patients | Ophthalmologist grades | Combined with APTOS + Messidor for ResNet50-DR |
| **APTOS 2019** | Diabetic retinopathy | 3,662 images | Kaggle competition ⚠️ | ❌ Unclear | Indian patients (rural!) | Ophthalmologist grades | Good demographic fit; license unclear |
| **Messidor** | Diabetic retinopathy | ~1,200 images | Research ⚠️ | ❌ No | French hospital | Expert grades | Small; only used to supplement |
| **CMCH Scabio** | Scabies | 800 images | Academic / Non-Commercial ❌ | ❌ No | Outpatient clinic | Clinical annotation | Too small; license blocked |

---

## Real-world accuracy drop (benchmark → phone photos)

| Model | Benchmark accuracy | Estimated real-world accuracy | Drop | Primary cause | Source |
|---|---|---|---|---|---|
| YOLOv8n-Malaria | 99.1% F1 | ~85–89% F1 | **10–15%** | Stain quality variation, focus drift, dust on slides | Research doc §Malaria Risks |
| TorchXRayVision CXR | 0.82–0.89 AUROC | ~0.62–0.74 AUROC | **15–25%** | Parallax, lightbox reflections, non-DICOM capture | Research doc §Pneumonia Risks |
| YOLOv8n-cls Skin | 86.2% accuracy | ~68–74% accuracy | **15–20%** | No polarized lens, ambient lighting, skin-tone bias | Research doc §Skin Risks |
| ResNet50-DR | 84.1% / 0.89 AUROC | ~67–72% accuracy | **15–20%** | Off-axis pupil, blur, undilated pupil, dust on adapter | Research doc §Retinopathy Risks |
| MobileNetV2-ScabAI | 87.5% accuracy | ~70–74% accuracy | **15–20%** | Scratching/pyoderma masks burrows, lighting variation | Research doc §Scabies Risks |

**Key finding:** All models lose 10–25% on non-curated phone photos. Image quality UX (file 06) is **non-negotiable** — not a nice-to-have.

---

## Go / no-go per dataset

| Dataset | Decision | Reason |
|---|---|---|
| NIH Thin Blood Smear | ✅ **Go** | Public domain; 27k images; directly used by ship-ready YOLOv8n-Malaria |
| NIH ChestX-ray14 | ✅ **Go** (component) | CC0; part of TorchXRayVision multi-dataset training |
| HAM10000 | ⚠️ **Demo/pilot only** | CC BY-NC blocks commercial use; humanitarian programs only |
| ISIC 2019 | ⚠️ **Demo/pilot only** | Same CC BY-NC block |
| CheXpert | ❌ **No** (standalone) | Stanford research-only; bundled via TorchXRayVision which is Apache 2.0 |
| VinDr-CXR | ❌ **No** (standalone) | CC BY-NC; used indirectly via TorchXRayVision — flag for legal review |
| MIMIC-CXR | ❌ **No** (standalone) | PhysioNet credentialed access; research only |
| EyePACS | ⚠️ **Non-profit only** | Kaggle competition terms ambiguous; consult counsel before commercial use |
| APTOS 2019 | ⚠️ **Non-profit only** | Same ambiguity; good demographic coverage (Indian rural patients) |
| Messidor | ❌ **No** (standalone) | Research license; too small to be useful anyway |
| CMCH Scabio | ❌ **Blocked** | Academic non-commercial + 800 images too small; defer entire scabies model |

---

## Ismail's open action items (post-MVP)

- [ ] Negotiate or find alternate commercial-safe datasets to replace HAM10000 / ISIC for skin model
- [ ] Get legal review on EyePACS / APTOS Kaggle terms before commercial DR screening deployment
- [ ] Vet VinDr-CXR license risk for TorchXRayVision — Apache 2.0 library, but training data is CC BY-NC
- [ ] Source larger scabies dataset (minimum ~5,000 labeled images) with commercial-safe license
