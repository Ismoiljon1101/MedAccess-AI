# Research Plan: Pareto-Focused Medical Image ML

> **Strategy:** Achieve 92–95% accuracy on the 5–10 most common diseases in our target markets, with LLM fallback for the long tail. Beats "70% on everything."
> **Owner:** Ismail (questions) · team (research) · Temirlan (implementation post-research)

---

## Phase 1 — Disease Prevalence (the 80%)

### Q1.1 — Top 10 diseases by clinic visit volume
- What 5–10 conditions account for ≥80% of clinic visits in:
  - Rural Uzbekistan / Central Asia
  - Sub-Saharan Africa
  - South Asia (Bangladesh / India / Pakistan)
- Sources: WHO IMCI, MSF Clinical Guidelines, country MOH reports, peer-reviewed prevalence studies.

### Q1.2 — Visualness filter
Which of those top conditions are **visually diagnosable** from a phone photo or simple equipment?
- ✅ Visually diagnosable: skin lesions, eye redness, wounds, jaundice, malnutrition signs
- ⚠️ Partially visual: chest X-ray (if a film + light box available), throat exam
- ❌ Not visual: malaria parasitemia (needs microscopy), UTI (needs urinalysis), most bloodwork

### Q1.3 — Impact weighting
For each visually diagnosable disease:
- Mortality if missed (high → prioritize)
- Treatability if caught (high → prioritize)
- Frequency × Impact = priority score

**Deliverable:** `01-pareto-diseases.md` with ranked table.

---

## Phase 2 — Imaging Modalities Available in the Field

### Q2.1 — What can a rural clinic actually capture?
- Phone camera (everyone has one) — dermatology, eye, wound
- Phone + cheap fundoscopy adapter ($50) — diabetic retinopathy?
- Photographed X-ray on a light box — pneumonia, TB, fractures
- Photographed microscope slide — malaria, parasites, TB sputum?
- Otoscope adapter — ear infections?

### Q2.2 — What's NOT available?
- DICOM-grade imaging (no PACS)
- CT / MRI (no machines)
- Ultrasound (rare, expensive)
- High-res anything (phone cameras max ~12MP, lighting bad)

**Deliverable:** `02-imaging-modalities.md` mapping each Pareto disease → realistic capture modality.

---

## Phase 3 — Open-Source Model Survey

For each Pareto disease + imaging modality, find existing open-source models:

### Q3.1 — Skin (likely #1 priority)
- YOLOv8 fine-tuned on HAM10000 / ISIC 2019?
- EfficientNet skin classifiers?
- DermNet / SD-198 datasets?
- License + commercial-safety?

### Q3.2 — Chest X-ray
- TorchXRayVision (DenseNet121, CheXpert-pretrained) — accuracy on phone-photographed films vs. real DICOMs?
- CheXNet, COVID-Net derivatives?

### Q3.3 — Eye / fundus
- Diabetic retinopathy classifiers (EyePACS pretrained)?
- Cataract detection from phone photos?

### Q3.4 — Microscopy (malaria, TB)
- YOLO-based parasite detection?
- Hugging Face medical-imaging models?

### Q3.5 — Other modalities
- Wound assessment models?
- Otoscopy ear disease?
- Tongue diagnosis (TCM-flavored, but data exists)?

### Q3.6 — Generic helpers
- Segment Anything (SAM) — usable for isolating lesions before classification?
- MONAI — what tasks does it cover out of the box?
- MedSAM (medical Segment Anything) — useful?

### Q3.7 — CPU / phone feasibility
For each candidate model:
- CPU inference time on a 2024 mid-range phone (< 2s acceptable, > 5s no)
- Model size on disk (< 100MB ideal, < 500MB acceptable for sidecar)
- ONNX.js compatibility (could run in browser — no Python sidecar needed)
- Memory footprint at inference

**Deliverable:** `03-open-source-models.md` with matrix.

---

## Phase 4 — Datasets & Licenses

### Q4.1 — Per-disease dataset survey
For each top-5 disease:
- Best public dataset (HAM10000, CheXpert, ISIC, EyePACS, MalariaCellImages, etc.)
- Size (number of labeled examples)
- License: MIT / Apache (commercial-safe) vs CC BY-NC (research-only) vs proprietary
- Quality: expert-labeled vs crowdsourced
- Bias warnings (e.g., HAM10000 is mostly light-skin patients — fails on darker skin)

### Q4.2 — Real-world accuracy drop
Papers showing what happens when a model trained on benchmark data hits real patient phone photos:
- How much accuracy drops (typically 10–25%)
- Which failure modes appear (lighting, framing, demographic shift)

**Deliverable:** `04-datasets-and-licenses.md` — go/no-go per dataset.

---

## Phase 5 — Image Quality UX (parallel track, doesn't need ML research)

### Q5.1 — What makes a good medical photo?
- Lighting: natural light, no flash glare, no harsh shadows
- Framing: lesion centered, no other body parts in frame, ruler/coin for scale (?)
- Focus: tap-to-focus, hold still
- Background: plain (white paper, hand on table)
- Distance: 15–30cm typical for skin

### Q5.2 — Existing UX patterns in medical apps
- How does SkinVision / FirstDerm / Aysa / Practo onboard patients to take photos?
- Are there open-source camera overlays we can adapt?
- Is there a way to auto-detect bad photos client-side (blur detection, low-light, multiple objects)?

### Q5.3 — Auto-quality gates
- Client-side blur detection (variance of Laplacian, simple OpenCV)
- Brightness histogram check (too dark / too bright reject)
- Show preview + checklist before submit, allow retake

**Deliverable:** `05-image-quality-ux.md` — modal copy, checklist items, optional client-side quality gate spec.

---

## What we do with the results

Once Phase 1–5 are filled in:

1. **Lock the top 5 diseases** Temirlan builds for → his sprint becomes concrete.
2. **Pick the dataset(s)** per disease → license-cleared → download script.
3. **Decide Python sidecar vs ONNX.js** → some models may run in-browser (kills the sidecar for those).
4. **Implement image quality UX** in `apps/patient/src/pages/Chat.tsx` (Otabek's lane) — patient nudge before any model runs.
5. **Update `TODO.md`** with concrete model integration tasks (not speculative).

---

## What we DON'T research (out of scope)

- Rare diseases (long tail) — LLM handles, good enough for v0.1
- DICOM / PACS integration — no equipment in target markets
- GPU-only models — can't deploy in our budget
- Clinical-trial-validated models — out of regulatory scope for v0.1
- Models requiring data we can't collect (whole-body scans, etc.)

These get a TODO entry under §9 Deferred. Not now.
