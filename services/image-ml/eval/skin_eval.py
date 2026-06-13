"""
HAM10000 skin lesion eval harness — MedAccess image-ml sidecar.

Evaluates the currently loaded skin model (ConvNeXt / Xception ONNX / HAM10000 YOLO)
against the HAM10000 validation split (same 20% held-out split used by train_skin.py).

Metrics reported:
  - Top-1 accuracy (primary)
  - Top-3 accuracy
  - Per-class sensitivity (recall)
  - Per-class precision
  - Confusion matrix (optional, --confusion flag)

Usage:
    python eval/skin_eval.py \\
        --raw-dir   services/image-ml/data/ham10000_raw \\
        --meta-csv  services/image-ml/data/ham10000_metadata.csv

    python eval/skin_eval.py --raw-dir ... --meta-csv ... --confusion
    python eval/skin_eval.py --raw-dir ... --meta-csv ... --out eval/results_skin.md

Download dataset first (pick one):
    A) kaggle datasets download -d kmader/skin-lesion-analysis-toward-melanoma-detection
    B) https://isic-archive.com -> Training Data -> HAM10000 part 1 + part 2 + metadata CSV
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

# Ensure parent dir is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import (
    HAM10000_CLASSES,
    SKIN_XCEPTION_CLASSES,
    get_skin_model,
    preprocess_skin,
)

LABEL_MAP = {
    "mel":   "melanoma",
    "nv":    "melanocytic nevus",
    "bcc":   "basal cell carcinoma",
    "akiec": "actinic keratosis",
    "bkl":   "benign keratosis",
    "df":    "dermatofibroma",
    "vasc":  "vascular lesion",
}

VAL_SPLIT = 0.2  # must match train_skin.py


def build_val_set(raw_dir: Path, meta_csv: Path) -> list[tuple[Path, str]]:
    """Return (image_path, true_label) pairs for the held-out validation split."""
    rows: list[dict] = []
    with open(meta_csv, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    by_class: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        label = LABEL_MAP.get(row["dx"])
        if label:
            by_class[label].append(row["image_id"])

    all_images: dict[str, Path] = {}
    for p in raw_dir.rglob("*.jpg"):
        all_images[p.stem] = p
    for p in raw_dir.rglob("*.jpeg"):
        all_images[p.stem] = p

    val_set: list[tuple[Path, str]] = []
    for label, image_ids in by_class.items():
        n_val = max(1, int(len(image_ids) * VAL_SPLIT))
        for image_id in image_ids[:n_val]:
            path = all_images.get(image_id)
            if path:
                val_set.append((path, label))

    return val_set


def infer(model: object, model_type: str, img_bgr: np.ndarray) -> list[tuple[str, float]]:
    """Run one image through the current model. Returns [(label, confidence), ...] sorted desc."""
    if model_type == "convnext":
        import torch
        import torch.nn.functional as F

        img_rgb = cv2.cvtColor(preprocess_skin(img_bgr), cv2.COLOR_BGR2RGB)
        img_r = cv2.resize(img_rgb, (224, 224)).astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        tensor = torch.from_numpy((img_r - mean) / std).permute(2, 0, 1).unsqueeze(0).float()
        model.eval()  # type: ignore
        with torch.no_grad():
            logits = model(tensor)  # type: ignore
        probs = F.softmax(logits, dim=1)[0].cpu().numpy()
        return sorted(
            [(HAM10000_CLASSES[i], float(probs[i])) for i in range(len(HAM10000_CLASSES))],
            key=lambda x: x[1], reverse=True,
        )

    if model_type == "onnx":
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        img_r = cv2.resize(img_rgb, (299, 299)).astype(np.float32)
        img_r = (img_r / 127.5) - 1.0
        inp = np.expand_dims(img_r, axis=0)
        input_name = model.get_inputs()[0].name  # type: ignore
        out = model.run(None, {input_name: inp})[0][0]  # type: ignore
        classes = SKIN_XCEPTION_CLASSES
        return sorted(
            [(classes[i], float(out[i])) for i in range(len(classes))],
            key=lambda x: x[1], reverse=True,
        )

    if model_type == "yolo":
        preprocessed = preprocess_skin(img_bgr)
        results = model(preprocessed, verbose=False)  # type: ignore
        probs = results[0].probs
        names = results[0].names
        is_ham = len(names) == 7
        out = []
        for idx, conf in zip(probs.top5, probs.top5conf.tolist()):
            label = HAM10000_CLASSES[idx] if is_ham else names[int(idx)]
            out.append((label, float(conf)))
        return out

    return []


def run_eval(val_set: list[tuple[Path, str]], model: object, model_type: str) -> dict:
    classes = HAM10000_CLASSES if model_type in ("convnext", "yolo") else SKIN_XCEPTION_CLASSES

    top1_correct = 0
    top3_correct = 0
    total = 0
    errors = 0

    # per-class: true positives, false positives, false negatives
    tp: dict[str, int] = defaultdict(int)
    fp: dict[str, int] = defaultdict(int)
    fn: dict[str, int] = defaultdict(int)
    confusion: dict[tuple[str, str], int] = defaultdict(int)  # (true, pred) -> count

    t0 = time.perf_counter()

    for i, (img_path, true_label) in enumerate(val_set):
        img = cv2.imread(str(img_path))
        if img is None:
            errors += 1
            continue

        try:
            preds = infer(model, model_type, img)
        except Exception as exc:
            print(f"  inference error on {img_path.name}: {exc}")
            errors += 1
            continue

        if not preds:
            errors += 1
            continue

        top1_label = preds[0][0]
        top3_labels = {p[0] for p in preds[:3]}

        if top1_label == true_label:
            top1_correct += 1
        if true_label in top3_labels:
            top3_correct += 1

        confusion[(true_label, top1_label)] += 1
        if top1_label == true_label:
            tp[true_label] += 1
        else:
            fp[top1_label] += 1
            fn[true_label] += 1

        total += 1
        if (i + 1) % 50 == 0:
            elapsed = time.perf_counter() - t0
            pct = (i + 1) / len(val_set) * 100
            print(f"  {i+1}/{len(val_set)}  ({pct:.0f}%)  elapsed {elapsed:.0f}s", end="\r")

    elapsed_total = time.perf_counter() - t0
    print()

    per_class = {}
    for cls in classes:
        t = tp[cls]
        f_p = fp[cls]
        f_n = fn[cls]
        precision = t / (t + f_p) if (t + f_p) > 0 else 0.0
        recall    = t / (t + f_n) if (t + f_n) > 0 else 0.0
        f1        = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        per_class[cls] = {"precision": precision, "recall": recall, "f1": f1, "tp": t, "fp": f_p, "fn": f_n}

    return {
        "total": total,
        "errors": errors,
        "top1_accuracy": top1_correct / total if total else 0.0,
        "top3_accuracy": top3_correct / total if total else 0.0,
        "top1_correct": top1_correct,
        "top3_correct": top3_correct,
        "per_class": per_class,
        "confusion": dict(confusion),
        "elapsed_s": elapsed_total,
        "ms_per_image": elapsed_total * 1000 / total if total else 0,
    }


def format_markdown(results: dict, model_name: str, model_type: str, val_size: int) -> str:
    r = results
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"# Skin Model Eval — HAM10000 Validation Split",
        f"",
        f"**Date:** {now}  ",
        f"**Model:** `{model_name}` ({model_type})  ",
        f"**Val set:** {val_size} images (20% held-out, same split as train_skin.py)  ",
        f"**Evaluated:** {r['total']} images  ({r['errors']} skipped due to read/inference errors)  ",
        f"**Avg inference time:** {r['ms_per_image']:.0f} ms/image  ",
        f"",
        f"## Overall",
        f"",
        f"| Metric | Score |",
        f"|---|---|",
        f"| Top-1 accuracy | **{r['top1_accuracy']*100:.1f}%** ({r['top1_correct']}/{r['total']}) |",
        f"| Top-3 accuracy | **{r['top3_accuracy']*100:.1f}%** ({r['top3_correct']}/{r['total']}) |",
        f"",
        f"## Per-class",
        f"",
        f"| Class | Precision | Recall (sensitivity) | F1 |",
        f"|---|---|---|---|",
    ]
    for cls, m in r["per_class"].items():
        lines.append(
            f"| {cls} | {m['precision']*100:.1f}% | {m['recall']*100:.1f}% | {m['f1']*100:.1f}% |"
        )

    lines += [
        f"",
        f"## Notes",
        f"",
        f"- HAM10000 license: CC BY-NC 4.0 — research/eval only, not for commercial deployment.",
        f"- None of these models are FDA/CE cleared.",
        f"- Eval run on CPU only.",
    ]
    return "\n".join(lines)


def print_confusion(confusion: dict, classes: list[str]) -> None:
    # Only show classes that appear in results
    active = sorted({c for (t, p) in confusion for c in (t, p)})
    short = {c: c[:8] for c in active}
    header = "True\\Pred".ljust(22) + "  ".join(short[c].ljust(8) for c in active)
    print(header)
    for true in active:
        row = short[true].ljust(22)
        for pred in active:
            count = confusion.get((true, pred), 0)
            cell = str(count) if count else "."
            row += cell.ljust(10)
        print(row)


def main() -> None:
    parser = argparse.ArgumentParser(description="Eval skin model on HAM10000 val split")
    parser.add_argument("--raw-dir",   required=True, help="Folder with all HAM10000 .jpg images")
    parser.add_argument("--meta-csv",  required=True, help="HAM10000_metadata.csv path")
    parser.add_argument("--out",       default=str(Path(__file__).parent / "results_skin.md"),
                        help="Output markdown file (default: eval/results_skin.md)")
    parser.add_argument("--confusion", action="store_true", help="Print confusion matrix")
    parser.add_argument("--limit",     type=int, default=0,
                        help="Limit number of eval images (0 = all, useful for a quick smoke test)")
    args = parser.parse_args()

    raw_dir  = Path(args.raw_dir)
    meta_csv = Path(args.meta_csv)

    if not raw_dir.exists():
        print(f"ERROR: raw image dir not found: {raw_dir}")
        sys.exit(1)
    if not meta_csv.exists():
        print(f"ERROR: metadata CSV not found: {meta_csv}")
        sys.exit(1)

    print("Loading skin model...")
    model, model_name, model_type = get_skin_model()
    if model is None:
        print("ERROR: no skin model loaded. Download weights first.")
        sys.exit(1)
    print(f"  Model: {model_name}  type={model_type}")

    print("Building validation set...")
    val_set = build_val_set(raw_dir, meta_csv)
    print(f"  Val set: {len(val_set)} images")

    if args.limit > 0:
        val_set = val_set[:args.limit]
        print(f"  [--limit {args.limit}] using first {len(val_set)} images only")

    print(f"Running inference...")
    results = run_eval(val_set, model, model_type)

    print(f"\n=== Results ===")
    print(f"  Top-1 accuracy: {results['top1_accuracy']*100:.1f}%  ({results['top1_correct']}/{results['total']})")
    print(f"  Top-3 accuracy: {results['top3_accuracy']*100:.1f}%  ({results['top3_correct']}/{results['total']})")
    print(f"  Avg inference:  {results['ms_per_image']:.0f} ms/image")
    if results["errors"]:
        print(f"  Errors skipped: {results['errors']}")

    print(f"\nPer-class (recall / precision / F1):")
    classes = HAM10000_CLASSES if model_type in ("convnext", "yolo") else SKIN_XCEPTION_CLASSES
    for cls in classes:
        m = results["per_class"].get(cls, {})
        if m:
            print(f"  {cls:<28}  recall={m['recall']*100:.1f}%  prec={m['precision']*100:.1f}%  f1={m['f1']*100:.1f}%")

    if args.confusion:
        print("\nConfusion matrix:")
        print_confusion(results["confusion"], classes)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    md = format_markdown(results, model_name, model_type, len(val_set))
    out_path.write_text(md, encoding="utf-8")
    print(f"\nResults written to: {out_path}")


if __name__ == "__main__":
    main()
