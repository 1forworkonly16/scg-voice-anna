#!/usr/bin/env python3
"""Hash manifest for the read-only INFO folder.

  python scripts/info-hash.py --write   write docs/info_manifest.sha256
  python scripts/info-hash.py --check   compare; exit 0 if identical, 1 otherwise

Skips __pycache__ and .claude directories and *.pyc files. Run with PYTHONUTF8=1.
"""
import sys

sys.dont_write_bytecode = True

import hashlib
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
DV = HERE.parent
INFO = (DV.parent / "info").resolve()
MANIFEST = DV / "docs" / "info_manifest.sha256"
SKIP_DIRS = {"__pycache__", ".claude"}


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def scan():
    result = {}
    for root, dirs, files in os.walk(INFO):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if name.endswith(".pyc"):
                continue
            p = Path(root) / name
            rel = p.relative_to(INFO).as_posix()
            result[rel] = sha256_of(p)
    return dict(sorted(result.items()))


def read_manifest():
    out = {}
    with open(MANIFEST, "r", encoding="utf-8", newline="") as f:
        for line in f.read().splitlines():
            if not line.strip():
                continue
            digest, _, rest = line.partition("  ")
            out[rest] = digest
    return out


def main(argv):
    if len(argv) != 2 or argv[1] not in ("--write", "--check"):
        print(__doc__)
        return 2
    if not INFO.is_dir():
        print("INFO folder not found: %s" % INFO)
        return 2
    current = scan()
    if argv[1] == "--write":
        MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        with open(MANIFEST, "w", encoding="utf-8", newline="\n") as f:
            for rel, digest in current.items():
                f.write("%s  %s\n" % (digest, rel))
        print("wrote %s (%d files)" % (MANIFEST.relative_to(DV).as_posix(), len(current)))
        return 0
    if not MANIFEST.is_file():
        print("manifest missing: run --write first")
        return 1
    saved = read_manifest()
    added = sorted(set(current) - set(saved))
    removed = sorted(set(saved) - set(current))
    changed = sorted(p for p in current if p in saved and current[p] != saved[p])
    if not (added or removed or changed):
        print("INFO unchanged (%d files)" % len(current))
        return 0
    for label, items in (("added", added), ("removed", removed), ("changed", changed)):
        for p in items:
            print("%s: %s" % (label, p))
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
