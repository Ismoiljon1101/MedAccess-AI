"""
MedAccess AI — Medical Image ML sidecar service.

Owner: Temirlan (models, preprocessing, eval)
Interface contract jointly with Ismail.
See docs/team/temirlan.md and services/image-ml/README.md.

Model loading strategy:
  1. Look for domain-specific fine-tuned weights in ./models/ (Temirlan drops these in)
  2. Fall back to base yolov8n-cls.pt (ImageNet classes — useful for type triage only)
  3. If nothing found, return skipped=True so Node falls back to Gemini

Wire up by setting IMAGE_ML_URL=http://localhost:5001 in root .env.
"""

from __future__ import annotations

import io
import os
import time
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel, Field


# ── Model paths ───────────────────────────────────────────────────────────────

BASE_DIR   = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"

# Fine-tuned weights (Temirlan trains and drops these in)
SKIN_MODEL_PATH  = MODELS_DIR / "skin-ham10000.pt"   # YOLOv8-cls, HAM10000 7-class
XRAY_MODEL_PATH  = MODELS_DIR / "xray-vindr.pt"      # TorchXRayVision or YOLOv8 CheXpert
EYE_MODEL_PATH   = MODELS_DIR / "eye-dr.pt"          # Diabetic retinopathy

# Base fallback (no clinical labels — for type triage only)
BASE_MODEL_PATH  = BASE_DIR / "yolov8n-cls.pt"


# HAM10000 class labels (7-class skin lesion dataset)
HAM10000_CLASSES = [
    "melanoma",
    "melanocytic nevus",
    "basal cell carcinoma",
    "actinic keratosis",
    "benign keratosis",
    "dermatofibroma",
    "vascular lesion",
]

# Lazy-loaded model cache — loaded once on first request per type
_models: dict[str, object] = {}


def _load_yolo(path: Path) -> object | None:
    """Load a YOLO model, return None if path doesn't exist."""
    if not path.exists():
        return None
    try:
        from ultralytics import YOLO  # type: ignore
        return YOLO(str(path))
    except Exception as exc:
        print(f"[image-ml] Failed to load {path}: {exc}")
        return None


def get_skin_model() -> object | None:
    if "skin" not in _models:
        _models["skin"] = _load_yolo(SKIN_MODEL_PATH)
    return _models["skin"]


def get_base_model() -> object | None:
    if "base" not in _models:
        _models["base"] = _load_yolo(BASE_MODEL_PATH)
    return _models["base"]


# ── Preprocessing ─────────────────────────────────────────────────────────────

def preprocess_skin(img: np.ndarray) -> np.ndarray:
    """CLAHE contrast enhancement — standard for dermoscopy images."""
    lab  = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l     = clahe.apply(l)
    enhanced = cv2.merge([l, a, b])
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)


