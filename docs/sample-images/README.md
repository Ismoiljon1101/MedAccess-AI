# Sample Images for Demo

Add JPEG/PNG sample medical images here for Scene 6 of the demo script.

## Required images

| File | Content | Source |
|---|---|---|
| `chest-xray.jpg` | Normal or abnormal chest X-ray | [NIH Chest X-ray Dataset](https://nihcc.app.box.com/v/ChestXray-NIHCC) or any open-license X-ray |
| `skin-lesion.jpg` | Dermatology photo (e.g. nevi, rash) | [ISIC Archive](https://www.isic-archive.com/) CC-licensed images |
| `blood-smear.jpg` | Thin blood smear (malaria demo if sidecar running) | NIH Malaria Screener dataset |

## Notes
- Keep files under 2 MB (API limit for multipart upload)
- JPEG preferred over PNG for speed
- Do NOT commit patient data or real identifying images
- These are for local demo only — add to `.gitignore` if needed
