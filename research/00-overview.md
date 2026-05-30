# Research — Overview & Decisions

> **Source of truth:** [`Medical ML for Rural Settings.md`](./Medical%20ML%20for%20Rural%20Settings.md) — full annotated report with citations.
> **This file:** decisions extracted from that report, for engineering execution.
> **Status:** ✅ research complete · Temirlan is unblocked.

---

## 1. Top 5 diseases (Pareto-locked)

Selected by prevalence in target markets (rural Uzbekistan, sub-Saharan Africa, South Asia) × visual-diagnosability × clinical impact:

| # | Disease | Imaging | Why this disease |
|---|---|---|---|
| 1 | **Malaria** | Microscopy (Giemsa thin smear) | Up to 40% of pediatric outpatient visits in endemic sub-Saharan regions |
| 2 | **Pneumonia** | Chest X-ray (photographed off lightbox) | ~15% of under-5 outpatient visits in rural South Asia |
| 3 | **Skin lesions / melanoma** | Smartphone dermatology | ~15% of primary care visits in tropical/rural regions |
| 4 | **Diabetic retinopathy** | Smartphone fundoscopy adapter | 8–12% of diabetic outpatients in transitioning economies |
| 5 | **Scabies** | Macro smartphone photo | 10–20% of outpatient dermatology presentations |

---

## 2. Model decisions per disease

| # | Model | License | Accuracy | CPU latency | Size | Decision | Notes |
|---|---|---|---|---|---|---|---|
| 1 | **YOLOv8n-Malaria** (NIH Thin Blood Smear) | MIT ✅ | 99.1% F1 / 96.4% sens | ~120ms | 12 MB | **✅ Ship now** | Permissive license, fast, accurate. Needs focus-locking slide adapter to minimize blur. |
| 2 | **TorchXRayVision (DenseNet121-all)** | Apache 2.0 ✅ (but VinDr-CXR data CC BY-NC) | 0.82–0.89 AUROC | ~850ms | 135 MB | **⚠️ Conditional** | Requires alignment UI for X-ray photography. Local Python sidecar (too heavy for mobile). |
| 3 | **YOLOv8n-cls / HAM10000** | CC BY-NC 4.0 ⚠️ | 86.2% (91.9% w/ CLAHE preprocessing) | ~15ms | 16 MB | **🔴 UPGRADE NEEDED** | Non-commercial license + low accuracy. See §2b for better alternatives. |
| 4 | **ResNet50-DR** | Research / non-commercial ⚠️ | 84.1% (0.89 AUROC) | ~350ms | 98 MB | **⚠️ Non-profit only** | Mixed non-commercial dataset licenses. Viable for charity screenings. |
| 5 | **MobileNetV2-ScabAI** | Academic / non-commercial ⚠️ | 87.5% acc / 83.3% recall | ~80ms | 14 MB | **❌ Defer** | Dataset too small (800 images), licensing blocks deployment. Re-train on larger corpus later. |

**Real-world accuracy drop:** all models lose 10–25% on non-curated phone photos vs benchmark. The image-quality UX (§4 below) is non-negotiable — not a nice-to-have.

---

## 2b. Skin Model Upgrade — Better Alternatives Found (2026-05-30)

Original plan (HAM10000 YOLOv8n-cls, 86.2%) is **insufficient** — no pre-trained weights, non-commercial license, low accuracy. Better options:

