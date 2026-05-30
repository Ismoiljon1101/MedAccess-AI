"""
MedAccess AI — Medical Image ML sidecar service.

Owner: Temirlan (models, preprocessing, eval)
Interface contract jointly with Ismail.

Pipeline:
  Image → this sidecar → structured findings JSON
  → Node API sends findings as TEXT to main LLM → clinical explanation
  The LLM never sees the raw image — only the specialist model output.

Model paths:
  models/malaria-yolov8s.pt   — YOLOv8s malaria detector (MIT, HuggingFace: keremberke/yolov8s-malaria-detection)
  models/skin-ham10000.pt     — YOLOv8n-cls skin lesion classifier (CC BY-NC 4.0, Temirlan trains on HAM10000)
  TorchXRayVision DenseNet121 — auto-downloads on first xray request (Apache 2.0)

Start: cd services/image-ml && python main.py
Set in root .env: IMAGE_ML_URL=http://localhost:5001
"""

from __future__ import annotations

import io
import os
import ssl
import time
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel, Field


# ── SSL bypass for Korean ISP TLS inspection (same reason as Node) ─────────
ssl._create_default_https_context = ssl._create_unverified_context  # type: ignore

# ── Model paths ───────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

MALARIA_MODEL_PATH = MODELS_DIR / "malaria-yolov8s.pt"
SKIN_MODEL_PATH    = MODELS_DIR / "skin-ham10000.pt"

# HAM10000 7-class skin lesion labels (matches training order)
HAM10000_CLASSES = [
    "melanoma",
    "melanocytic nevus",
    "basal cell carcinoma",
    "actinic keratosis",
    "benign keratosis",
    "dermatofibroma",
    "vascular lesion",
]

# TorchXRayVision pathology labels (DenseNet121-all outputs 18 pathologies)
XRAY_PATHOLOGIES = [
    "Atelectasis", "Cardiomegaly", "Consolidation", "Edema",
    "Effusion", "Emphysema", "Fibrosis", "Hernia",
    "Infiltration", "Mass", "Nodule", "Pleural_Thickening",
    "Pneumonia", "Pneumothorax",
]

# Lazy model cache
_models: dict[str, object] = {}


# ── Model loaders ─────────────────────────────────────────────────────────────

def _load_yolo(path: Path) -> object | None:
    if not path.exists():
        return None
    try:
        from ultralytics import YOLO  # type: ignore
        return YOLO(str(path))
    except Exception as exc:
        print(f"[image-ml] YOLO load failed ({path.name}): {exc}")
        return None


def get_malaria_model() -> object | None:
    if "malaria" not in _models:
        _models["malaria"] = _load_yolo(MALARIA_MODEL_PATH)
    return _models["malaria"]


def get_skin_model() -> tuple[object | None, str]:
    """Returns (model, model_name). ONLY loads HAM10000-trained weights.
    Base ImageNet YOLO is NOT used — it detects ticks/beetles, not skin diseases."""
    if "skin" not in _models:
        ham = _load_yolo(SKIN_MODEL_PATH)
        if ham:
            _models["skin"] = (ham, "skin-ham10000")
        else:
            # DO NOT fall back to base yolov8n-cls — it's trained on ImageNet
            # (animals, objects) and gives DANGEROUS results on medical images
            # (e.g. classifies melanoma as "tick"). Return None so the LLM
            # handles it with text-only guidance based on patient description.
            _models["skin"] = (None, "")
    return _models["skin"]  # type: ignore


def get_xray_model() -> object | None:
    """TorchXRayVision DenseNet121-all — auto-downloads on first call (~135 MB)."""
    if "xray" not in _models:
        try:
            import torchxrayvision as xrv  # type: ignore
            import torch  # type: ignore
            model = xrv.models.DenseNet(weights="densenet121-res224-all")
            model.eval()
            _models["xray"] = model
            print("[image-ml] TorchXRayVision loaded")
        except Exception as exc:
            print(f"[image-ml] TorchXRayVision load failed: {exc}")
            _models["xray"] = None
    return _models["xray"]


# ── Preprocessing ─────────────────────────────────────────────────────────────

