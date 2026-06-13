"""
Diabetic-retinopathy eye model eval harness — MedAccess image-ml sidecar.

Author:  Temirlan
Created: 2026-06-14

Evaluates the loaded DR model (BlairFerg ONNX, binary: no-DR vs DR) against a
folder of fundus images + a labels CSV. Dataset-agnostic on purpose — there is
no clean no-auth public DR set, so this points at whatever you obtain locally:

  - APTOS 2019      (Kaggle: aptos2019-blindness-detection) — cols id_code,diagnosis
  - EyePACS         (HF: bumbledeep/eyepacs)                — cols image,level
  - Messidor-2 / IDRiD / any folder + CSV with an id col and a 0-4 grade col

Grades are binarised to match the model's two classes:
  - default        : grade >= 1  -> DR positive   (any retinopathy)
  - --referable    : grade >= 2  -> DR positive   (referable DR, clinical standard)

Metrics (computed by hand — no sklearn dependency):
  accuracy · sensitivity (DR recall) · specificity · PPV · NPV · AUROC · 2x2 confusion

Usage:
    # Real dataset (APTOS layout):
    python eval/eye_eval.py --images-dir data/aptos/images --labels-csv data/aptos/train.csv

    # EyePACS columns + referable threshold + cap at 500 images:
    python eval/eye_eval.py --images-dir data/eyepacs --labels-csv data/eyepacs/labels.csv \\
        --id-col image --label-col level --referable --limit 500

    # No dataset? Prove the harness runs end-to-end on synthetic images:
    python eval/eye_eval.py --smoke-test

Results written to eval/results_eye.md (real runs only — smoke test never writes).
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

from main import DR_CLASSES, get_eye_model  # noqa: E402

BASE_DIR = Path(__file__).parent

# Common column names across public DR datasets, tried in order when not given.
ID_COL_CANDIDATES    = ["id_code", "image", "image_id", "id", "filename", "name"]
LABEL_COL_CANDIDATES = ["diagnosis", "level", "label", "grade", "dr", "retinopathy_grade"]

IMG_EXTS = (".jpg", ".jpeg", ".png")


# ── Inference (replicates main.py eye path exactly) ─────────────────────────────

def predict_dr_prob(sess: object, img_bgr: np.ndarray) -> float:
    """Return P(diabetic retinopathy) for one fundus image — mirrors main.py."""
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, (224, 224)).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_norm = (img_resized - mean) / std
    inp = np.transpose(img_norm, (2, 0, 1))[np.newaxis, ...].astype(np.float32)
    input_name = sess.get_inputs()[0].name  # type: ignore
    out = sess.run(None, {input_name: inp})[0][0]  # type: ignore
    # BlairFerg ONNX bakes softmax in — don't apply it twice (see main.py).
    already_prob = bool(np.all(out >= 0) and np.all(out <= 1) and 0.98 <= float(out.sum()) <= 1.02)
    if already_prob:
        probs = out
    else:
        exps = np.exp(out - np.max(out))
        probs = exps / exps.sum()
    return float(probs[1])  # index 1 = "diabetic retinopathy detected"


# ── Metrics (no sklearn) ────────────────────────────────────────────────────────

def binary_metrics(y_true: list[int], y_score: list[float], threshold: float = 0.5) -> dict:
    y_pred = [1 if s >= threshold else 0 for s in y_score]
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    n = tp + tn + fp + fn
    return {
        "tp": tp, "tn": tn, "fp": fp, "fn": fn, "n": n,
        "accuracy":    (tp + tn) / n if n else 0.0,
        "sensitivity": tp / (tp + fn) if (tp + fn) else 0.0,  # DR recall — the one that matters
        "specificity": tn / (tn + fp) if (tn + fp) else 0.0,
        "ppv":         tp / (tp + fp) if (tp + fp) else 0.0,
        "npv":         tn / (tn + fn) if (tn + fn) else 0.0,
    }


def auroc(y_true: list[int], y_score: list[float]) -> float | None:
    """Mann-Whitney U estimate of AUROC, with average-rank tie handling."""
    n_pos = sum(y_true)
    n_neg = len(y_true) - n_pos
    if n_pos == 0 or n_neg == 0:
        return None  # AUROC undefined without both classes present
    paired = sorted(zip(y_score, y_true), key=lambda x: x[0])  # ascending by score
    ranks = [0.0] * len(paired)
    i = 0
    while i < len(paired):
        j = i
        while j < len(paired) and paired[j][0] == paired[i][0]:
            j += 1
        avg_rank = (i + 1 + j) / 2.0  # mean of 1-indexed ranks i+1..j for ties
        for k in range(i, j):
            ranks[k] = avg_rank
        i = j
    sum_pos_ranks = sum(r for r, (_, t) in zip(ranks, paired) if t == 1)
    return (sum_pos_ranks - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)


# ── Dataset loading ─────────────────────────────────────────────────────────────

def _pick_col(columns: list[str], given: str | None, candidates: list[str], kind: str) -> str:
    if given:
        if given not in columns:
            print(f"ERROR: --{kind}-col '{given}' not in CSV columns: {columns}")
            sys.exit(1)
        return given
    for c in candidates:
        if c in columns:
            return c
    print(f"ERROR: could not auto-detect {kind} column. Pass --{kind}-col. CSV columns: {columns}")
    sys.exit(1)


def build_eval_set(
    images_dir: Path, labels_csv: Path,
    id_col: str | None, label_col: str | None, positive_from: int,
) -> list[tuple[Path, int]]:
    """Return (image_path, binary_label) pairs. binary_label: 1 = DR, 0 = no DR."""
    import pandas as pd  # available in venv; eval-only, not a service dep

    df = pd.read_csv(labels_csv)
    cols = list(df.columns)
    id_c = _pick_col(cols, id_col, ID_COL_CANDIDATES, "id")
    lbl_c = _pick_col(cols, label_col, LABEL_COL_CANDIDATES, "label")
    print(f"  using id column '{id_c}', label column '{lbl_c}'")

    # Map image stem -> path (recursive; handles nested dataset folders)
    stem_to_path: dict[str, Path] = {}
    for ext in IMG_EXTS:
        for p in images_dir.rglob(f"*{ext}"):
            stem_to_path[p.stem] = p
    if not stem_to_path:
        print(f"ERROR: no images ({', '.join(IMG_EXTS)}) found under {images_dir}")
        sys.exit(1)

    pairs: list[tuple[Path, int]] = []
    missing = 0
    for _, row in df.iterrows():
        raw_id = str(row[id_c]).strip()
        stem = Path(raw_id).stem  # tolerate ids with or without extension
        path = stem_to_path.get(stem)
        if path is None:
            missing += 1
            continue
        try:
            grade = int(float(row[lbl_c]))
        except (ValueError, TypeError):
            continue
        pairs.append((path, 1 if grade >= positive_from else 0))

    if missing:
        print(f"  note: {missing} CSV rows had no matching image file (skipped)")
    return pairs


# ── Synthetic smoke test ────────────────────────────────────────────────────────

def make_synthetic_fundus(dr_positive: bool, seed: int) -> np.ndarray:
    """A crude fundus-ish image: black FOV, red retina disc, optic-disc blob.
    DR-positive ones get scattered bright 'exudate' dots — purely to exercise the
    pipeline, NOT to look clinically real."""
    rng = np.random.default_rng(seed)
    img = np.zeros((224, 224, 3), dtype=np.uint8)  # black background (camera FOV)
    cv2.circle(img, (112, 112), 100, (40, 40, 170), -1)        # red retina (BGR)
    cv2.circle(img, (150, 100), 18, (60, 120, 200), -1)        # optic disc
    if dr_positive:
        for _ in range(rng.integers(8, 20)):
            x, y = int(rng.integers(30, 194)), int(rng.integers(30, 194))
            cv2.circle(img, (x, y), int(rng.integers(1, 4)), (180, 230, 240), -1)
    return img


def run_smoke_test() -> None:
    print("=== SMOKE TEST (synthetic images — plumbing check only, no accuracy claim) ===")
    sess, model_name, _ = get_eye_model()
    if sess is None:
        print("ERROR: eye DR model not loaded. Boot sidecar once to auto-download.")
        sys.exit(1)

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        rows = ["id_code,diagnosis"]
        for i in range(20):
            positive = i % 2 == 0
            img = make_synthetic_fundus(positive, seed=i)
            cv2.imwrite(str(tmp / f"img_{i:02d}.png"), img)
            rows.append(f"img_{i:02d},{2 if positive else 0}")
        (tmp / "labels.csv").write_text("\n".join(rows), encoding="utf-8")

        pairs = build_eval_set(tmp, tmp / "labels.csv", None, None, positive_from=1)
        y_true, y_score = [], []
        for path, label in pairs:
            img = cv2.imread(str(path))
            y_true.append(label)
            y_score.append(predict_dr_prob(sess, img))

    m = binary_metrics(y_true, y_score)
    auc = auroc(y_true, y_score)
    print(f"  model: {model_name}")
    print(f"  ran on {m['n']} synthetic images without error")
    print(f"  accuracy={m['accuracy']*100:.0f}%  sens={m['sensitivity']*100:.0f}%  "
          f"spec={m['specificity']*100:.0f}%  AUROC={auc if auc is None else round(auc,3)}")
    print("  [OK] harness runs end-to-end. Point --images-dir/--labels-csv at a real set for valid numbers.")


# ── Report ──────────────────────────────────────────────────────────────────────

def write_report(m: dict, auc: float | None, model_name: str,
                 dataset: str, convention: str, ms_per_image: float, out_path: Path) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    auc_str = "n/a (only one class present)" if auc is None else f"**{auc:.3f}**"
    lines = [
        "# Eye DR Model Eval",
        "",
        f"**Date:** {now}  ",
        f"**Model:** `{model_name}` (binary ONNX)  ",
        f"**Dataset:** {dataset}  ",
        f"**Positive class:** {convention}  ",
        f"**Images evaluated:** {m['n']}  ",
        f"**Avg inference time:** {ms_per_image:.0f} ms/image (CPU)  ",
        "",
        "## Overall (threshold = 0.5)",
        "",
        "| Metric | Score |",
        "|---|---|",
        f"| Accuracy | {m['accuracy']*100:.1f}% |",
        f"| Sensitivity (DR recall) | {m['sensitivity']*100:.1f}% |",
        f"| Specificity | {m['specificity']*100:.1f}% |",
        f"| PPV (precision) | {m['ppv']*100:.1f}% |",
        f"| NPV | {m['npv']*100:.1f}% |",
        f"| AUROC | {auc_str} |",
        "",
        "## Confusion matrix",
        "",
        "| | Pred no-DR | Pred DR |",
        "|---|---|---|",
        f"| **True no-DR** | {m['tn']} | {m['fp']} |",
        f"| **True DR** | {m['fn']} | {m['tp']} |",
        "",
        "## Notes",
        "",
        "- BlairFerg DR ONNX is an open-weight community checkpoint — not FDA/CE cleared.",
        "- Sensitivity is the headline metric for screening: a missed DR case is the costly error.",
        "- Eval run on CPU.",
    ]
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nResults written to: {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Eval DR eye model on a fundus dataset")
    parser.add_argument("--images-dir", help="Folder of fundus images (searched recursively)")
    parser.add_argument("--labels-csv", help="CSV with an id column and a 0-4 grade column")
    parser.add_argument("--id-col", default=None, help="CSV image-id column (auto-detected if omitted)")
    parser.add_argument("--label-col", default=None, help="CSV grade column (auto-detected if omitted)")
    parser.add_argument("--referable", action="store_true",
                        help="Positive = grade >= 2 (referable DR). Default: grade >= 1 (any DR).")
    parser.add_argument("--limit", type=int, default=0, help="Cap number of images (0 = all)")
    parser.add_argument("--out", default=str(BASE_DIR / "results_eye.md"))
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

    positive_from = 2 if args.referable else 1
    convention = ("referable DR (grade >= 2)" if args.referable else "any DR (grade >= 1)")

    print("Loading eye DR model...")
    sess, model_name, _ = get_eye_model()
    if sess is None:
        print("ERROR: eye DR model not loaded. Boot the sidecar once to auto-download.")
        sys.exit(1)
    print(f"  Model: {model_name}")

    print("Building eval set...")
    pairs = build_eval_set(images_dir, labels_csv, args.id_col, args.label_col, positive_from)
    if args.limit > 0:
        pairs = pairs[:args.limit]
        print(f"  [--limit {args.limit}] using first {len(pairs)} images")
    n_pos = sum(1 for _, l in pairs if l == 1)
    print(f"  {len(pairs)} images  ({n_pos} DR positive, {len(pairs) - n_pos} no-DR)  [{convention}]")
    if not pairs:
        print("ERROR: no (image, label) pairs built — check id/label columns and image folder.")
        sys.exit(1)

    print("Running inference...")
    y_true: list[int] = []
    y_score: list[float] = []
    errors = 0
    t0 = time.perf_counter()
    for i, (path, label) in enumerate(pairs):
        img = cv2.imread(str(path))
        if img is None:
            errors += 1
            continue
        try:
            y_score.append(predict_dr_prob(sess, img))
            y_true.append(label)
        except Exception as exc:
            print(f"  inference error on {path.name}: {exc}")
            errors += 1
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{len(pairs)}  elapsed {time.perf_counter()-t0:.0f}s", end="\r")
    elapsed = time.perf_counter() - t0
    print()

    if not y_true:
        print("ERROR: no images evaluated."); sys.exit(1)

    m = binary_metrics(y_true, y_score)
    auc = auroc(y_true, y_score)
    ms_per_image = elapsed * 1000 / len(y_true)

    print(f"\n=== Results ===")
    print(f"  Images evaluated : {m['n']}  (errors: {errors})")
    print(f"  Accuracy         : {m['accuracy']*100:.1f}%")
    print(f"  Sensitivity (DR) : {m['sensitivity']*100:.1f}%   <- screening headline")
    print(f"  Specificity      : {m['specificity']*100:.1f}%")
    print(f"  PPV / NPV        : {m['ppv']*100:.1f}% / {m['npv']*100:.1f}%")
    print(f"  AUROC            : {'n/a' if auc is None else f'{auc:.3f}'}")
    print(f"  Confusion        : TN={m['tn']} FP={m['fp']} FN={m['fn']} TP={m['tp']}")
    print(f"  Avg inference    : {ms_per_image:.0f} ms/image")

    dataset_desc = f"{labels_csv.name} + {images_dir.name}/ ({m['n']} images)"
    write_report(m, auc, model_name, dataset_desc, convention, ms_per_image, Path(args.out))


if __name__ == "__main__":
    main()
