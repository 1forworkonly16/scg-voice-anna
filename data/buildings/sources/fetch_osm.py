"""Fetch apartment-building candidates from OpenStreetMap (Overpass API), one batched query.

    python data/buildings/sources/fetch_osm.py            # uses the cache if osm_raw.json exists
    python data/buildings/sources/fetch_osm.py --refresh  # re-download

Output: sources/osm_raw.json = {"_meta": {...}, "response": <raw Overpass JSON>}.
Only building geometry-level tags are requested (no personal data). OSM data (c) OpenStreetMap
contributors, ODbL. Stdlib only.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
RAW = HERE / "osm_raw.json"
ENDPOINTS = ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter")
UA = "scg-anna-voice-demo-dataset/1.0 (one-off demo dataset build; stdlib urllib; non-commercial)"

DISTRICTS = ("Purvciems", "Imanta", "Pļavnieki", "Ziepniekkalns")

# Blocks are separated by `make marker` elements so one response can be split per district.
QUERY = """[out:json][timeout:180];
area["name"="Rīga"]["boundary"="administrative"]["admin_level"="5"]->.riga;
""" + "".join(
    f"""area["name"="{d}"]["boundary"="administrative"](area.riga)->.d{i};
make marker name="{d}";
out;
way(area.d{i})["building"="apartments"]["building:levels"]["addr:street"]["addr:housenumber"];
out tags center;
""" for i, d in enumerate(DISTRICTS)
) + """make marker name="SCG";
out;
way(area.riga)["building"]["addr:housenumber"]["addr:street"~"^(Ilūkstes|Tirzes|Tirzas|Velkoņu|Balvu|Kuldīgas|Jūrmalas) (iela|gatve)$"];
out tags center;
"""


def main():
    refresh = "--refresh" in sys.argv
    if RAW.exists() and not refresh:
        print(f"cache present: {RAW} (use --refresh to re-download)")
        return 0
    body = urllib.parse.urlencode({"data": QUERY}).encode("utf-8")
    last = None
    for ep in ENDPOINTS:
        req = urllib.request.Request(ep, data=body, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                resp = json.loads(r.read().decode("utf-8"))
            meta = {"endpoint": ep, "retrieved": time.strftime("%Y-%m-%d", time.gmtime()), "user_agent": UA,
                    "query": QUERY, "license": "ODbL, (c) OpenStreetMap contributors"}
            RAW.write_text(json.dumps({"_meta": meta, "response": resp}, ensure_ascii=False, sort_keys=True,
                                      indent=1) + "\n", encoding="utf-8")
            print(f"saved {RAW} from {ep}: {len(resp.get('elements', []))} elements")
            return 0
        except (urllib.error.URLError, OSError, ValueError) as e:
            last = f"{ep}: {e!r}"
            print("FAILED", last, file=sys.stderr)
            time.sleep(5)
    print("all endpoints failed; fields stay null. last error:", last, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