| Model | Architecture | Accuracy | License | Effort | Link |
|---|---|---|---|---|---|
| **Skin_Disease_AI** | Xception CNN | **92%** | Open | Clone + extract | [github.com/NadavIs56/Skin_Disease_AI](https://github.com/NadavIs56/Skin_Disease_AI) |
| **Skin-Disease-Detection** | EfficientNet-B0 | **95.5%** | Open | Clone + convert | [github.com/MahimaKhatri/Skin-Disease-Detection](https://github.com/MahimaKhatri/Skin-Disease-Detection) |
| **YOLO11 Skin Disease** | YOLO11 | — | Open | Download weights | [pyresearch on YouTube](https://www.youtube.com/watch?v=nz6Ta90BOtM) |
| **Roboflow skin-disease-ia** | CNN | — | **CC BY 4.0 ✅** | API / download | [universe.roboflow.com](https://universe.roboflow.com/health-ai-detection/skin-disease-ia-detection) |

**Better training datasets:**
- **ISIC Archive** — 85,000+ images, melanoma + BCC + SCC + benign — gold standard
- **Fitzpatrick 17K** — 16,577 images, diverse skin tones (critical for reducing bias on darker skin)
- **DermaMNIST** — 10,015 lightweight images for fast experiments

**Decision needed (Ismail):** Choose model before Temirlan integrates. Recommendation:
- **v0.1 demo:** Use `Skin_Disease_AI` (Xception 92%, open) — clone, extract weights, wire into sidecar
- **v0.2 production:** Train EfficientNet-B0 on ISIC + Fitzpatrick 17K → 95%+ with skin tone coverage

---

## 3. Architecture decision (locked)

The research evaluated three execution paths:

| Path | Latency | Verdict |
|---|---|---|
| **ONNX Runtime Mobile + NNAPI/CoreML** (native wrapper) | ~100ms | ✅ Best long-term; post-MVP |
| **Local Python sidecar + WiFi** | ~200ms | ✅ **Use for v0.1** (we already have `services/image-ml/`) |
| **Browser WASM (onnxruntime-web)** | 1.5–3.0s | ❌ **Rejected.** Single-threaded by default (mobile browsers disable shared workers), crashes browser memory on convolutional networks, large weight downloads over unstable networks. |

**v0.1 path:** Python sidecar (already scaffolded). One mid-tier laptop per clinic ($200), serves all phones on local WiFi.
**Post-MVP path:** Native mobile wrapper for fully-offline phone-only deployments.

---

## 4. Image-quality UX (CONFIRMED REQUIRED)

The research explicitly recommends an interactive capture interface — not an option, a requirement. Without it, benchmark models lose 15–25% accuracy on real patient phone photos.

Required UX components (Otabek's lane):
- **Pre-upload alignment template** — on-screen overlay showing where to position the lesion / X-ray / fundus
- **Ambient contrast verification** — automatic block on blown-out glare or severe motion blur (client-side, before submit)
- **User checklist** — patient/clinician confirms sharp focus, adequate lighting, no reflections before submit

This belongs in `apps/patient/src/pages/Chat.tsx` (patient self-capture) and clinic-side image upload pages.

---

## 5. What's unlocked now

**Temirlan** can start immediately:
1. **Phase 1 (ship first):** YOLOv8n-Malaria — MIT-licensed, fastest path to a working specialist model in the sidecar
2. **Phase 2:** TorchXRayVision for pneumonia — requires UI alignment work to coordinate with Otabek
3. **Phase 3:** YOLOv8n-cls for skin lesions — non-commercial demo path only, document clearly

**Otabek** can start immediately:
1. Image-quality UX modal + checklist (per §4 above and `06-image-quality-ux-template.md`)
2. Optional: client-side blur/brightness detection (Phase 3 of the research roadmap)

**Ismail's remaining research-shaped questions:**
- Negotiate or seek alternate datasets to upgrade HAM10000 / VinDr-CXR / EyePACS from non-commercial → commercial-safe (post-MVP)
- Vet specific focus-locking microscope adapters + polarized dermoscopic lenses for field deployment

---

## 6. Files in this folder

| File | Purpose |
|---|---|
| [`Medical ML for Rural Settings.md`](./Medical%20ML%20for%20Rural%20Settings.md) | **Primary source** — full research with citations |
| [`00-overview.md`](./00-overview.md) | This file — extracted decisions for engineering |
| [`01-research-plan.md`](./01-research-plan.md) | Original research framework (now mostly answered) |
| `02-pareto-diseases-template.md` | Template — pre-filled by 00-overview |
| `03-imaging-modalities-template.md` | Template — covered in primary source |
| `04-open-source-models-template.md` | Template — covered in primary source |
| `05-datasets-and-licenses-template.md` | Template — covered in primary source |
| `06-image-quality-ux-template.md` | Template — Otabek fills the UX spec here as he ships |
