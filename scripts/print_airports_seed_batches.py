"""Apply airports seed batches to Supabase via stdin for manual/CI use."""
from __future__ import annotations

import glob
import os
import sys

batch_dir = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "supabase", "063_airports_seed_batches")
)

def main() -> int:
    files = sorted(glob.glob(os.path.join(batch_dir, "batch_[0-9][0-9].sql")))
    if not files:
        print("No batch files found. Run split_airports_seed.py first.", file=sys.stderr)
        return 1

    for path in files:
        with open(path, encoding="utf-8") as f:
            sql = f.read()
        print(f"-- FILE: {os.path.basename(path)} ({len(sql)} bytes)")
        print(sql)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
