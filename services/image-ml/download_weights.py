"""
Download pre-trained model weights for MedAccess image-ml sidecar.

Run: python download_weights.py
     python download_weights.py --force   # re-download even if present

All managed models are defined in model_manager.py (single source of truth).
This script is a convenience wrapper around model_manager.ensure_all().
"""

import argparse
import sys
from model_manager import ensure_all, model_status, MODELS


def main() -> None:
    parser = argparse.ArgumentParser(description="Download MedAccess sidecar model weights")
    parser.add_argument("--force", action="store_true", help="Re-download even if already present")
    args = parser.parse_args()

    print("=== MedAccess weight downloader ===\n")
    print(f"Managed models ({len(MODELS)}):")
    for m in MODELS:
        status = "present" if m.is_present() else "missing"
        print(f"  {m.key}  ({m.filename})  [{status}]")
    print()

    results = ensure_all(force=args.force)

    print("\n=== Result ===")
    all_ok = True
    for key, present in results.items():
        icon = "✓" if present else "✗"
        print(f"  {icon} {key}  {'OK' if present else 'FAILED — sidecar will return skipped:true for this modality'}")
        if not present:
            all_ok = False

    status = model_status()
    missing = [k for k, v in status.items() if not v["present"]]
    if missing:
        print(f"\n⚠  Missing models: {', '.join(missing)}")
        print("   Those modalities will return skipped:true until weights are added.")
        sys.exit(1)

    print("\nDone. Start sidecar: python main.py")


if __name__ == "__main__":
    main()
