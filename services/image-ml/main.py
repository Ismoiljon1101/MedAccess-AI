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
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel, Field

from model_manager import MODELS_DIR, ensure_all, model_status


# ── SSL bypass for Korean ISP TLS inspection (same reason as Node) ─────────
ssl._create_default_https_context = ssl._create_unverified_context  # type: ignore

# ── Model paths (filenames match model_manager.MODELS) ────────────────────────
MALARIA_MODEL_PATH  = MODELS_DIR / "malaria-yolov8s.pt"
SKIN_CONVNEXT_PATH  = MODELS_DIR / "skin-convnext-ham10000.pth"
SKIN_MODEL_PATH     = MODELS_DIR / "skin-ham10000.pt"          # legacy YOLO HAM10000 (kept for back-compat)
SKIN_ONNX_PATH      = MODELS_DIR / "skin-xception.onnx"        # legacy Xception ONNX (Temirlan's path)
SKIN_SAVEDMODEL_DIR = MODELS_DIR / "skin-xception"
EYE_DR_ONNX_PATH    = MODELS_DIR / "eye-dr-detect.onnx"        # diabetic retinopathy classifier

# Skin_Disease_AI 6-class labels (Xception, 92% accuracy, NadavIs56/Skin_Disease_AI)
SKIN_XCEPTION_CLASSES = ["acne", "carcinoma", "eczema", "keratosis", "millia", "rosacea"]

# HAM10000 7-class skin lesion labels.
# Order matches PyTorch ImageFolder alphabetical sort of the HAM10000 dx folder names:
# akiec → bcc → bkl → df → mel → nv → vasc
HAM10000_CLASSES = [
    "actinic keratosis",    # akiec (index 0)
    "basal cell carcinoma", # bcc   (index 1)
    "benign keratosis",     # bkl   (index 2)
    "dermatofibroma",       # df    (index 3)
    "melanoma",             # mel   (index 4)
    "melanocytic nevus",    # nv    (index 5)
    "vascular lesion",      # vasc  (index 6)
]

