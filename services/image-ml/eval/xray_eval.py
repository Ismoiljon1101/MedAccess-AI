"""
Chest X-ray model eval harness — MedAccess image-ml sidecar.

Author:  Temirlan
Created: 2026-06-14

Evaluates the TorchXRayVision DenseNet121-all model (multi-label, 18 pathologies)
against a folder of chest X-rays + a labels CSV. Dataset-agnostic — same reason as
the eye harness: no clean no-auth public CXR set, so point it at whatever you obtain:

  - NIH ChestX-ray14 (Data_Entry_2017.csv) — "Image Index" + pipe-separated "Finding Labels"
  - VinDr-CXR / CheXpert                    — one binary column per pathology
  - any folder + CSV in one of those two shapes

The headline CXR metric is per-pathology AUROC (this is how TorchXRayVision reports
itself — mean AUROC ~0.80 across datasets). Only pathologies present in BOTH the
dataset labels and the model's 18 outputs are scored.

Metrics (computed by hand — no sklearn):
  per-pathology AUROC · mean AUROC · positive/negative support per pathology

Usage:
    # NIH ChestX-ray14:
    python eval/xray_eval.py --images-dir data/nih/images --labels-csv data/nih/Data_Entry_2017.csv

    # Per-column dataset, capped at 1000 images:
    python eval/xray_eval.py --images-dir data/vindr/images --labels-csv data/vindr/labels.csv --limit 1000

    # No dataset? Prove the harness runs end-to-end on synthetic images:
    python eval/xray_eval.py --smoke-test

Results written to eval/results_xray.md (real runs only — smoke test never writes).
"""

from __future__ import annotations

import argparse
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

# Ensure parent dir is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import XRAY_PATHOLOGIES, get_xray_model, preprocess_xray  # noqa: E402

BASE_DIR = Path(__file__).parent
IMG_EXTS = (".jpg", ".jpeg", ".png")

# NIH ChestX-ray14 uses these exact finding names; they map 1:1 to the model's
# pathology names (case-insensitive), so no special aliasing is needed beyond case.
FINDING_LABEL_COLS = ["finding labels", "finding_labels", "labels"]
ID_COL_CANDIDATES  = ["image index", "image_index", "image", "image_id", "id", "filename", "name"]


# ── AUROC (no sklearn) ──────────────────────────────────────────────────────────

def auroc(y_true: list[int], y_score: list[float]) -> float | None:
    """Mann-Whitney U estimate of AUROC, with average-rank tie handling."""
    n_pos = sum(y_true)
    n_neg = len(y_true) - n_pos
    if n_pos == 0 or n_neg == 0:
        return None  # undefined without both classes
    paired = sorted(zip(y_score, y_true), key=lambda x: x[0])
    ranks = [0.0] * len(paired)
    i = 0
    while i < len(paired):
        j = i
        while j < len(paired) and paired[j][0] == paired[i][0]:
            j += 1
        avg_rank = (i + 1 + j) / 2.0
        for k in range(i, j):
            ranks[k] = avg_rank
        i = j
    sum_pos_ranks = sum(r for r, (_, t) in zip(ranks, paired) if t == 1)
    return (sum_pos_ranks - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)


# ── Inference (replicates main.py xray path) ────────────────────────────────────

def predict_pathology_scores(model: object, img_bgr: np.ndarray) -> dict[str, float]:
    """Return {pathology: sigmoid_score} for one X-ray — mirrors main.py."""
    import torch  # type: ignore
    tensor = preprocess_xray(img_bgr)
    with torch.no_grad():
        preds = model(tensor)[0].numpy()  # type: ignore  # shape (18,), sigmoid probs
    return {model.pathologies[i]: float(preds[i]) for i in range(len(model.pathologies))}  # type: ignore


# ── Dataset loading ─────────────────────────────────────────────────────────────

def _model_pathology_lookup(model: object) -> dict[str, str]:
    """Case-insensitive map: normalized name -> canonical model pathology name."""
    return {p.lower().strip(): p for p in model.pathologies if p in XRAY_PATHOLOGIES}  # type: ignore


