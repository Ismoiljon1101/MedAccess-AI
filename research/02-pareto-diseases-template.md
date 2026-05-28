# Research Results — Top Diseases (Pareto)

> **Status:** ✅ Filled from "Medical ML for Rural Settings.md" (Ismail, 2026-05-28)
> **Source of truth:** [`Medical ML for Rural Settings.md`](./Medical%20ML%20for%20Rural%20Settings.md)

---

## Methodology

- Markets analyzed: Rural sub-Saharan Africa, Rural South Asia (Bangladesh focus), Rural Central Asia (Uzbekistan)
- Sources: WHO, MSF, World Bank, PMC peer-reviewed papers, MOH Uzbekistan, AfricanMissionHealthcare
- Cutoff date for data: 2026-05

---

## Ranked top diseases (target: 80% of clinic visits)

| # | Disease | Region(s) | % of clinic visits | Visually diagnosable? | Mortality if missed | Imaging modality | Priority score | Source |
|---|---|---|---|---|---|---|---|---|
| 1 | **Malaria** | Sub-Saharan Africa (endemic) | Up to 40% of pediatric outpatient visits | ✅ Yes — microscopy smear | High (children) | Brightfield microscopy, Giemsa thin smear | **Critical** | NIH PMC, AfricanMissionHealthcare |
| 2 | **Pneumonia** | Rural South Asia (Bangladesh, India) | ~15% of under-5 outpatient visits | ✅ Yes — chest X-ray | High (children) | Chest X-ray photographed off analog lightbox | **Critical** | PMC Bangladesh, WHO |
| 3 | **Skin Lesions / Melanoma** | Tropical/rural regions (all markets) | ~15% of primary care visits | ✅ Yes — dermoscopy/photo | Medium (melanoma) | Smartphone photo or clip-on dermoscope | **High** | PMC HAM10000, ISIC |
| 4 | **Diabetic Retinopathy** | Rural Central/South Asia (Uzbekistan, India) | 8–12% of diabetic outpatients | ✅ Yes — fundoscopy | High (blindness) | Smartphone fundoscopy adapter | **High** | EyePACS, PMC Uzbekistan |
| 5 | **Scabies** | Overcrowded/rural areas (all markets) | 10–20% of outpatient dermatology | ✅ Yes — macro photo | Low (morbidity high) | Macro smartphone photography | **Medium** | IEEE Scabio, PMC |
| 6 | Diarrheal infections | Rural South Asia | ~18% of all visits | ❌ No — lab required | High (dehydration) | N/A | Deprioritized | WHO Bangladesh |
| 7 | Tuberculosis (MDR-TB) | Uzbekistan | Significant NCD burden | ⚠️ Partial — X-ray | High | Chest X-ray + lab | Deprioritized | MOH Uzbekistan |
| 8 | Cardiovascular disease | Uzbekistan (NCDs >80% mortality) | Dominant NCD | ❌ No — ECG/lab | Very high | N/A — non-visual | Deprioritized | PMC Uzbekistan |
| 9 | UTI / Kidney infection | All markets | Common | ❌ No — urinalysis | Medium | N/A — non-visual | Deprioritized | — |
| 10 | Gastroenteritis | All markets | Common | ❌ No — lab | Medium | N/A — non-visual | Deprioritized | — |

---

## Top 5 to build specialist models for (locked)

1. **Malaria** — YOLOv8n-Malaria, MIT license, ship Phase 1
2. **Pneumonia** — TorchXRayVision DenseNet121, Apache 2.0, ship Phase 2
3. **Skin Lesions** — YOLOv8n-cls / HAM10000, CC BY-NC (demo only), ship Phase 3
4. **Diabetic Retinopathy** — ResNet50-DR, non-commercial only
5. **Scabies** — MobileNetV2-ScabAI, deferred (dataset too small)

---

## Diseases consciously deprioritized

| Disease | Why deferred |
|---|---|
| Diarrheal infections | Non-visual; requires lab culture/ORT protocol — LLM fallback handles counselling |
| MDR-TB | Requires culture + DST; X-ray alone insufficient for drug-resistant confirmation |
| Cardiovascular disease | Non-visual; requires ECG, blood panels — out of scope for v0.1 imaging pipeline |
| UTI / kidney infections | Non-visual; requires urinalysis strips — LLM handles counselling and referral |
| Gastroenteritis | Non-visual; LLM symptom triage + hydration advice adequate |
| Brain tumors / rare syndromes | Long tail; LLM fallback acceptable; no imaging feasible in target settings |

---

## Notes / open questions

- **Scabies dataset (800 images)** is too small for commercial deployment. Re-train on larger corpus post-MVP.
- **HAM10000 CC BY-NC** blocks commercial use of skin model. Ismail to negotiate or find alternate dataset.
- **VinDr-CXR** (used by TorchXRayVision) is CC BY-NC — same commercial flag for pneumonia model.
- Real-world accuracy drop of **10–25%** applies to all 5 models. Image quality UX (file 06) is mandatory.
- Uzbekistan's NCD burden (cardiovascular, diabetes complications) is massive but non-visual — MA Agent handles via symptom triage + referral. Only diabetic retinopathy has visual foothold.