# BlairFerg DR ONNX is a binary classifier — output shape [1, 2]:
#   index 0 → no diabetic retinopathy
#   index 1 → diabetic retinopathy detected (grade not separated)
DR_CLASSES = [
    "no diabetic retinopathy",
    "diabetic retinopathy detected",
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


def get_skin_model() -> tuple[object | None, str, str]:
    """Returns (model, model_name, model_type).
    Priority: ConvNeXt HAM10000 (auto-downloaded) → Xception ONNX → HAM10000 YOLO → None.
    NEVER uses base ImageNet YOLO — gives dangerous results on medical images."""
    if "skin" not in _models:
        # 1. ConvNeXt-Base HAM10000 — auto-downloaded by model_manager
        if SKIN_CONVNEXT_PATH.exists():
            try:
                import torch  # type: ignore
                import timm  # type: ignore
                model_obj = timm.create_model("convnext_base", num_classes=7, pretrained=False)
                state = torch.load(str(SKIN_CONVNEXT_PATH), map_location="cpu", weights_only=False)
                model_obj.load_state_dict(state, strict=False)
                model_obj.eval()
                _models["skin"] = (model_obj, "skin-convnext-ham10000", "convnext")
                print("[models] Skin: ConvNeXt-Base HAM10000 loaded (7 classes)")
            except Exception as exc:
                print(f"[models] ConvNeXt load failed: {exc}")
                _models["skin"] = (None, "", "")
        # 2. Xception ONNX (Skin_Disease_AI, 92% accuracy, NadavIs56) — legacy path
        elif SKIN_ONNX_PATH.exists():
            try:
                import onnxruntime as ort  # type: ignore
                sess = ort.InferenceSession(
                    str(SKIN_ONNX_PATH),
                    providers=["CPUExecutionProvider"],
                )
                _models["skin"] = (sess, "skin-xception-92pct", "onnx")
                print(f"[models] Skin: Xception ONNX 92% loaded")
            except Exception as exc:
                print(f"[models] Xception ONNX load failed: {exc}")
                _models["skin"] = (None, "", "")
        # 3. HAM10000 YOLO (86-92% with CLAHE)
        elif SKIN_MODEL_PATH.exists():
            m = _load_yolo(SKIN_MODEL_PATH)
            _models["skin"] = (m, "skin-ham10000", "yolo") if m else (None, "", "")
            if m: print(f"[models] Skin: HAM10000 YOLO loaded")
        else:
            _models["skin"] = (None, "", "")
    return _models["skin"]  # type: ignore


def get_eye_model() -> tuple[object | None, str, str]:
    """Returns (model_or_session, model_name, model_type).
    Currently: BlairFerg DR ONNX (auto-downloaded). Returns (None,...) if absent."""
    if "eye" not in _models:
        if EYE_DR_ONNX_PATH.exists():
            try:
                import onnxruntime as ort  # type: ignore
                sess = ort.InferenceSession(
                    str(EYE_DR_ONNX_PATH),
                    providers=["CPUExecutionProvider"],
                )
                _models["eye"] = (sess, "eye-dr-onnx", "onnx")
                print("[models] Eye: DR ONNX loaded")
            except Exception as exc:
                print(f"[models] Eye DR ONNX load failed: {exc}")
                _models["eye"] = (None, "", "")
        else:
            _models["eye"] = (None, "", "")
    return _models["eye"]  # type: ignore


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

def _looks_like_fundus(img: np.ndarray) -> bool:
    """Fundus photos have two distinctive properties:
    1. Dark circular vignette — the camera FOV limiter makes corners much darker than center.
    2. Reddish/orange dominant hue — retinal tissue is red, optic disc is orange-yellow.
    Both must be true to avoid misclassifying warm-toned skin lesions as fundus.
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Corner darkness: sample 1/6 of the shorter dimension from each corner
    c = min(h, w) // 6
    corner_mean = float(np.mean([
        gray[:c, :c].mean(), gray[:c, -c:].mean(),
        gray[-c:, :c].mean(), gray[-c:, -c:].mean(),
    ]))
    center_mean = float(gray[h // 4: 3 * h // 4, w // 4: 3 * w // 4].mean())
    has_vignette = center_mean > 0 and (corner_mean / center_mean) < 0.35

    if not has_vignette:
        return False

    # Red/orange hue check (OpenCV HSV hue range 0–180; red wraps at 0 and 180)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hue = hsv[:, :, 0]
    red_orange_ratio = float(((hue < 25) | (hue > 155)).mean())
    return red_orange_ratio > 0.30


def detect_image_type(hint: str, img: np.ndarray) -> Literal["skin", "xray", "eye", "malaria", "other", "unknown"]:
    h = hint.lower().strip()
    if h in {"skin", "xray", "eye", "malaria"}:
        return h  # type: ignore
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mean_sat = float(np.mean(hsv[:, :, 1]))
    if mean_sat < 20:
        return "xray"
    # Check fundus before skin — both are high-saturation but fundus has vignette + red hue
    if mean_sat > 45 and _looks_like_fundus(img):
        return "eye"
    if mean_sat > 45:
        return "skin"
    return "unknown"


# ── FastAPI ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Auto-download any missing managed weights on boot.

    Set SKIP_MODEL_DOWNLOADS=1 to disable (e.g. CI, air-gapped deployments).
    Failures are non-fatal: missing weights → that modality returns
    `skipped:true`; everything else still serves.
    """
    if os.environ.get("SKIP_MODEL_DOWNLOADS") == "1":
        print("[startup] SKIP_MODEL_DOWNLOADS=1 — skipping weight auto-download")
    else:
        try:
            ensure_all()
        except Exception as exc:
            print(f"[startup] weight auto-download error (continuing): {exc}")
    yield


app = FastAPI(title="MedAccess Image ML", version="0.3.0", lifespan=lifespan)

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
    loaded: list[str] = []
    if MALARIA_MODEL_PATH.exists():    loaded.append("malaria-yolov8s")
    if SKIN_CONVNEXT_PATH.exists():    loaded.append("skin-convnext-ham10000")
    elif SKIN_ONNX_PATH.exists():      loaded.append("skin-xception-92pct")
    elif SKIN_MODEL_PATH.exists():     loaded.append("skin-ham10000")
    if EYE_DR_ONNX_PATH.exists():      loaded.append("eye-dr-onnx")
    # Check if TorchXRayVision is importable (doesn't trigger download)
    try:
        import torchxrayvision  # type: ignore  # noqa: F401
        loaded.append("torchxrayvision-available")
    except ImportError:
        pass
    return {
        "ok": True,
        "service": "medaccess-image-ml",
        "version": app.version,
        "models_loaded": loaded,
        "managed_models": model_status(),
    }


@app.post("/admin/pull-models")
def pull_models(force: bool = False) -> dict[str, object]:
    """Manually trigger weight downloads (idempotent)."""
    status = ensure_all(force=force)
    return {"ok": True, "downloaded": status, "managed_models": model_status()}


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
        model, model_name, model_type = get_skin_model()
        if model is None:
            return AnalyzeResponse(
                image_type="skin", skipped=True,
                skipped_reason=(
                    "No medical skin model loaded. "
                    "Convert skin-xception.onnx from services/image-ml/models/skin-xception/ "
                    "or train HAM10000 weights. See TODO.md §0.6."
                ),
                model_used="", processing_ms=elapsed_ms(),
            )

        findings = []

        # ── ConvNeXt HAM10000 path (Ratnakar01/convnext_ham10000_best) ────
        if model_type == "convnext":
            try:
                import torch  # type: ignore
                import torch.nn.functional as F  # type: ignore
                # Preprocess: ImageNet normalization, 224×224 input
                img_rgb = cv2.cvtColor(preprocess_skin(img_np), cv2.COLOR_BGR2RGB)
                img_resized = cv2.resize(img_rgb, (224, 224)).astype(np.float32) / 255.0
                mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
                std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
                img_norm = (img_resized - mean) / std
                tensor = torch.from_numpy(img_norm).permute(2, 0, 1).unsqueeze(0).float()
                # The loaded "model" is whatever was pickled. If it's an nn.Module run it;
                # if it's a state_dict, fall back gracefully (logs which case we hit).
                if hasattr(model, "eval"):
                    model.eval()  # type: ignore
                    with torch.no_grad():
                        logits = model(tensor)  # type: ignore
                    probs = F.softmax(logits, dim=1)[0].cpu().numpy()
                    for idx, conf in enumerate(probs):
                        if idx >= len(HAM10000_CLASSES):
                            break
                        conf = float(conf)
                        if conf >= 0.05:
                            findings.append(Finding(
                                label=HAM10000_CLASSES[idx],
                                confidence=round(conf, 3),
                                notes="ConvNeXt HAM10000 community checkpoint",
                            ))
                    findings.sort(key=lambda f: f.confidence, reverse=True)
                    findings = findings[:5]
                else:
                    # State-dict only — would need an architecture wrapper to run.
                    return AnalyzeResponse(
                        image_type="skin", skipped=True,
                        skipped_reason="skin-convnext checkpoint is a state_dict — needs a ConvNeXt arch wrapper to run.",
                        model_used=model_name, processing_ms=elapsed_ms(),
                    )
            except Exception as exc:
                return AnalyzeResponse(
                    image_type="skin", skipped=True,
                    skipped_reason=f"ConvNeXt skin inference error: {exc}",
                    model_used=model_name, processing_ms=elapsed_ms(),
                )

        # ── Xception ONNX path (Skin_Disease_AI, 92% accuracy) ────
        elif model_type == "onnx":
            import onnxruntime as ort  # type: ignore
            # Preprocess: resize to 299x299, apply Xception preprocessing [-1, 1]
            img_rgb = cv2.cvtColor(img_np, cv2.COLOR_BGR2RGB)
            img_resized = cv2.resize(img_rgb, (299, 299)).astype(np.float32)
            img_resized = (img_resized / 127.5) - 1.0  # Xception preprocess_input
            img_batch = np.expand_dims(img_resized, axis=0)  # (1, 299, 299, 3)

            input_name = model.get_inputs()[0].name  # type: ignore
            outputs = model.run(None, {input_name: img_batch})[0][0]  # type: ignore
            # outputs shape: (6,) — probabilities per class
            for idx, conf in enumerate(outputs):
                conf = float(conf)
                if conf >= 0.05 and idx < len(SKIN_XCEPTION_CLASSES):
                    label = SKIN_XCEPTION_CLASSES[idx]
                    findings.append(Finding(
                        label=label,
                        confidence=round(conf, 3),
                        notes=f"Xception 92% model — {label}",
                    ))
            findings.sort(key=lambda f: f.confidence, reverse=True)
            findings = findings[:5]

        # ── HAM10000 YOLO path ─────────────────────────────────────
        elif model_type == "yolo":
            preprocessed = preprocess_skin(img_np)
            results = model(preprocessed, verbose=False)  # type: ignore
            probs = results[0].probs
            names = results[0].names
            is_ham = len(names) == 7
            for idx, conf in zip(probs.top5, probs.top5conf.tolist()):
                if conf < 0.05:
                    break
                label = HAM10000_CLASSES[idx] if is_ham else names[int(idx)]
                findings.append(Finding(
                    label=label,
                    confidence=round(float(conf), 3),
                    notes="HAM10000 dermatology specialist",
                ))

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

    # ── Eye fundus (diabetic retinopathy) ─────────────────────────
    if image_type == "eye":
        sess, model_name, model_type = get_eye_model()
        if sess is None:
            return AnalyzeResponse(
                image_type="eye", skipped=True,
                skipped_reason="Eye DR model not present. Boot the sidecar to auto-download, or POST /admin/pull-models.",
                model_used="", processing_ms=elapsed_ms(),
            )
        try:
            # ONNX DR classifier — 224×224 RGB, ImageNet normalization
            img_rgb = cv2.cvtColor(img_np, cv2.COLOR_BGR2RGB)
            img_resized = cv2.resize(img_rgb, (224, 224)).astype(np.float32) / 255.0
            mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
            std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
            img_norm = (img_resized - mean) / std
            inp = np.transpose(img_norm, (2, 0, 1))[np.newaxis, ...].astype(np.float32)
            input_name = sess.get_inputs()[0].name  # type: ignore
            out = sess.run(None, {input_name: inp})[0][0]  # type: ignore
            # BlairFerg ONNX already applies softmax internally (outputs sum to ~1.0).
            # Do NOT apply softmax again — it compresses confident predictions incorrectly.
            already_prob = bool(np.all(out >= 0) and np.all(out <= 1) and 0.98 <= float(out.sum()) <= 1.02)
            if already_prob:
                probs = out
            else:
                exps = np.exp(out - np.max(out))
                probs = exps / exps.sum()
            findings = []
            for idx, conf in enumerate(probs):
                if idx >= len(DR_CLASSES):
                    break
                conf = float(conf)
                if conf >= 0.05:
                    findings.append(Finding(
                        label=DR_CLASSES[idx],
                        confidence=round(conf, 3),
                        notes="DR classifier (community ONNX, accuracy TBD)",
                    ))
            findings.sort(key=lambda f: f.confidence, reverse=True)
            return AnalyzeResponse(
                image_type="eye", skipped=False,
                findings=findings[:5],
                model_used=model_name,
                processing_ms=elapsed_ms(),
            )
        except Exception as exc:
            return AnalyzeResponse(
                image_type="eye", skipped=True,
                skipped_reason=f"Eye inference error: {exc}",
                model_used=model_name, processing_ms=elapsed_ms(),
            )

    # ── Unknown / other ───────────────────────────────────────────
    return AnalyzeResponse(
        image_type=image_type, skipped=True,
        skipped_reason=f"Type '{image_type}' — no specialist model loaded yet. Add hint='skin'/'xray'/'eye'/'malaria' if misdetected.",
        model_used="", processing_ms=elapsed_ms(),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