def preprocess_skin(img: np.ndarray) -> np.ndarray:
    """CLAHE contrast enhancement — standard for dermoscopy. 91.9% acc vs 86.2% raw."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


def preprocess_xray(img: np.ndarray):
    """Normalize X-ray to TorchXRayVision expected input: [1, 1, 224, 224] tensor."""
    import torch  # type: ignore
    import torchxrayvision as xrv  # type: ignore
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    # xrv.datasets.normalize: scales to [-1024, 1024], adds channel dim → (1, H, W)
    gray = xrv.datasets.normalize(gray, maxval=255, reshape=True)
    # Resize to 224×224 (model input size)
    gray = gray[0]  # remove channel dim for resize
    gray = cv2.resize(gray, (224, 224))
    gray = gray[np.newaxis, np.newaxis, ...]  # (1, 1, 224, 224)
    return torch.from_numpy(gray).float()  # type: ignore


# ── Image type detection ──────────────────────────────────────────────────────

def detect_image_type(hint: str, img: np.ndarray) -> Literal["skin", "xray", "eye", "malaria", "other", "unknown"]:
    h = hint.lower().strip()
    if h in {"skin", "xray", "eye", "malaria"}:
        return h  # type: ignore
    # Heuristic: X-rays are near-grayscale (low saturation)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mean_sat = float(np.mean(hsv[:, :, 1]))
    if mean_sat < 20:
        return "xray"
    if mean_sat > 45:
        return "skin"
    return "unknown"


# ── FastAPI ───────────────────────────────────────────────────────────────────

app = FastAPI(title="MedAccess Image ML", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class Finding(BaseModel):
    label: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    notes: str = ""


class AnalyzeResponse(BaseModel):
    """Stable contract — do not break without coordinating with Ismail."""
    image_type: Literal["skin", "xray", "eye", "malaria", "other", "unknown"] = "unknown"
    skipped: bool = False
    skipped_reason: str = ""
    findings: list[Finding] = []
    model_used: str = ""
    processing_ms: int = 0


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/healthz")
def healthz() -> dict[str, object]:
    loaded = []
    if MALARIA_MODEL_PATH.exists(): loaded.append("malaria-yolov8s")
    if SKIN_MODEL_PATH.exists():    loaded.append("skin-ham10000")
    # Check if TorchXRayVision is importable (doesn't trigger download)
    try:
        import torchxrayvision  # type: ignore  # noqa: F401
        loaded.append("torchxrayvision-available")
    except ImportError:
        pass
    return {"ok": True, "service": "medaccess-image-ml", "version": app.version, "models_loaded": loaded}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    image: UploadFile = File(...),
    hint: str = Form("", description="Caller hint: 'skin', 'xray', 'eye', 'malaria'."),
) -> AnalyzeResponse:
    start = time.perf_counter()
    elapsed_ms = lambda: int((time.perf_counter() - start) * 1000)

    try:
        raw = await image.read()
        pil = Image.open(io.BytesIO(raw)).convert("RGB")
        img_np = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    image_type = detect_image_type(hint, img_np)

    # ── Malaria smear ─────────────────────────────────────────────
    if image_type == "malaria":
        model = get_malaria_model()
        if model is None:
            return AnalyzeResponse(
                image_type="malaria", skipped=True,
                skipped_reason="malaria-yolov8s.pt not found. Download: huggingface.co/keremberke/yolov8s-malaria-detection → services/image-ml/models/malaria-yolov8s.pt",
                model_used="", processing_ms=elapsed_ms(),
            )
        results = model(img_np, verbose=False)  # type: ignore
        findings = []
        for box in results[0].boxes:
            cls_id = int(box.cls[0])
            conf   = float(box.conf[0])
            label  = results[0].names[cls_id]
            if conf >= 0.3:
                findings.append(Finding(label=label, confidence=round(conf, 3), notes=f"bbox detected"))
        return AnalyzeResponse(
            image_type="malaria", skipped=False,
            findings=findings,
            model_used="malaria-yolov8s",
            processing_ms=elapsed_ms(),
        )

    # ── Skin lesion ───────────────────────────────────────────────
    if image_type == "skin":
        model, model_name = get_skin_model()
        if model is None:
            return AnalyzeResponse(
                image_type="skin", skipped=True,
                skipped_reason="No skin model available. Place yolov8n-cls.pt in services/image-ml/ or train HAM10000 weights.",
                model_used="", processing_ms=elapsed_ms(),
            )
        preprocessed = preprocess_skin(img_np)
        results = model(preprocessed, verbose=False)  # type: ignore
        probs = results[0].probs
        names = results[0].names
        is_ham = len(names) == 7
        findings = []
        for idx, conf in zip(probs.top5, probs.top5conf.tolist()):
            if conf < 0.05:
                break
            label = HAM10000_CLASSES[idx] if is_ham else names[int(idx)]
            findings.append(Finding(label=label, confidence=round(float(conf), 3),
                                    notes="HAM10000 specialist" if is_ham else "general classifier"))
        return AnalyzeResponse(
            image_type="skin", skipped=False,
            findings=findings,
            model_used=model_name,
            processing_ms=elapsed_ms(),
        )

    # ── Chest X-ray ───────────────────────────────────────────────
    if image_type == "xray":
        model = get_xray_model()
        if model is None:
            return AnalyzeResponse(
                image_type="xray", skipped=True,
                skipped_reason="TorchXRayVision failed to load. Run: pip install torchxrayvision",
                model_used="", processing_ms=elapsed_ms(),
            )
        try:
            import torch  # type: ignore
            tensor = preprocess_xray(img_np)
            with torch.no_grad():
                preds = model(tensor)[0].numpy()  # type: ignore
            # preds is shape (18,) — sigmoid probabilities per pathology
            findings = []
            for i, score in enumerate(preds):
                if i >= len(model.pathologies):  # type: ignore
                    break
                label = model.pathologies[i]  # type: ignore
                if label in XRAY_PATHOLOGIES and score >= 0.15:
                    findings.append(Finding(
                        label=label,
                        confidence=round(float(score), 3),
                        notes=f"DenseNet121-all score {score:.2f}",
                    ))
            findings.sort(key=lambda f: f.confidence, reverse=True)
            return AnalyzeResponse(
                image_type="xray", skipped=False,
                findings=findings[:6],  # top 6 findings
                model_used="torchxrayvision-densenet121-all",
                processing_ms=elapsed_ms(),
            )
        except Exception as exc:
            return AnalyzeResponse(
                image_type="xray", skipped=True,
                skipped_reason=f"X-ray inference error: {exc}",
                model_used="torchxrayvision", processing_ms=elapsed_ms(),
            )

    # ── Unknown / other ───────────────────────────────────────────
    return AnalyzeResponse(
        image_type=image_type, skipped=True,
        skipped_reason=f"Type '{image_type}' — no specialist model loaded yet. Add hint='skin'/'xray'/'malaria' if misdetected.",
        model_used="", processing_ms=elapsed_ms(),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
