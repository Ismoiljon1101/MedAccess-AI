"""
Download the ISIC 2018 Task 3 held-out test set from Harvard Dataverse.
No Kaggle / no login needed — fully public.

Downloads:
  - Ground truth labels (130 KB)     → eval/sample_data/ground_truth.tab
  - Test images zip (421 MB)         → eval/sample_data/ISIC2018_Test.zip (then extracted)

Then runs eval on the 1512 test images against the current skin model.
Results written to eval/results_skin.md.

Usage:
    python eval/download_sample.py               # full download + eval
    python eval/download_sample.py --skip-download  # re-eval already downloaded images
"""

from __future__ import annotations

import argparse
import csv
import io
import ssl
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

ssl._create_default_https_context = ssl._create_unverified_context  # type: ignore

DATAVERSE_BASE = "https://dataverse.harvard.edu/api/access/datafile"
GT_FILE_ID     = 6924466    # ISIC2018_Task3_Test_GroundTruth.tab  (130 KB)
IMG_FILE_ID    = 3855824    # ISIC2018_Task3_Test_Images.zip        (421 MB)

BASE_DIR   = Path(__file__).parent
DATA_DIR   = BASE_DIR / "sample_data"
GT_PATH    = DATA_DIR / "ground_truth.tab"
IMG_DIR    = DATA_DIR / "images"
ZIP_PATH   = DATA_DIR / "ISIC2018_Test.zip"

LABEL_MAP = {
    "mel":   "melanoma",
    "nv":    "melanocytic nevus",
    "bcc":   "basal cell carcinoma",
    "akiec": "actinic keratosis",
    "bkl":   "benign keratosis",
    "df":    "dermatofibroma",
    "vasc":  "vascular lesion",
}


