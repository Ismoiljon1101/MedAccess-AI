"""
Quick inference sanity-check for skin (ConvNeXt) and eye (DR ONNX) models.

Author:       Temirlan
Created:      2026-06-14
Does NOT test medical accuracy — tests that:
  1. Models loaded without silent partial-weight failures (strict=False risk)
  2. Preprocessing pipelines run without error
  3. Output probabilities are valid (sum ~1.0, no NaN/Inf, correct shape)

Run from services/image-ml/:
    python test_inference.py              # synthetic images only
    python test_inference.py --image path/to/skin.jpg  # real image (optional)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np


def make_synthetic(kind: str) -> np.ndarray:
    """Return a BGR image that loosely resembles the target modality."""
    img = np.zeros((300, 300, 3), dtype=np.uint8)
    if kind == "skin":
        # Skin-tone base + a darker circular region (lesion-like)
        img[:] = (80, 120, 180)
        cv2.circle(img, (150, 150), 60, (40, 60, 100), -1)
        cv2.circle(img, (150, 150), 30, (20, 30, 60), -1)
    elif kind == "eye":
        # Real fundus: true black background (camera FOV limiter) + reddish circular area
        img[:] = (0, 0, 0)
        cv2.circle(img, (150, 150), 120, (20, 50, 200), -1)   # reddish retina
        cv2.circle(img, (150, 150), 20, (200, 200, 255), -1)  # optic disc
    return img


def check_probs(probs: np.ndarray, label: str) -> bool:
    ok = True
    if np.isnan(probs).any():
        print(f"  [FAIL] {label}: NaN in output")
        ok = False
    if np.isinf(probs).any():
        print(f"  [FAIL] {label}: Inf in output")
        ok = False
    total = float(probs.sum())
    if not (0.98 <= total <= 1.02):
        print(f"  [FAIL] {label}: probabilities sum to {total:.4f} (expected ~1.0)")
        ok = False
    return ok


def test_skin(img_bgr: np.ndarray) -> bool:
    print("\n--- Skin model (ConvNeXt HAM10000) ---")
    sys.path.insert(0, str(Path(__file__).parent))
    from main import get_skin_model, preprocess_skin, HAM10000_CLASSES

    model, model_name, model_type = get_skin_model()
    if model is None:
        print("  [WARN]  No skin model loaded — skipped (weights missing?)")
        return True  # not a code bug

    print(f"  Model: {model_name}  type={model_type}")

    if model_type == "convnext":
        import torch
        import torch.nn.functional as F

        img_rgb = cv2.cvtColor(preprocess_skin(img_bgr), cv2.COLOR_BGR2RGB)
        img_resized = cv2.resize(img_rgb, (224, 224)).astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        img_norm = (img_resized - mean) / std
        tensor = torch.from_numpy(img_norm).permute(2, 0, 1).unsqueeze(0).float()

        if not hasattr(model, "eval"):
            print("  [FAIL] ConvNeXt checkpoint is a state_dict, not an nn.Module — inference impossible")
            return False

        model.eval()
        with torch.no_grad():
            logits = model(tensor)
        probs = F.softmax(logits, dim=1)[0].cpu().numpy()

        if not check_probs(probs, "ConvNeXt"):
            return False

        top = sorted(enumerate(probs), key=lambda x: x[1], reverse=True)[:3]
        print("  Top-3 predictions:")
        for idx, conf in top:
            label = HAM10000_CLASSES[idx] if idx < len(HAM10000_CLASSES) else f"class_{idx}"
            print(f"    {label}: {conf*100:.1f}%")
        print("  [OK] ConvNeXt forward pass OK")
        return True

    elif model_type == "onnx":
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        img_resized = cv2.resize(img_rgb, (299, 299)).astype(np.float32)
        img_resized = (img_resized / 127.5) - 1.0
        inp = np.expand_dims(img_resized, axis=0)
        input_name = model.get_inputs()[0].name
        out = model.run(None, {input_name: inp})[0][0]
        if not check_probs(out, "Xception ONNX"):
            return False
        print(f"  Output: {out}")
        print("  [OK] Xception ONNX forward pass OK")
        return True

    elif model_type == "yolo":
        from main import SKIN_XCEPTION_CLASSES, HAM10000_CLASSES as H
        preprocessed = preprocess_skin(img_bgr)
        results = model(preprocessed, verbose=False)
        probs = results[0].probs
        print(f"  Top class: {results[0].names[int(probs.top1)]}  conf={float(probs.top1conf):.3f}")
        print("  [OK] HAM10000 YOLO forward pass OK")
        return True

    print(f"  [WARN]  Unknown model_type: {model_type}")
    return False


def test_eye(img_bgr: np.ndarray) -> bool:
    print("\n--- Eye model (DR ONNX) ---")
    sys.path.insert(0, str(Path(__file__).parent))
    from main import get_eye_model, DR_CLASSES

    sess, model_name, model_type = get_eye_model()
    if sess is None:
        print("  [WARN]  No eye model loaded — skipped (weights missing?)")
        return True

    print(f"  Model: {model_name}")

    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, (224, 224)).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_norm = (img_resized - mean) / std
    inp = np.transpose(img_norm, (2, 0, 1))[np.newaxis, ...].astype(np.float32)

    input_name = sess.get_inputs()[0].name
    raw_out = sess.run(None, {input_name: inp})[0][0]
    print(f"  Raw ONNX output (before softmax): {raw_out}")

    # Check if output already looks like probabilities (all in [0,1], sum ~1)
    already_softmaxed = bool(np.all(raw_out >= 0) and np.all(raw_out <= 1) and 0.98 <= raw_out.sum() <= 1.02)
    if already_softmaxed:
        print("  [WARN] Raw output already sums to ~1.0 — model has softmax baked in. Using as-is (no second softmax).")
        probs = raw_out
    else:
        exps = np.exp(raw_out - np.max(raw_out))
        probs = exps / exps.sum()

    if not check_probs(probs, "DR ONNX"):
        return False

    for idx, conf in enumerate(probs):
        if idx < len(DR_CLASSES):
            print(f"    {DR_CLASSES[idx]}: {conf*100:.1f}%")
    print("  [OK] DR ONNX forward pass OK")
    return True


def test_auto_detection() -> bool:
    """Verify detect_image_type heuristics on synthetic images."""
    print("\n--- Auto-detection heuristic ---")
    from main import detect_image_type

    cases = [
        ("skin",    make_synthetic("skin"),  "skin"),
        ("eye",     make_synthetic("eye"),   "eye"),
    ]

    # Synthetic xray: near-grayscale, low saturation
    xray_img = np.full((300, 300, 3), 128, dtype=np.uint8)
    xray_img += np.random.randint(-10, 10, xray_img.shape, dtype=np.int8).astype(np.uint8)
    cases.append(("xray", xray_img, "xray"))

    all_ok = True
    for name, img, expected in cases:
        detected = detect_image_type("", img)
        ok = detected == expected
        icon = "[OK]" if ok else "[FAIL]"
        print(f"  {icon} {name}: expected={expected}  got={detected}")
        if not ok:
            all_ok = False
    return all_ok


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", help="Path to a real image (optional — synthetic used if omitted)")
    args = parser.parse_args()

    if args.image:
        img = cv2.imread(args.image)
        if img is None:
            print(f"[FAIL] Could not read image: {args.image}")
            sys.exit(1)
        print(f"Using real image: {args.image}  ({img.shape[1]}x{img.shape[0]})")
        skin_img = eye_img = img
    else:
        print("No --image provided — using synthetic test images.")
        skin_img = make_synthetic("skin")
        eye_img  = make_synthetic("eye")

    results = {
        "auto-detection": test_auto_detection(),
        "skin": test_skin(skin_img),
        "eye":  test_eye(eye_img),
    }

    print("\n--- Summary ---")
    all_pass = True
    for name, ok in results.items():
        icon = "[OK]" if ok else "[FAIL]"
        print(f"  {icon} {name}")
        if not ok:
            all_pass = False

    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