def build_eval_set(
    images_dir: Path, labels_csv: Path, model: object, id_col: str | None,
) -> tuple[list[tuple[Path, dict[str, int]]], list[str]]:
    """Return (pairs, evaluated_pathologies).

    pairs: [(image_path, {pathology: 0/1}), ...] — labels only for pathologies the
    model can output. evaluated_pathologies: model pathologies that appear in the CSV.
    """
    import pandas as pd  # eval-only, not a service dep

    df = pd.read_csv(labels_csv)
    cols_lower = {c.lower().strip(): c for c in df.columns}
    model_lookup = _model_pathology_lookup(model)  # norm -> canonical

    # id column
    id_c = None
    if id_col:
        id_c = id_col
    else:
        for cand in ID_COL_CANDIDATES:
            if cand in cols_lower:
                id_c = cols_lower[cand]
                break
    if id_c is None:
        print(f"ERROR: could not find an image-id column. Pass --id-col. Columns: {list(df.columns)}")
        sys.exit(1)

    # label mode: NIH pipe-separated "Finding Labels", or one column per pathology
    finding_col = next((cols_lower[c] for c in FINDING_LABEL_COLS if c in cols_lower), None)

    if finding_col:
        evaluated = sorted(model_lookup.values())
        print(f"  label mode: NIH 'Finding Labels' (column '{finding_col}')")
    else:
        # per-pathology columns: intersect CSV columns with model pathologies
        evaluated = sorted({model_lookup[norm] for norm in cols_lower if norm in model_lookup})
        if not evaluated:
            print(f"ERROR: no pathology columns matched the model. "
                  f"Need a 'Finding Labels' column or per-pathology columns.\n"
                  f"  model pathologies: {sorted(model_lookup.values())}\n"
                  f"  CSV columns: {list(df.columns)}")
            sys.exit(1)
        print(f"  label mode: per-pathology columns ({len(evaluated)} matched)")

    # image lookup
    stem_to_path: dict[str, Path] = {}
    for ext in IMG_EXTS:
        for p in images_dir.rglob(f"*{ext}"):
            stem_to_path[p.stem] = p
    if not stem_to_path:
        print(f"ERROR: no images ({', '.join(IMG_EXTS)}) found under {images_dir}")
        sys.exit(1)

    pairs: list[tuple[Path, dict[str, int]]] = []
    missing = 0
    for _, row in df.iterrows():
        stem = Path(str(row[id_c]).strip()).stem
        path = stem_to_path.get(stem)
        if path is None:
            missing += 1
            continue
        labels: dict[str, int] = {}
        if finding_col:
            findings = {f.lower().strip() for f in str(row[finding_col]).split("|")}
            for norm, canonical in model_lookup.items():
                labels[canonical] = 1 if norm in findings else 0
        else:
            for canonical in evaluated:
                raw = row.get(cols_lower.get(canonical.lower().strip(), ""), 0)
                try:
                    v = int(float(raw))
                except (ValueError, TypeError):
                    v = 0
                labels[canonical] = 1 if v == 1 else 0  # CheXpert -1 (uncertain) -> negative
        pairs.append((path, labels))

    if missing:
        print(f"  note: {missing} CSV rows had no matching image file (skipped)")
    return pairs, evaluated


# ── Synthetic smoke test ────────────────────────────────────────────────────────

def make_synthetic_xray(seed: int) -> np.ndarray:
    """Grayscale noise + a faint ribcage-ish gradient — exercises the pipeline only."""
    rng = np.random.default_rng(seed)
    base = rng.integers(40, 90, (224, 224), dtype=np.uint8)
    grad = np.tile(np.linspace(0, 60, 224, dtype=np.uint8), (224, 1))
    gray = cv2.add(base, grad)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def run_smoke_test() -> None:
    print("=== SMOKE TEST (synthetic images — plumbing check only, no accuracy claim) ===")
    model = get_xray_model()
    if model is None:
        print("ERROR: xray model not loaded. Boot the sidecar once to fetch weights.")
        sys.exit(1)

    rng = np.random.default_rng(0)
    evaluated = sorted({p for p in model.pathologies if p in XRAY_PATHOLOGIES})  # type: ignore
    per_path: dict[str, tuple[list[int], list[float]]] = {p: ([], []) for p in evaluated}

    n = 16
    for i in range(n):
        img = make_synthetic_xray(seed=i)
        scores = predict_pathology_scores(model, img)
        for p in evaluated:
            true = int(rng.integers(0, 2))  # random labels — plumbing only
            per_path[p][0].append(true)
            per_path[p][1].append(scores.get(p, 0.0))

    aucs = [a for p in evaluated if (a := auroc(*per_path[p])) is not None]
    print(f"  ran {n} synthetic images through {len(evaluated)} pathologies without error")
    print(f"  computed AUROC for {len(aucs)} pathologies (mean={np.mean(aucs):.3f} on random labels)")
    print("  [OK] harness runs end-to-end. Point --images-dir/--labels-csv at a real set for valid numbers.")


# ── Report ──────────────────────────────────────────────────────────────────────

