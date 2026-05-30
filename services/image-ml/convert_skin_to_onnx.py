"""
Convert Skin_Disease_AI TF SavedModel → ONNX for ARM/CPU inference.

Run this script on ANY machine that has TensorFlow installed
(Linux x86, macOS, Google Colab, etc.) — NOT needed on ARM Windows.

Steps:
  1. Run this script on a machine with TF:
       pip install tensorflow tf2onnx
       python convert_skin_to_onnx.py

  2. Copy output file to this machine:
       services/image-ml/models/skin-xception.onnx

  3. Restart sidecar:
       python main.py

The sidecar will auto-detect and load the ONNX model (92% accuracy,
6 skin disease classes: acne, carcinoma, eczema, keratosis, millia, rosacea).

--- Google Colab quick start ---
Paste this in a Colab cell:

!pip install tf2onnx
import shutil, os
# Mount Drive or upload the model folder
# Then run:
!python -m tf2onnx.convert \\
  --saved-model services/image-ml/models/skin-xception \\
  --output services/image-ml/models/skin-xception.onnx \\
  --opset 13

# Verify:
import onnxruntime as ort
sess = ort.InferenceSession("services/image-ml/models/skin-xception.onnx")
print("Input:", sess.get_inputs()[0].shape)   # expect [None, 299, 299, 3]
print("Output:", sess.get_outputs()[0].shape) # expect [None, 6]
"""

import subprocess
import sys
from pathlib import Path

SAVED_MODEL = Path(__file__).parent / "models" / "skin-xception"
OUTPUT_ONNX = Path(__file__).parent / "models" / "skin-xception.onnx"


def main():
    if not SAVED_MODEL.exists():
        print(f"ERROR: SavedModel not found at {SAVED_MODEL}")
        print("Clone Skin_Disease_AI repo and copy model folder:")
        print("  git clone https://github.com/NadavIs56/Skin_Disease_AI /tmp/skin")
        print(f"  cp -r /tmp/skin/model {SAVED_MODEL}")
        sys.exit(1)

    if OUTPUT_ONNX.exists():
        print(f"ONNX already exists: {OUTPUT_ONNX} ({OUTPUT_ONNX.stat().st_size // 1024} KB)")
        print("Delete it first if you want to reconvert.")
        sys.exit(0)

    print(f"Converting {SAVED_MODEL} → {OUTPUT_ONNX}")
    print("This requires TensorFlow and tf2onnx.")

    try:
        import tensorflow as tf  # noqa: F401
        import tf2onnx  # noqa: F401
    except ImportError:
        print("ERROR: pip install tensorflow tf2onnx")
        sys.exit(1)

    result = subprocess.run([
        sys.executable, "-m", "tf2onnx.convert",
        "--saved-model", str(SAVED_MODEL),
        "--output", str(OUTPUT_ONNX),
        "--opset", "13",
    ], capture_output=True, text=True)

    print(result.stdout)
    if result.returncode != 0:
        print("STDERR:", result.stderr)
        sys.exit(1)

    print(f"\nSaved: {OUTPUT_ONNX} ({OUTPUT_ONNX.stat().st_size // 1024 // 1024} MB)")

    # Quick verify
    try:
        import onnxruntime as ort
        sess = ort.InferenceSession(str(OUTPUT_ONNX), providers=["CPUExecutionProvider"])
        print(f"Input shape:  {sess.get_inputs()[0].shape}")
        print(f"Output shape: {sess.get_outputs()[0].shape}")
        print("\nConversion successful. Copy skin-xception.onnx to this machine and restart the sidecar.")
    except Exception as e:
        print(f"Verify failed: {e}")


if __name__ == "__main__":
    main()
