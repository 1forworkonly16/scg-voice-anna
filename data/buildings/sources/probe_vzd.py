"""Time-boxed probe of the VZD cadastre open data (data.gov.lv CKAN). Metadata only: no ZIP is downloaded.

    python data/buildings/sources/probe_vzd.py

Writes sources/vzd_probe.json (resource names, formats, sizes, last-modified, licence). Never touches
Ownership.ZIP. The probe exists to record why OSM was used for this 30-record seed.
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.dont_write_bytecode = True
OUT = Path(__file__).resolve().parent / "vzd_probe.json"
URL = "https://data.gov.lv/dati/api/3/action/package_show?id=kadastra-informacijas-sistemas-atvertie-dati"
UA = "scg-anna-voice-demo-dataset/1.0 (one-off demo dataset build; metadata probe only)"


def main():
    if OUT.exists() and "--refresh" not in sys.argv:
        print("cache present:", OUT)
        return 0
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            res = json.loads(r.read().decode("utf-8"))["result"]
        out = {"url": URL, "license": res.get("license_title"), "metadata_modified": res.get("metadata_modified"),
               "resources": [{k: x.get(k) for k in ("name", "format", "size", "last_modified", "url")}
                             for x in res.get("resources", []) if "wnership" not in (x.get("name") or "") + (x.get("url") or "")]}
        status = "ok"
    except (urllib.error.URLError, OSError, ValueError, KeyError) as e:
        out, status = {"url": URL, "error": repr(e)}, "failed"
    OUT.write_text(json.dumps(out, ensure_ascii=False, sort_keys=True, indent=1) + "\n", encoding="utf-8")
    print(status, "->", OUT)
    return 0 if status == "ok" else 2


if __name__ == "__main__":
    sys.exit(main())