def write_report(rows: list[tuple[str, float | None, int, int]], mean_auc: float,
                 model_name: str, dataset: str, n_images: int,
                 ms_per_image: float, out_path: Path) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# Chest X-ray Model Eval",
        "",
        f"**Date:** {now}  ",
        f"**Model:** `{model_name}` (TorchXRayVision DenseNet121-all, multi-label)  ",
        f"**Dataset:** {dataset}  ",
        f"**Images evaluated:** {n_images}  ",
        f"**Avg inference time:** {ms_per_image:.0f} ms/image (CPU)  ",
        "",
        f"## Per-pathology AUROC  (mean = **{mean_auc:.3f}**)",
        "",
        "| Pathology | AUROC | Pos | Neg |",
        "|---|---|---|---|",
    ]
    for name, auc_val, pos, neg in rows:
        auc_str = "n/a" if auc_val is None else f"{auc_val:.3f}"
        lines.append(f"| {name} | {auc_str} | {pos} | {neg} |")
    lines += [
        "",
        "## Notes",
        "",
        "- AUROC needs both positives and negatives for a pathology; 'n/a' = one class absent in this set.",
        "- TorchXRayVision DenseNet121-all is Apache 2.0; reported mean AUROC ~0.80 across public sets.",
        "- Only pathologies present in both the dataset and the model's 18 outputs are scored.",
        "- None of these models are FDA/CE cleared. Eval run on CPU.",
    ]
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nResults written to: {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Eval chest X-ray model (multi-label AUROC)")
    parser.add_argument("--images-dir", help="Folder of chest X-rays (searched recursively)")
    parser.add_argument("--labels-csv", help="CSV: NIH 'Finding Labels' or per-pathology columns")
    parser.add_argument("--id-col", default=None, help="CSV image-id column (auto-detected if omitted)")
    parser.add_argument("--limit", type=int, default=0, help="Cap number of images (0 = all)")
    parser.add_argument("--out", default=str(BASE_DIR / "results_xray.md"))
    parser.add_argument("--smoke-test", action="store_true",
                        help="Run on synthetic images to verify the harness, then exit (writes no report)")
    args = parser.parse_args()

    if args.smoke_test:
        run_smoke_test()
        return

    if not args.images_dir or not args.labels_csv:
        parser.error("--images-dir and --labels-csv are required (or use --smoke-test)")

    images_dir = Path(args.images_dir)
    labels_csv = Path(args.labels_csv)
    if not images_dir.exists():
        print(f"ERROR: images dir not found: {images_dir}"); sys.exit(1)
    if not labels_csv.exists():
        print(f"ERROR: labels CSV not found: {labels_csv}"); sys.exit(1)

    print("Loading xray model...")
    model = get_xray_model()
    if model is None:
        print("ERROR: xray model not loaded.")
        sys.exit(1)
    model_name = "torchxrayvision-densenet121-all"
    print(f"  Model: {model_name}")

    print("Building eval set...")
    pairs, evaluated = build_eval_set(images_dir, labels_csv, model, args.id_col)
    if args.limit > 0:
        pairs = pairs[:args.limit]
        print(f"  [--limit {args.limit}] using first {len(pairs)} images")
    print(f"  {len(pairs)} images  ·  {len(evaluated)} pathologies scored")
    if not pairs:
        print("ERROR: no (image, label) pairs built — check id column and image folder.")
        sys.exit(1)

    print("Running inference...")
    per_path: dict[str, tuple[list[int], list[float]]] = {p: ([], []) for p in evaluated}
    errors = 0
    t0 = time.perf_counter()
    for i, (path, labels) in enumerate(pairs):
        img = cv2.imread(str(path))
        if img is None:
            errors += 1
            continue
        try:
            scores = predict_pathology_scores(model, img)
        except Exception as exc:
            print(f"  inference error on {path.name}: {exc}")
            errors += 1
            continue
        for p in evaluated:
            per_path[p][0].append(labels.get(p, 0))
            per_path[p][1].append(scores.get(p, 0.0))
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{len(pairs)}  elapsed {time.perf_counter()-t0:.0f}s", end="\r")
    elapsed = time.perf_counter() - t0
    print()

    n_eval = len(pairs) - errors
    if n_eval <= 0:
        print("ERROR: no images evaluated."); sys.exit(1)

    rows: list[tuple[str, float | None, int, int]] = []
    valid_aucs: list[float] = []
    for p in evaluated:
        y_true, y_score = per_path[p]
        a = auroc(y_true, y_score)
        pos = sum(y_true)
        neg = len(y_true) - pos
        rows.append((p, a, pos, neg))
        if a is not None:
            valid_aucs.append(a)
    mean_auc = float(np.mean(valid_aucs)) if valid_aucs else 0.0
    ms_per_image = elapsed * 1000 / n_eval

    print(f"\n=== Results ===")
    print(f"  Images evaluated : {n_eval}  (errors: {errors})")
    print(f"  Mean AUROC       : {mean_auc:.3f}  (over {len(valid_aucs)} scorable pathologies)")
    print(f"  Avg inference    : {ms_per_image:.0f} ms/image")
    print(f"\n  {'Pathology':<28} {'AUROC':>7}  {'Pos':>5} {'Neg':>5}")
    for name, a, pos, neg in rows:
        print(f"  {name:<28} {('n/a' if a is None else f'{a:.3f}'):>7}  {pos:>5} {neg:>5}")

    dataset_desc = f"{labels_csv.name} + {images_dir.name}/ ({n_eval} images)"
    write_report(rows, mean_auc, model_name, dataset_desc, n_eval, ms_per_image, Path(args.out))


if __name__ == "__main__":
    main()