def download_file(file_id: int, dest: Path, desc: str) -> None:
    if dest.exists():
        print(f"  [skip] {desc} already exists ({dest.stat().st_size // 1024} KB)")
        return

    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{DATAVERSE_BASE}/{file_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "MedAccess-eval/1.0"})

    print(f"  Downloading {desc}...")
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            total = int(r.headers.get("Content-Length", 0))
            downloaded = 0
            block = 1 << 16
            with open(tmp, "wb") as f:
                while True:
                    chunk = r.read(block)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = downloaded * 100 // total
                        bar = "#" * (pct // 5) + "." * (20 - pct // 5)
                        print(f"\r    [{bar}] {pct}%  {downloaded // 1024 // 1024} MB", end="", flush=True)
        print()
        tmp.rename(dest)
        print(f"    saved {dest.stat().st_size // 1024 // 1024} MB -> {dest.name}")
    except Exception as exc:
        tmp.unlink(missing_ok=True)
        print(f"\n    FAILED: {exc}")
        sys.exit(1)


def load_ground_truth() -> dict[str, str]:
    """Returns {image_id: label} from the ground truth tab file."""
    pairs: dict[str, str] = {}
    with open(GT_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            image_id = row["image_id"].strip('"')
            dx_code  = row["dx"].strip('"')
            label    = LABEL_MAP.get(dx_code)
            if label:
                pairs[image_id] = label
    return pairs


def extract_images() -> None:
    if IMG_DIR.exists() and any(IMG_DIR.rglob("*.jpg")):
        count = sum(1 for _ in IMG_DIR.rglob("*.jpg"))
        print(f"  [skip] images already extracted ({count} jpg files in {IMG_DIR})")
        return

    print(f"  Extracting {ZIP_PATH.name}...")
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ZIP_PATH, "r") as zf:
        members = [m for m in zf.namelist() if m.lower().endswith(".jpg")]
        for i, member in enumerate(members):
            zf.extract(member, IMG_DIR)
            if (i + 1) % 100 == 0:
                print(f"\r    extracted {i+1}/{len(members)}", end="", flush=True)
    print(f"\n    done — {len(members)} images")


def run_eval(gt: dict[str, str]) -> None:
    sys.path.insert(0, str(BASE_DIR.parent))
    from main import get_skin_model, preprocess_skin, HAM10000_CLASSES, SKIN_XCEPTION_CLASSES
    import cv2
    import numpy as np
    from collections import defaultdict
    from datetime import datetime, timezone

    model, model_name, model_type = get_skin_model()
    if model is None:
        print("ERROR: no skin model loaded.")
        sys.exit(1)

    classes = HAM10000_CLASSES if model_type in ("convnext", "yolo") else SKIN_XCEPTION_CLASSES

    # Build (image_path, true_label) pairs
    all_jpegs = {p.stem: p for p in IMG_DIR.rglob("*.jpg")}
    pairs = [(all_jpegs[img_id], label) for img_id, label in gt.items() if img_id in all_jpegs]

    print(f"\nModel  : {model_name}  ({model_type})")
    print(f"Images : {len(pairs)} of {len(gt)} ground truth entries found on disk")
    print(f"Running inference...\n")

    top1 = top3 = total = errors = 0
    tp: dict[str, int]  = defaultdict(int)
    fp: dict[str, int]  = defaultdict(int)
    fn: dict[str, int]  = defaultdict(int)
    t0 = time.perf_counter()

    for i, (img_path, true_label) in enumerate(pairs):
        img = cv2.imread(str(img_path))
        if img is None:
            errors += 1
            continue

        try:
            if model_type == "convnext":
                import torch
                import torch.nn.functional as F
                img_rgb = cv2.cvtColor(preprocess_skin(img), cv2.COLOR_BGR2RGB)
                img_r = cv2.resize(img_rgb, (224, 224)).astype(np.float32) / 255.0
                mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
                std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
                tensor = torch.from_numpy((img_r - mean) / std).permute(2, 0, 1).unsqueeze(0).float()
                model.eval()
                with torch.no_grad():
                    logits = model(tensor)
                probs = F.softmax(logits, dim=1)[0].cpu().numpy()
                sorted_preds = sorted(enumerate(probs), key=lambda x: x[1], reverse=True)
                top1_label   = HAM10000_CLASSES[sorted_preds[0][0]]
                top3_labels  = {HAM10000_CLASSES[idx] for idx, _ in sorted_preds[:3]}

            elif model_type == "yolo":
                preprocessed = preprocess_skin(img)
                results = model(preprocessed, verbose=False)
                probs = results[0].probs
                names = results[0].names
                is_ham = len(names) == 7
                top1_label  = HAM10000_CLASSES[int(probs.top1)] if is_ham else names[int(probs.top1)]
                top3_labels = {HAM10000_CLASSES[idx] if is_ham else names[int(idx)] for idx in probs.top5[:3]}

            else:
                errors += 1
                continue

        except Exception as exc:
            print(f"\n  error {img_path.name}: {exc}")
            errors += 1
            continue

        if top1_label == true_label:
            top1 += 1
            tp[true_label] += 1
        else:
            fp[top1_label] += 1
            fn[true_label] += 1

        if true_label in top3_labels:
            top3 += 1

        total += 1
        if (i + 1) % 50 == 0:
            elapsed = time.perf_counter() - t0
            print(f"  {i+1}/{len(pairs)}  top-1: {top1/total*100:.1f}%  elapsed: {elapsed:.0f}s", end="\r")

    elapsed_total = time.perf_counter() - t0
    print()

    print(f"\n=== Results ===")
    print(f"  Images evaluated : {total}  (errors: {errors})")
    print(f"  Top-1 accuracy   : {top1/total*100:.1f}%  ({top1}/{total})")
    print(f"  Top-3 accuracy   : {top3/total*100:.1f}%  ({top3}/{total})")
    print(f"  Avg inference    : {elapsed_total*1000/total:.0f} ms/image")

    print(f"\nPer-class recall (sensitivity):")
    for cls in classes:
        t = tp[cls]; fn_ = fn[cls]
        n = t + fn_
        recall = t / n if n else 0.0
        bar = "#" * int(recall * 20)
        print(f"  {cls:<28}  {recall*100:5.1f}%  [{bar:<20}]  ({t}/{n})")

    # Write results_skin.md
    out = BASE_DIR / "results_skin.md"
    lines = [
        "# Skin Model Eval — ISIC 2018 Task 3 Test Set",
        "",
        f"**Date:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}  ",
        f"**Model:** `{model_name}` ({model_type})  ",
        f"**Test set:** ISIC 2018 Task 3 held-out test set ({total} images, Harvard Dataverse doi:10.7910/DVN/DBW86T)  ",
        f"**Errors/skipped:** {errors}  ",
        f"**Avg inference time:** {elapsed_total*1000/total:.0f} ms/image (CPU)  ",
        "",
        "## Overall",
        "",
        "| Metric | Score |",
        "|---|---|",
        f"| Top-1 accuracy | **{top1/total*100:.1f}%** ({top1}/{total}) |",
        f"| Top-3 accuracy | **{top3/total*100:.1f}%** ({top3}/{total}) |",
        "",
        "## Per-class recall (sensitivity)",
        "",
        "| Class | Recall | Count |",
        "|---|---|---|",
    ]
    for cls in classes:
        t = tp[cls]; fn_ = fn[cls]; n = t + fn_
        recall = t / n if n else 0.0
        lines.append(f"| {cls} | {recall*100:.1f}% | {t}/{n} |")

    lines += [
        "",
        "## Notes",
        "",
        "- Test set is the official ISIC 2018 Task 3 held-out set (not used in HAM10000 training).",
        "- HAM10000 license: CC BY-NC 4.0 — research/eval only.",
        "- None of these models are FDA/CE cleared.",
        "- Inference on CPU only.",
    ]
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nResults written: {out}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-download", action="store_true",
                        help="Skip download, eval on already-downloaded images")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not args.skip_download:
        print("=== Step 1: Ground truth labels (130 KB) ===")
        download_file(GT_FILE_ID, GT_PATH, "ISIC2018_Task3_Test_GroundTruth.tab")

        print("\n=== Step 2: Test images (421 MB) ===")
        download_file(IMG_FILE_ID, ZIP_PATH, "ISIC2018_Task3_Test_Images.zip")

        print("\n=== Step 3: Extract images ===")
        extract_images()

    print("\n=== Step 4: Load ground truth ===")
    gt = load_ground_truth()
    class_counts = {}
    for label in LABEL_MAP.values():
        class_counts[label] = sum(1 for v in gt.values() if v == label)
    print(f"  {len(gt)} labelled images")
    for cls, count in class_counts.items():
        print(f"    {cls:<28} {count}")

    print("\n=== Step 5: Eval ===")
    run_eval(gt)


if __name__ == "__main__":
    main()
