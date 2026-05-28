# Research Results — Imaging Modalities in Target Settings

> **Status:** ✅ Filled from "Medical ML for Rural Settings.md" (Ismail, 2026-05-28)
> **Source of truth:** [`Medical ML for Rural Settings.md`](./Medical%20ML%20for%20Rural%20Settings.md)

---

## What's available in our target markets

| Modality | Cost to deploy | Available in rural clinic? | Patient self-capture? | Image quality | Notes |
|---|---|---|---|---|---|
| Smartphone camera (12MP) | $0 (existing) | ✅ Yes | ✅ Yes | Variable — lighting/focus issues | Primary capture device for skin, scabies |
| Clip-on polarized dermoscope | ~$30–50 | ⚠️ Sometimes | ❌ Needs training | Good with training | Reduces glare on skin lesions; required for HAM10000 accuracy |
| Phone + fundoscopy adapter | ~$50 | ⚠️ Sometimes | ❌ Needs training | Decent if trained user | Chromatic aberration + pupil centering issues |
| Photographed chest X-ray on lightbox | $0 if film exists | ⚠️ Sometimes | ❌ | Lossy vs DICOM but usable | Parallax + reflection = 15–25% accuracy drop |
| 3D-printed clip-on microscope lens | ~$5–20 | ⚠️ Sometimes | ❌ | Lossy but usable for parasites | Focus stability critical; stain quality matters |
| Standard macro lens attachment | ~$10 | ⚠️ Rare | ⚠️ Partially | OK for macrophotography | Good for scabies if lighting controlled |
| Otoscope phone adapter | ~$30 | ⚠️ Rare | ❌ | Depends on training | Out of scope v0.1 |
| Ultrasound | $$$$ | ❌ | ❌ | Out of scope | — |
| CT / MRI | $$$$$ | ❌ | ❌ | Out of scope | — |
| Professional dermoscope (polarized) | ~$200–800 | ❌ in most clinics | ❌ | Clinical grade | Out of scope v0.1 |

---

## Disease → modality mapping

| Disease | Best capture modality | Realistic in target setting? | Constraints |
|---|---|---|---|
| **Malaria** | Brightfield microscopy (Giemsa thin smear) via 3D-printed clip-on lens | ⚠️ Moderate — requires basic microscope + staining supplies | Focus stability; stain crystallization artifacts mimic ring stage |
| **Pneumonia** | Frontal chest X-ray photographed against analog lightbox | ⚠️ Moderate — X-ray machine + lightbox required | Parallax distortion, reflections, scapular overlap; alignment UI mandatory |
| **Skin Lesions** | Direct smartphone photo or clip-on polarized dermoscope | ✅ High — phone universally available | Glare without dermoscope; skin-tone bias in training data |
| **Diabetic Retinopathy** | Retinal fundus photo via smartphone-mounted ophthalmoscope adapter | ⚠️ Moderate — adapter required | Pupil centering, chromatic aberration, dust on optics |
| **Scabies** | Macro smartphone photography of typical anatomical sites | ✅ High — phone universally available | Scratching/pyoderma masks burrows; varied illumination |

---

## Capture failure modes (informs file 06 UX spec)

### Universal (all modalities)
- **Poor ambient lighting** — most common failure; flash creates glare and washes color
- **Motion blur** — especially with microscopy and fundoscopy; patient or phone moves during capture
- **Incorrect distance** — too close = can't focus; too far = no clinical detail
- **Multiple objects in frame** — cluttered background confuses convolutional feature extraction

### Microscopy-specific
- **Focus drift** on low-cost manual microscopes — small depth of field
- **Dye precipitation / dust** on slide mimics intracellular ring stages (false positives for malaria)
- **Stain quality variability** — Giemsa stain concentration affects color contrast

### Chest X-ray-specific
- **Parallax distortion** — phone not parallel to lightbox plate
- **Lightbox reflections** — hot spots from fluorescent tubes
- **Sub-optimal inspiratory effort** — looks like bilateral consolidation
- **Scapular overlap** in lung fields misleads model

### Fundoscopy-specific
- **Off-axis pupil centering** — most common; cuts usable field of view
- **Un-dilated pupils** — hides microaneurysms and small hemorrhages
- **Dust on adapter optics** — creates artifacts resembling retinal lesions
- **Chromatic aberration** from inexpensive adapters

### Skin / Dermatology-specific
- **Flash glare** — washes out melanin variation; polarized lens eliminates this
- **Non-uniform lighting** — shadows on one side of lesion hide border irregularity
- **Skin-tone bias** — melanoma models underperform on darker Fitzpatrick types IV–VI
- **Secondary infection (pyoderma)** covering primary scabies presentation
