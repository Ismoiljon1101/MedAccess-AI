"""
MedAccess AI — Medical Image ML sidecar service.

Owner: Temirlan. Interface contract jointly with Ismail.
See docs/team/temirlan.md and services/image-ml/README.md.

This is a stub. /healthz is real. /analyze returns a structured response
with `skipped: true` until specialist models are wired in.
"""

from __future__ import annotations

import io
import time
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image


app = FastAPI(
    title="MedAccess Image ML",
    version="0.1.0",
    description="Specialist medical-image inference sidecar.",
)

# CORS — Node API on localhost:4000 calls us. Patient/clinic apps never call directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── Response contract (mirrored in TypeScript at apps/api/src/services/vision.ts) ──

class Finding(BaseModel):
    """One specialist-model finding on the image."""

    label: str = Field(..., description="Short clinical label, e.g. 'melanoma' or 'pleural effusion'.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence [0,1].")
    notes: str = Field("", description="Optional natural-language context.")


class AnalyzeResponse(BaseModel):
    """Stable contract Node depends on. Do not break."""

    image_type: Literal["skin", "xray", "eye", "other", "unknown"] = "unknown"
    skipped: bool = Field(False, description="True if no specialist model handled this image.")
    skipped_reason: str = ""
    findings: list[Finding] = []
    model_used: str = ""
    processing_ms: int = 0


# ── Endpoints ──────────────────────────────────────────────────────────

@app.get("/healthz")
def healthz() -> dict[str, object]:
    """Liveness probe for Node and Docker."""
    return {
        "ok": True,
        "service": "medaccess-image-ml",
        "version": app.version,
        "models_loaded": [],  # populate when specialist models are wired in
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    image: UploadFile = File(..., description="JPEG / PNG / WEBP medical image."),
    hint: str = Form("", description="Optional hint from caller: 'skin', 'xray', 'eye'."),
) -> AnalyzeResponse:
    """
    Run specialist medical-image models on the uploaded image.

    Pipeline (to be implemented by Temirlan):
        1. Triage — what body part? (use `hint` or run a small classifier)
        2. Preprocess — OpenCV (CLAHE for X-ray; resize+normalize for skin)
        3. Specialist inference — YOLOv8/HAM10000 for skin, TorchXRayVision for chest, etc.
        4. Postprocess — top-k findings with confidence + clinical notes
        5. Return AnalyzeResponse
    """
    start = time.perf_counter()

    # Basic validation — ensure PIL can open it.
    try:
        raw = await image.read()
        pil = Image.open(io.BytesIO(raw))
        pil.verify()  # raises if corrupt
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    # TODO(Temirlan): real triage + specialist inference.
    # For now: stub that lets the Node side test the integration end-to-end.
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return AnalyzeResponse(
        image_type=hint.lower() if hint.lower() in {"skin", "xray", "eye"} else "unknown",
        skipped=True,
        skipped_reason="Specialist models not yet implemented. See README.md.",
        findings=[],
        model_used="stub",
        processing_ms=elapsed_ms,
    )


if __name__ == "__main__":
    # Run directly: `python main.py` for quick local testing.
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
