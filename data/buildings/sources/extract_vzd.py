"""Stream the Riga (ATVK 0001000) part of the VZD cadastre open data and keep ONLY the buildings we need.

    python data/buildings/sources/extract_vzd.py --cache-dir <dir>

Inputs : <cache-dir>/{address,building,premisegroup}.zip (see fetch_vzd.py) and sources/osm_raw.json.
Output : sources/vzd_extract.json, a small file keyed by VARIS address code.
Join   : OSM `ref:LV:addr` == cadastre Building/VARISCode (or Address/ARCode of a BUILDING object), plus a
         street + house join for the six SCG addresses.
Kept per building: cadastre nr, VARIS code, use-kind id, above/below-ground floors, exploitation year, wall
material text, number of apartment premise groups (use kind 1122) and of other premise groups.
Building characteristics only: Ownership data is never read. Stdlib only (iterparse, streaming).
"""
import json
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
NS = "{http://ivis.eps.gov.lv/XMLSchemas/100007/CadastreRegistry/v1-0}"
ATVK_PREFIX = "0001000_"  # Riga
# SCG's blog writes "Tirzes iela"; the official register spells the street "Tirzas iela".
SCG_ADDRS = {("Ilūkstes iela", "16"), ("Tirzas iela", "3 k-2"), ("Velkoņu iela", "2"), ("Balvu iela", "15"),
             ("Kuldīgas iela", "15"), ("Jūrmalas gatve", "59")}


def cache_dir():
    if "--cache-dir" in sys.argv:
        return Path(sys.argv[sys.argv.index("--cache-dir") + 1])
    return Path(tempfile.gettempdir()) / "scg_vzd_cache"


def iter_items(zpath, item_tag):
    """Yield (prepared_date, element) for each item of the Riga XML inside the ZIP, clearing as we go."""
    with zipfile.ZipFile(zpath) as z:
        name = next(i.filename for i in z.infolist() if i.filename.endswith(".xml") and "/" + ATVK_PREFIX in i.filename)
        with z.open(name) as f:
            prepared = None
            for ev, el in ET.iterparse(f, events=("end",)):
                if el.tag == NS + "PreparedDate":
                    prepared = el.text
                elif el.tag == NS + item_tag:
                    yield name, prepared, el
                    el.clear()


def text(el, path):
    x = el.find(path)
    return None if x is None or x.text is None or not x.text.strip() else x.text.strip()


def main():
    cdir = cache_dir()
    osm = json.loads((HERE / "osm_raw.json").read_text(encoding="utf-8"))
    ways = [e for e in osm["response"]["elements"] if e["type"] == "way"]
    want_varis = {w["tags"]["ref:LV:addr"] for w in ways if "ref:LV:addr" in w["tags"]}
    meta = {}

    # 1) Address pass: BUILDING objects whose ARCode is wanted, or one of the SCG street+house pairs.
    cad_by_varis, scg_hits = {}, {}
    for name, prepared, el in iter_items(cdir / "address.zip", "AddressItemData"):
        meta["address"] = f"{name.split('/')[0]}.zip@{prepared}"
        ad = el.find(NS + "AddressData")
        rel = el.find(NS + "ObjectRelation")
        if ad is None or rel is None or text(rel, NS + "ObjectType") != "BUILDING":
            continue
        ar, street, house = text(ad, NS + "ARCode"), text(ad, NS + "Street"), text(ad, NS + "House")
        cad = text(rel, NS + "ObjectCadastreNr")
        if ar in want_varis:
            cad_by_varis[ar] = cad
        if (street, house) in SCG_ADDRS and text(ad, NS + "Town") == "Rīga":
            scg_hits.setdefault(f"{street} {house}", []).append({"varis": ar, "cad": cad})
    print("address pass:", len(cad_by_varis), "osm VARIS matched;", {k: len(v) for k, v in scg_hits.items()})

    want_cad = set(cad_by_varis.values()) | {h["cad"] for v in scg_hits.values() for h in v}

    # 2) Building pass.
    buildings = {}
    for name, prepared, el in iter_items(cdir / "building.zip", "BuildingItemData"):
        meta["building"] = f"{name.split('/')[0]}.zip@{prepared}"
        b = el.find(NS + "BuildingBasicData")
        if b is None:
            continue
        cad, varis = text(b, NS + "BuildingCadastreNr"), text(b, NS + "VARISCode")
        if cad not in want_cad and varis not in want_varis:
            continue
        wall = []
        for c in el.iter(NS + "ConstructionDataList"):
            if (text(c, NS + "BuildingElementName") or "").startswith("Sienas"):
                wall += [m.text.strip() for m in c.iter(NS + "MaterialKindName") if m.text]
        y = text(b, NS + "BuildingExploitYear")
        buildings[cad] = {
            "cad": cad, "varis": varis, "use_id": text(b, NS + "BuildingUseKind/" + NS + "BuildingUseKindId"),
            "floors_above": int(text(b, NS + "BuildingGroundFloors") or -1),
            "floors_below": int(text(b, NS + "BuildingUndergroundFloors") or -1),
            "year": int(y) if y and y.isdigit() else None,
            "wall_lv": "; ".join(wall) or text(b, NS + "BuildingMaterialKind"),
            "name": text(b, NS + "BuildingName"),
        }
        want_cad.add(cad)
    print("building pass:", len(buildings))

    # 3) Premise-group pass: count dwelling groups (use kind 1122) and others per building.
    counts = {c: {"apartments": 0, "other": 0} for c in buildings}
    for name, prepared, el in iter_items(cdir / "premisegroup.zip", "PremiseGroupItemData"):
        meta["premisegroup"] = f"{name.split('/')[0]}.zip@{prepared}"
        rel = el.find(NS + "ObjectRelation")
        if rel is None or text(rel, NS + "ObjectType") != "BUILDING":
            continue
        cad = text(rel, NS + "ObjectCadastreNr")
        if cad not in counts:
            continue
        kind = text(el, NS + "PremiseGroupBasicData/" + NS + "PremiseGroupUseKind/" + NS + "PremiseGroupUseKindId")
        counts[cad]["apartments" if kind == "1122" else "other"] += 1
    print("premise pass done")

    by_varis = {}
    for b in buildings.values():
        b.update({"apartments_n": counts[b["cad"]]["apartments"], "other_premises_n": counts[b["cad"]]["other"]})
        by_varis[b["varis"]] = b
    out = {"_meta": {"files": meta, "licence": "CC BY 4.0, Valsts zemes dienests (VZD), data.gov.lv",
                     "note": "Riga ATVK 0001000 only; building characteristics only; no ownership data"},
           "buildings_by_varis": by_varis,
           "scg_address_hits": scg_hits,
           "osm_varis_to_cad": cad_by_varis}
    (HERE / "vzd_extract.json").write_text(json.dumps(out, ensure_ascii=False, sort_keys=True, indent=1) + "\n",
                                           encoding="utf-8")
    print("wrote vzd_extract.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