def preprocess_xray(img: np.ndarray) -> np.ndarray:
    """Histogram equalization for X-ray images."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    eq   = cv2.equalizeHist(gray)
    return cv2.cvtColor(eq, cv2.COLOR_GRAY2BGR)


# ── Type detection ────────────────────────────────────────────────────────────

def detect_image_type(hint: str, img: np.ndarray) -> Literal["skin", "xray", "eye", "other", "unknown"]:
    """Use hint if provided, else simple heuristic based on pixel stats."""
    h = hint.lower().strip()
    if h in {"skin", "xray", "eye"}:
        return h  # type: ignore

    # Heuristic: X-rays are near-grayscale
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mean_sat = float(np.mean(hsv[:, :, 1]))
    if mean_sat < 25:
        return "xray"
    if mean_sat > 40:
        return "skin"
    return "unknown"


# ── FastAPI ───────────────────────────────────────────────────────────────────

app = FastAPI(
    title="MedAccess Image ML",
    version="0.2.0",
    description="Specialist medical-image inference sidecar.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── Response contract (mirrored in TypeScript at apps/api/src/services/vision.ts) ──

class Finding(BaseModel):
    label: str = Field(..., description="Short clinical label.")
    confidence: float = Field(..., ge=0.0, le=1.0)
    notes: str = Field("", description="Optional natural-language context.")


class AnalyzeResponse(BaseModel):
    """Stable contract — do not break without coordinating with Ismail."""
    image_type: Literal["skin", "xray", "eye", "other", "unknown"] = "unknown"
    skipped: bool = False
    skipped_reason: str = ""
    findings: list[Finding] = []
    model_used: str = ""
    processing_ms: int = 0


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/healthz")
def healthz() -> dict[str, object]:
    loaded = []
    if SKIN_MODEL_PATH.exists():  loaded.append("skin-ham10000")
    if XRAY_MODEL_PATH.exists():  loaded.append("xray-vindr")
    if EYE_MODEL_PATH.exists():   loaded.append("eye-dr")
    if BASE_MODEL_PATH.exists():  loaded.append("yolov8n-cls-base")
    return {
        "ok": True,
        "service": "medaccess-image-ml",
        "version": app.version,
        "models_loaded": loaded,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    image: UploadFile = File(...),
    hint: str = Form("", description="Caller hint: 'skin', 'xray', 'eye'."),
) -> AnalyzeResponse:
    start = time.perf_counter()

    # Validate + decode
    try:
        raw = await image.read()
        pil = Image.open(io.BytesIO(raw)).convert("RGB")
        img_np = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    image_type = detect_image_type(hint, img_np)
    elapsed_ms = lambda: int((time.perf_counter() - start) * 1000)

    # ── Skin lesion path ──────────────────────────────────────────────
    if image_type == "skin":
        model = get_skin_model()
        if model is not None:
            preprocessed = preprocess_skin(img_np)
            results = model(preprocessed, verbose=False)  # type: ignore
            probs   = results[0].probs
            names   = results[0].names

            # Check if model uses HAM10000 classes (7 classes)
            is_ham = len(names) == 7

            top_indices = probs.top5
            top_confs   = probs.top5conf.tolist()

            findings = []
            for idx, conf in zip(top_indices, top_confs):
                if conf < 0.05:
                    break
                label = HAM10000_CLASSES[idx] if is_ham else names[int(idx)]
                findings.append(Finding(label=label, confidence=round(float(conf), 3)))

            return AnalyzeResponse(
                image_type="skin",
                skipped=False,
                findings=findings,
                model_used="skin-ham10000" if is_ham else "yolov8n-cls-base",
                processing_ms=elapsed_ms(),
            )

        # No fine-tuned skin model — try base for basic sanity check
        base = get_base_model()
        if base is not None:
            results  = base(preprocess_skin(img_np), verbose=False)  # type: ignore
            top_conf = float(results[0].probs.top1conf)
            return AnalyzeResponse(
                image_type="skin",
                skipped=True,
                skipped_reason=(
                    "Fine-tuned skin model (skin-ham10000.pt) not found. "
                    "Base ImageNet model not clinically meaningful for lesion classification. "
                    "Temirlan: train on HAM10000 and drop weights into services/image-ml/models/"
                ),
                findings=[],
                model_used="yolov8n-cls-base",
                processing_ms=elapsed_ms(),
            )

    # ── X-ray path ────────────────────────────────────────────────────
    if image_type == "xray":
        if XRAY_MODEL_PATH.exists():
            # TODO(Temirlan): load TorchXRayVision DenseNet121 here
            pass

        return AnalyzeResponse(
            image_type="xray",
            skipped=True,
            skipped_reason=(
                "X-ray specialist model (xray-vindr.pt) not yet trained. "
                "Temirlan: implement TorchXRayVision DenseNet121 on VinDr-CXR."
            ),
            findings=[],
            model_used="",
            processing_ms=elapsed_ms(),
        )

    # ── Unknown / other ───────────────────────────────────────────────
    return AnalyzeResponse(
        image_type=image_type,
        skipped=True,
        skipped_reason=f"Image type '{image_type}' not yet handled by a specialist model.",
        findings=[],
        model_used="",
        processing_ms=elapsed_ms(),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
