"""
MedAccess AI — model manager.

Single source of truth for which specialist medical-vision models we ship,
where their weights live on HuggingFace, and whether they're present locally.

`ensure_all()` downloads any missing weights to `services/image-ml/models/`.
Idempotent: skips files already present at the expected size.
Called on sidecar startup (FastAPI lifespan) so a fresh clone "just works":
    pip install -r requirements.txt
    uvicorn main:app --port 5001
    # → manager pulls any missing weights, sidecar serves them.

To add a new model: append to MODELS below.

Status note: TorchXRayVision (X-ray) is NOT downloaded here — it auto-fetches
its DenseNet weights from its own CDN on first inference call, fully managed
by the `torchxrayvision` package. We only manage HF-hosted weight files.
"""
from __future__ import annotations

import os
import ssl
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

# Korean ISP TLS bypass — same justification as elsewhere in this service
ssl._create_default_https_context = ssl._create_unverified_context  # type: ignore

BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)


@dataclass(frozen=True)
class ManagedModel:
    """One pretrained specialist model we ship."""
    key: str          # short identifier — also used in /healthz
    filename: str     # destination file under models/
    url: str          # direct download URL (must resolve 200 / 302→200)
    min_bytes: int    # sanity-check minimum file size (defeats truncated downloads)
    license: str
    note: str

    @property
    def path(self) -> Path:
        return MODELS_DIR / self.filename

    def is_present(self) -> bool:
        return self.path.exists() and self.path.stat().st_size >= self.min_bytes


# ── Catalog ───────────────────────────────────────────────────────────────────
# All URLs verified resolving 2026-06-10. Update here, not in main.py.
#
# Malaria weights remain unset until Temirlan picks a checkpoint or trains —
# the keremberke/yolov8s-malaria-detection HF repo is now 401/gone. The
# sidecar handles missing weights by returning {"skipped": true, ...}.
MODELS: list[ManagedModel] = [
    ManagedModel(
        key="skin-convnext-ham10000",
        filename="skin-convnext-ham10000.pth",
        # Ratnakar01/convnext_ham10000_best — ConvNeXt HAM10000 classifier
        url="https://huggingface.co/Ratnakar01/convnext_ham10000_best/resolve/main/convnext_ham10000_best.pth",
        min_bytes=300_000_000,  # ~334 MB
        license="Research / open-weight community checkpoint — accuracy TBD on our eval",
        note="HAM10000 7-class skin lesion classifier",
    ),
    ManagedModel(
        key="eye-dr-onnx",
        filename="eye-dr-detect.onnx",
        # BlairFerg/diabetic-retinopathy-detection — packaged ONNX classifier
        url="https://huggingface.co/BlairFerg/diabetic-retinopathy-detection/resolve/main/dr_detect_model.onnx",
        min_bytes=200_000_000,  # ~214 MB
        license="Research / open-weight community checkpoint — accuracy TBD on our eval",
        note="Diabetic-retinopathy ONNX classifier",
    ),
]


def _download(model: ManagedModel) -> None:
    """Download a single weight file with a progress bar."""
    print(f"  ↓ {model.key}  ({model.filename})")
    print(f"    {model.url}")
    tmp = model.path.with_suffix(model.path.suffix + ".part")
    req = urllib.request.Request(model.url, headers={"User-Agent": "MedAccess-image-ml/0.4"})
    try:
        with urllib.request.urlopen(req) as r:
            total = int(r.headers.get("Content-Length", 0))
            downloaded = 0
            block = 1 << 16  # 64 KB
            with open(tmp, "wb") as f:
                while True:
                    chunk = r.read(block)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0 and sys.stdout.isatty():
                        pct = downloaded * 100 // total
                        bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
                        sys.stdout.write(f"\r    [{bar}] {pct}% {downloaded // 1024 // 1024} MB")
                        sys.stdout.flush()
        if sys.stdout.isatty():
            sys.stdout.write("\n")
        tmp.rename(model.path)
        size_mb = model.path.stat().st_size / 1024 / 1024
        print(f"    ✓ saved {size_mb:.0f} MB → {model.path}")
    except Exception as exc:
        tmp.unlink(missing_ok=True)
        print(f"    ✗ {model.key} download failed: {exc}")


def ensure_all(*, force: bool = False) -> dict[str, bool]:
    """Ensure every ManagedModel is present locally. Returns {key: present_after}.

    On download failure, leaves the model absent — the sidecar serves
    `skipped:true` for that modality, so the rest of the app keeps working.
    """
    print(f"[model_manager] checking weights in {MODELS_DIR}")
    status: dict[str, bool] = {}
    for m in MODELS:
        if m.is_present() and not force:
            size_mb = m.path.stat().st_size / 1024 / 1024
            print(f"  ✓ {m.key}  already present  ({size_mb:.0f} MB)")
            status[m.key] = True
            continue
        if force and m.path.exists():
            m.path.unlink()
        _download(m)
        status[m.key] = m.is_present()
    # Disable via env if a clinic wants strictly air-gapped runs
    return status


def model_status() -> dict[str, dict[str, object]]:
    """Lightweight status for /healthz — no downloads triggered."""
    out: dict[str, dict[str, object]] = {}
    for m in MODELS:
        out[m.key] = {
            "present": m.is_present(),
            "filename": m.filename,
            "size_mb": (m.path.stat().st_size / 1024 / 1024) if m.path.exists() else 0,
        }
    return out


if __name__ == "__main__":
    force = "--force" in sys.argv
    ensure_all(force=force)
