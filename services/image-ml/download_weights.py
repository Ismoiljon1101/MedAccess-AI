"""
Download pre-trained model weights for MedAccess sidecar.

Run: python download_weights.py

Models downloaded:
  malaria-yolov8s.pt  — YOLOv8s trained on NIH malaria smear dataset (MIT)
                        Source: keremberke/yolov8s-malaria-detection (HuggingFace)

Note: skin-ham10000.pt must be trained locally — run train_skin.py
"""

import ssl
import sys
import urllib.request
from pathlib import Path

# Korean ISP TLS bypass
ssl._create_default_https_context = ssl._create_unverified_context  # type: ignore

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

WEIGHTS = [
    (
        "malaria-yolov8s.pt",
        "https://huggingface.co/keremberke/yolov8s-malaria-detection/resolve/main/best.pt",
        "MIT — YOLOv8s malaria parasite detector (NIH Thin Blood Smear dataset)",
    ),
]


def download(name: str, url: str, desc: str) -> None:
    dst = MODELS_DIR / name
    if dst.exists():
        print(f"  [skip] {name} already exists ({dst.stat().st_size // 1024} KB)")
        return
    print(f"  Downloading {name}  ({desc})")
    print(f"    from {url}")

    opener = urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=ssl._create_unverified_context())
    )
    downloaded = 0

    def progress(count: int, block: int, total: int) -> None:
        nonlocal downloaded
        downloaded = count * block
        if total > 0:
            pct = min(100, downloaded * 100 // total)
            bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
            print(f"\r    [{bar}] {pct}%  {downloaded // 1024} KB", end="", flush=True)

    try:
        with opener.open(url) as r:
            total = int(r.headers.get("Content-Length", 0))
            data = b""
            block = 65536
            count = 0
            while True:
                chunk = r.read(block)
                if not chunk:
                    break
                data += chunk
                count += 1
                progress(count, block, total)
        print()
        dst.write_bytes(data)
        print(f"    ✓ saved {dst.stat().st_size // 1024} KB → {dst}")
    except Exception as exc:
        print(f"\n    ✗ failed: {exc}")
        sys.exit(1)


def verify(name: str) -> None:
    """Quick sanity-check that the file loads as a YOLO model."""
    try:
        from ultralytics import YOLO  # type: ignore
        m = YOLO(str(MODELS_DIR / name))
        print(f"  ✓ {name} loads OK  (task={m.task})")
    except Exception as exc:
        print(f"  ✗ {name} load error: {exc}")


if __name__ == "__main__":
    print("=== MedAccess weight downloader ===\n")
    for name, url, desc in WEIGHTS:
        download(name, url, desc)
    print("\n=== Verifying ===")
    for name, _, _ in WEIGHTS:
        verify(name)
    print("\nDone. Start sidecar: python main.py")
