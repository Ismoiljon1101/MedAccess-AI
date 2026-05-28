# Research Results — Open-Source Model Survey

> **Template.** For each Pareto disease, list candidate models.

---

## Disease 1: _[fill from file 01]_

| Model | Architecture | Trained on | Reported accuracy | License | Weights size | CPU inference (ms) | ONNX.js? | Notes |
|---|---|---|---|---|---|---|---|---|
| _e.g. YOLOv8-HAM10000_ | _YOLOv8 nano_ | _HAM10000 7-class_ | _91% top-3_ | _CC BY-NC 4.0 (eval only)_ | _50MB_ | _~400_ | _Yes_ | _Bias: mostly fair-skin_ |
|  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |

**Recommended for v0.1:** _[model name + 1-line reason]_

---

## Disease 2: _[fill]_

_(same table structure)_

---

## Disease 3: _[fill]_

---

## Disease 4: _[fill]_

---

## Disease 5: _[fill]_

---

## Generic helpers (cross-disease)

| Model | What it does | Worth integrating? | Notes |
|---|---|---|---|
| Segment Anything (SAM) | Isolate region of interest | _?_ | _Heavy model, may not be needed_ |
| MedSAM | Medical-tuned SAM | _?_ |  |
| MONAI | PyTorch medical pipeline | _?_ | _More dev framework than ready model_ |

---

## Deployment matrix

| Model | Python sidecar | ONNX.js (browser) | Phone native (TFLite) | Verdict |
|---|---|---|---|---|
|  |  |  |  |  |
