# Research Results — Imaging Modalities in Target Settings

> **Template.** Fill in based on what a real rural clinic / patient at home can actually capture.

---

## What's available in our target markets

| Modality | Cost to deploy | Available in rural clinic? | Patient self-capture? | Image quality |
|---|---|---|---|---|
| Smartphone camera (12MP) | $0 (existing) | ✅ Yes | ✅ Yes | Variable — lighting/focus issues |
| Phone + fundoscopy adapter | ~$50 | ⚠️ Sometimes | ❌ Needs training | Decent if trained user |
| Photographed X-ray on light box | $0 if film exists | ⚠️ Sometimes | ❌ | Lossy vs DICOM but usable |
| Photographed microscope slide | $0 if microscope exists | ⚠️ Sometimes | ❌ | Lossy but usable for parasites |
| Otoscope phone adapter | ~$30 | ⚠️ Rare | ❌ | Depends on training |
| Ultrasound | $$$$ | ❌ | ❌ | Out of scope |
| CT / MRI | $$$$$ | ❌ | ❌ | Out of scope |
| Dermoscope | ~$200–800 | ❌ | ❌ | Out of scope for v0.1 |

---

## Disease → modality mapping

| Disease (from file 01) | Best capture modality | Realistic in target setting? |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |

---

## Capture failure modes (informs file 05 UX)

- _Poor lighting (most common)_
- _Out of focus / motion blur_
- _Multiple objects in frame_
- _Glare from phone flash_
- _Wrong distance (too close = blur, too far = no detail)_
- _Other body parts visible (privacy / model confusion)_
