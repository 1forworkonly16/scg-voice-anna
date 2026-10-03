"""Download the VZD cadastre open data needed for building characteristics (CC BY 4.0, data.gov.lv).

    python data/buildings/sources/fetch_vzd.py --cache-dir <dir>            # download (resumable by size check)
    python data/buildings/sources/fetch_vzd.py --cache-dir <dir> --peek     # print XSD element names + XML head

Downloads ONLY: building.zip, premisegroup.zip, address.zip and the XSD schemas ZIP. It never fetches property,
valuation or any ownership data. ZIPs go to --cache-dir (default: <tmp>/scg_vzd_cache), never into the repo.
URLs come from sources/vzd_probe.json (run probe_vzd.py first).
"""
import json
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
UA = "scg-anna-voice-demo-dataset/1.0 (one-off demo dataset build; stdlib urllib; non-commercial)"
WANT = ("building.zip", "premisegroup.zip", "address.zip", "ad_xsdshemas")


def cache_dir():
    if "--cache-dir" in sys.argv:
        return Path(sys.argv[sys.argv.index("--cache-dir") + 1])
    return Path(tempfile.gettempdir()) / "scg_vzd_cache"


def main():
    cdir = cache_dir()
    cdir.mkdir(parents=True, exist_ok=True)
    probe = json.loads((HERE / "vzd_probe.json").read_text(encoding="utf-8"))
    for r in probe["resources"]:
        fn = r["url"].rsplit("/", 1)[-1]
        if not any(w in fn for w in WANT) or "wnership" in fn:
            continue
        dest = cdir / fn
        if dest.exists() and zipfile.is_zipfile(dest):
            print("cached", dest.name, dest.stat().st_size)
            continue
        print("downloading", fn, r.get("size"))
        req = urllib.request.Request(r["url"], headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=600) as resp, open(dest, "wb") as f:
            while True:
                chunk = resp.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        print("saved", dest, dest.stat().st_size)
    if "--peek" in sys.argv:
        for z in sorted(cdir.glob("*.zip")):
            with zipfile.ZipFile(z) as zf:
                names = zf.namelist()
                print("==", z.name, names[:10])
                for n in names[:3]:
                    with zf.open(n) as fh:
                        head = fh.read(2500 if n.lower().endswith(".xml") else 30000).decode("utf-8", "replace")
                    print("--", n)
                    print(head if n.lower().endswith(".xml") else "\n".join(
                        ln.strip() for ln in head.splitlines() if "element name" in ln or "simpleType name" in ln))
    return 0


if __name__ == "__main__":
    sys.exit(main())
