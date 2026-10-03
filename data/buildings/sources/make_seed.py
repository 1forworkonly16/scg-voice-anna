"""Generate seed/buildings_seed.json (30 records) from osm_raw.json + vzd_extract.json + INFO citations.

    python data/buildings/sources/make_seed.py

Deterministic (hash-ranked selection, sorted keys). The seed is a reviewed artifact: after generation it can be
hand-edited, and build.py only validates it. Provenance rule: every non-null field carries a source string;
no source -> null. Where two sources disagree on floors or apartments the field is left null and the conflict
is written to `data_notes` (developer-only, never spoken).
"""
import hashlib
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
SEED = HERE.parent / "seed" / "buildings_seed.json"
DISTRICT_QUOTA = (("Purvciems", 6), ("Imanta", 6), ("Pļavnieki", 5), ("Ziepniekkalns", 6))
SCG_STREETS = {"Ilūkstes iela", "Tirzas iela", "Tirzes iela", "Velkoņu iela", "Balvu iela", "Kuldīgas iela", "Jūrmalas gatve"}
TYPICAL_LEVELS = (5, 9, 12, 16)
FORCE_INCLUDE = {("Ilūkstes iela", "103 k-1")}  # OSM carries building:flats=144 here: a second source for apartments
SERIES_OK = ("602", "467", "464", "119", "103", "104")

# --- Latvian -> Russian transliteration (matching aid for aliases only) -----------------------------------------
_MAP = {"a": "а", "ā": "а", "b": "б", "c": "ц", "č": "ч", "d": "д", "e": "е", "ē": "е", "f": "ф", "g": "г", "ģ": "г",
        "h": "х", "i": "и", "ī": "и", "k": "к", "ķ": "к", "l": "л", "ļ": "ль", "m": "м", "n": "н", "ņ": "нь",
        "o": "о", "p": "п", "r": "р", "s": "с", "š": "ш", "t": "т", "u": "у", "ū": "у", "v": "в", "z": "з", "ž": "ж"}
_TYPES = {"iela": ("улица", "ул."), "gatve": ("гатве", "гатве"), "bulvāris": ("бульвар", "бульвар"),
          "prospekts": ("проспект", "проспект"), "šoseja": ("шоссе", "шоссе"), "dambis": ("дамбис", "дамбис")}


def ru_word(w):
    w = w.lower()
    out, i = [], 0
    while i < len(w):
        ch = w[i]
        if ch == "j":
            nxt = w[i + 1] if i + 1 < len(w) else ""
            if nxt in ("a", "ā"):
                out.append("я"); i += 2; continue
            if nxt in ("u", "ū"):
                out.append("ю"); i += 2; continue
            if nxt in ("e", "ē"):
                out.append("е"); i += 2; continue
            out.append("й")
        elif ch in ("e", "ē") and i == 0:
            out.append("э")
        else:
            out.append(_MAP.get(ch, ch))
        i += 1
    return "".join(out).capitalize()


def ru_street(street_lv):
    """-> (core, full_long, full_short) e.g. ('Илукстес', 'улица Илукстес', 'ул. Илукстес')."""
    parts = street_lv.split()
    kind = parts[-1].lower()
    name = " ".join(ru_word(p) for p in parts[:-1])
    if kind in _TYPES:
        long_, short = _TYPES[kind]
        if kind == "iela":
            return name, f"{long_} {name}", f"{short} {name}"
        return name, f"{name} {long_}", f"{name} {short}"
    name = " ".join(ru_word(p) for p in parts)
    return name, name, name


def house_forms(house):
    """'3 k-2' -> LV/RU spellings of the house part (korpuss variants)."""
    if " k-" not in house:
        return [house], [house], None
    num, k = house.split(" k-")
    lv = [house, f"{num} k{k}", f"{num}k{k}", f"{num} korpuss {k}"]
    ru = [f"{num} к-{k}", f"{num} к{k}", f"{num}к{k}", f"{num} корпус {k}", f"{num} корп. {k}", f"{num} корп {k}"]
    return lv + [], ru, k


def make_aliases(street_lv, house, extra_streets=()):
    aliases = []
    for st in (street_lv,) + tuple(extra_streets):
        core_lv = st.rsplit(" ", 1)[0] if st.split()[-1].lower() in _TYPES else st
        core_ru, long_ru, short_ru = ru_street(st)
        lv_h, ru_h, _ = house_forms(house)
        for h in lv_h:
            aliases += [f"{st} {h}", f"{core_lv} {h}"]
        for h in ru_h if " k-" in house else [house]:
            aliases += [f"{core_ru} {h}", f"{long_ru} {h}", f"{short_ru} {h}", f"{core_ru}, {h}"]
    return sorted(set(a for a in aliases if a))


# --- helpers ---------------------------------------------------------------------------------------------------
def h(x):
    return hashlib.sha256(str(x).encode()).hexdigest()


def korpuss_of(house):
    return house.split(" k-")[1] if " k-" in house else None


def num_or_none(v):
    return int(v) if v is not None and str(v).isdigit() else None


def main():
    osm = json.loads((HERE / "osm_raw.json").read_text(encoding="utf-8"))
    vz = json.loads((HERE / "vzd_extract.json").read_text(encoding="utf-8"))
    ret = osm["_meta"]["retrieved"]
    vdate = vz["_meta"]["files"]["building"].split("@")[1]
    pdate = vz["_meta"]["files"]["premisegroup"].split("@")[1]
    vb = vz["buildings_by_varis"]

    ways, district_of, cur = {}, {}, None
    for e in osm["response"]["elements"]:
        if e["type"] == "marker":
            cur = e["tags"]["name"]
        elif e["type"] == "way":
            ways[e["id"]] = e
            if cur != "SCG":
                district_of.setdefault(e["id"], cur)
    addr_count = {}
    for w in ways.values():
        k = (w["tags"]["addr:street"], w["tags"]["addr:housenumber"])
        addr_count[k] = addr_count.get(k, 0) + 1

    def osm_cite(w, tag):
        return f"osm:way/{w['id']} {tag}={w['tags'][tag]} (retrieved {ret})"

    def build_record(street, house, w, b, *, floors=None, floors_src=None, stairwells=None, stairwells_src=None,
                     apartments=None, apartments_src=None, scg=None, district=None, notes=(), allow_year=True,
                     apt_conflict_check=True):
        """Assemble one record. b = VZD building dict or None; w = OSM way or None."""
        prov, notes = {}, list(notes)
        rec = {k: None for k in (
            "id", "address_lv", "street_lv", "house", "korpuss", "district", "lat", "lon", "floors_above",
            "floors_below", "year_commissioned", "wall_material", "series", "apartments", "non_residential_premises",
            "use_code", "riser_sets_guess", "stairwells_guess", "price_base_net", "price_range_net",
            "pipes_due_score", "scg_case", "source", "aliases", "provenance", "demo", "label", "data_notes")}
        rec["demo"], rec["label"] = False, None
        rec["street_lv"], rec["house"], rec["korpuss"] = street, house, korpuss_of(house)
        varis = (w["tags"].get("ref:LV:addr") if w else None) or (b["varis"] if b else None)
        rec["id"] = f"varis-{varis}"
        addr_src = None
        if w:
            pc = w["tags"].get("addr:postcode")
            rec["address_lv"] = f"{street} {house}, Rīga" + (f", {pc}" if pc else "")
            addr_src = f"osm:way/{w['id']} addr:street,addr:housenumber,addr:postcode (retrieved {ret})"
            rec["lat"], rec["lon"] = w["center"]["lat"], w["center"]["lon"]
            prov["lat"] = prov["lon"] = f"osm:way/{w['id']} center (retrieved {ret})"
        else:
            rec["address_lv"] = f"{street} {house}, Rīga"
            addr_src = f"vzd:Address.zip@{vdate} ARCode={varis} (street spelling as registered)"
        prov["address_lv"] = prov["street_lv"] = prov["house"] = addr_src
        if rec["korpuss"]:
            prov["korpuss"] = addr_src
        if district:
            rec["district"] = district
            prov["district"] = f"osm:area[name={district}] within area[name=Rīga] containing the way (retrieved {ret})"
        # floors
        if floors is not None:
            rec["floors_above"], prov["floors_above"] = floors, floors_src
        elif b and b["floors_above"] > 0:
            osm_l = num_or_none(w["tags"].get("building:levels")) if w else None
            if osm_l is not None and osm_l != b["floors_above"]:
                notes.append(f"floors conflict: osm building:levels={osm_l} vs vzd BuildingGroundFloors={b['floors_above']}; left null")
            else:
                rec["floors_above"] = b["floors_above"]
                src = f"vzd:Building.zip@{vdate} cad={b['cad']} BuildingGroundFloors={b['floors_above']}"
                if osm_l is not None:
                    src += "; " + osm_cite(w, "building:levels")
                prov["floors_above"] = src
        elif w and num_or_none(w["tags"].get("building:levels")) is not None:
            rec["floors_above"] = num_or_none(w["tags"]["building:levels"])
            prov["floors_above"] = osm_cite(w, "building:levels")
        if b:
            if b["floors_below"] >= 0:
                rec["floors_below"] = b["floors_below"]
                prov["floors_below"] = f"vzd:Building.zip@{vdate} cad={b['cad']} BuildingUndergroundFloors={b['floors_below']}"
            if allow_year and b["year"]:
                rec["year_commissioned"] = b["year"]
                prov["year_commissioned"] = (f"vzd:Building.zip@{vdate} cad={b['cad']} BuildingExploitYear={b['year']} "
                                             "(exploitation year; may be a reconstruction year)")
            if b["wall_lv"]:
                rec["wall_material"] = b["wall_lv"]
                prov["wall_material"] = f"vzd:Building.zip@{vdate} cad={b['cad']} wall element MaterialKindName"
            if b["use_id"]:
                rec["use_code"] = b["use_id"]
                prov["use_code"] = f"vzd:Building.zip@{vdate} cad={b['cad']} BuildingUseKindId"
            rec["non_residential_premises"] = b["other_premises_n"]
            prov["non_residential_premises"] = f"vzd:PremiseGroup.zip@{pdate} count(UseKindId!=1122, building cad={b['cad']})"
        if w and w["tags"].get("design:ref") and "fixme" not in w["tags"]["design:ref"].lower():
            rec["series"] = w["tags"]["design:ref"]
            prov["series"] = osm_cite(w, "design:ref")
        # apartments
        if apartments is not None:
            rec["apartments"], prov["apartments"] = apartments, apartments_src
        else:
            cands = []
            if b and b["apartments_n"] > 0:
                cands.append((b["apartments_n"], f"vzd:PremiseGroup.zip@{pdate} count(UseKindId=1122, building cad={b['cad']})"))
            if w and num_or_none(w["tags"].get("building:flats")) is not None:
                cands.append((int(w["tags"]["building:flats"]), osm_cite(w, "building:flats")))
            vals = {v for v, _ in cands}
            if len(vals) == 1:
                rec["apartments"], prov["apartments"] = cands[0][0], "; ".join(s for _, s in cands)
            elif len(vals) > 1:
                notes.append("apartments conflict: " + " vs ".join(f"{v} ({s.split(' ')[0]})" for v, s in cands) + "; left null")
        if stairwells is not None:
            rec["stairwells_guess"], prov["stairwells_guess"] = stairwells, stairwells_src
        if scg:
            rec["scg_case"], prov["scg_case"] = scg[0], scg[1]
        srcs = sorted({p.split(":")[0] for p in (prov[k].split(";")[0] for k in prov if k not in ("scg_case",))
                       if p.startswith(("osm", "vzd", "info"))} | set())
        rec["source"] = "sample from public open data (" + ", ".join(
            s for s in ("OSM (c) OpenStreetMap contributors, ODbL", "VZD cadastre open data, CC BY 4.0", "SCG site text")
            if (s.startswith("OSM") and any("osm:" in v for v in prov.values()))
            or (s.startswith("VZD") and any("vzd:" in v for v in prov.values()))
            or (s.startswith("SCG") and any(v.startswith("info/") for v in prov.values()))) + ")"
        rec["provenance"] = dict(sorted(prov.items()))
        rec["data_notes"] = notes
        return rec

    def way_by_addr(street, house):
        for w in sorted(ways.values(), key=lambda x: x["id"]):
            if w["tags"]["addr:street"] == street and w["tags"]["addr:housenumber"] == house and w["tags"].get("building") == "apartments":
                return w
        for w in sorted(ways.values(), key=lambda x: x["id"]):
            if w["tags"]["addr:street"] == street and w["tags"]["addr:housenumber"] == house:
                return w
        return None

    def vzd_for(w, street, house):
        if w and w["tags"].get("ref:LV:addr") in vb:
            return vb[w["tags"]["ref:LV:addr"]]
        hit = vz["scg_address_hits"].get(f"{street} {house}")
        if hit:
            for hh in hit:
                for b in vb.values():
                    if b["cad"] == hh["cad"]:
                        return b
        return None

    records = []
    L = "info/copy/site_text_lv.md"


    # 1. Ilūkstes iela 16: floors/stairwells from the SCG blog [S13], apartments and year from VZD.
    w = way_by_addr("Ilūkstes iela", "16"); b = vzd_for(w, "Ilūkstes iela", "16")
    r = build_record("Ilūkstes iela", "16", w, b, floors=9, floors_src=f"{L}:318 [S13] (\"deviņstāvu\" house); info/data/projects.json:18; " + osm_cite(w, "building:levels"),
                     stairwells=4, stairwells_src=f"{L}:318 [S13] (one stairwell done, \"pārējās trīs\" = the other three)",
                     allow_year=True,
                     scg=({"year": "2017-2018", "scope_en": "One stairwell: hot + cold water + sewer risers replaced"}, "info/data/projects.json:18 [S13]"),
                     notes=[f"floors: vzd {vdate} BuildingGroundFloors={b['floors_above']} differs from the published 9 (SCG blog, OSM); 9 is used"])
    records.append(r)

    # 2. Tirzes iela 3 k-2 (register spelling: Tirzas iela), stairwells null.
    w = way_by_addr("Tirzas iela", "3 k-2"); b = vzd_for(w, "Tirzas iela", "3 k-2")
    r = build_record("Tirzas iela", "3 k-2", w, b, floors=4, floors_src=f"{L}:310 [S13] (\"Četrstāvu mājai\"); info/data/projects.json:17; corroborated by "
                     + osm_cite(w, "building:levels") + f"; vzd:Building.zip@{vdate} BuildingGroundFloors={b['floors_above']}",
                     scg=({"year": 2016, "scope_en": "4-floor building, one stairwell: cold + hot water risers replaced"}, "info/data/projects.json:17 [S13]"),
                     notes=["SCG's blog spells the street 'Tirzes iela'; the official register (VZD, OSM) spells it 'Tirzas iela'. Both are aliases.",
                            "stairwells: no source (the blog says only that ONE stairwell was replaced); left null"])
    r["aliases"] = make_aliases("Tirzas iela", "3 k-2", ("Tirzes iela",))
    records.append(r)

    # 3-6. the other SCG published addresses
    for street, house, case, line, sid in (
            ("Velkoņu iela", "2", ({"year": 2018, "scope_en": "16 hot/cold water risers in kitchens replaced"}), 19, "S14"),
            ("Balvu iela", "15", ({"year": 2018, "scope_en": "Risers replaced, plus a new pump station within the riser budget"}), 20, "S14"),
            ("Kuldīgas iela", "15", ({"year": "2016-2018", "scope_en": "All pipework replaced"}), 21, "S16"),
            ("Jūrmalas gatve", "59", ({"year": "2014-2018", "scope_en": "Cold/hot water + sewer risers replaced step by step over four years"}), 16, "S10")):
        w = way_by_addr(street, house); b = vzd_for(w, street, house)
        notes = []
        if (street, house) == ("Kuldīgas iela", "15"):
            notes.append("OSM has two ways with this address (134361860, 134361887; both building:levels=5); coordinates are from the first")
        r = build_record(street, house, w, b, scg=(case, f"info/data/projects.json:{line} [{sid}]"), notes=notes)
        records.append(r)

    # 7. typical buildings: OSM candidates that VZD corroborates.
    taken = {(x["street_lv"], x["house"]) for x in records}
    cands = {d: [] for d, _ in DISTRICT_QUOTA}
    for wid, d in sorted(district_of.items()):
        w = ways[wid]; t = w["tags"]
        key = (t["addr:street"], t["addr:housenumber"])
        lv = num_or_none(t.get("building:levels"))
        b = vb.get(t.get("ref:LV:addr", ""))
        if t.get("building") != "apartments" or lv not in TYPICAL_LEVELS or not b or d not in cands:
            continue
        if key in taken or addr_count[key] != 1 or (key[0] in SCG_STREETS and key not in FORCE_INCLUDE):
            continue
        if b["use_id"] != "1122" or b["floors_above"] != lv or not b["year"] or not 1955 <= b["year"] <= 1991:
            continue
        if not 2 * lv <= b["apartments_n"] <= 600:
            continue
        series = (t.get("design:ref") or "")
        pri = 0 if key in FORCE_INCLUDE else (1 if any(s in series for s in SERIES_OK) else 2)
        cands[d].append((pri, h(wid), wid))
    chosen = []
    for d, quota in DISTRICT_QUOTA:
        per_street, n = {}, 0
        for pri, _, wid in sorted(cands[d]):
            st = ways[wid]["tags"]["addr:street"]
            if per_street.get(st, 0) >= 2:
                continue
            chosen.append((d, wid)); per_street[st] = per_street.get(st, 0) + 1; n += 1
            if n == quota:
                break
    for d, wid in chosen:
        w = ways[wid]; t = w["tags"]; b = vb[t["ref:LV:addr"]]
        notes = []
        if t.get("building:flats"):
            notes.append("OSM building:flats present; compared with the VZD premise-group count")
        records.append(build_record(t["addr:street"], t["addr:housenumber"], w, b, district=d, notes=notes))

    for rec in records:
        if not rec["aliases"]:
            rec["aliases"] = make_aliases(rec["street_lv"], rec["house"])

    # 8. fictional demo record
    F = "fictional-demo"
    demo = {k: None for k in records[0]}
    demo.update({
        "id": "demo-parauga-iela-7", "address_lv": "Parauga iela 7, Rīga (ДЕМО)", "street_lv": "Parauga iela", "house": "7",
        "korpuss": None, "floors_above": 5, "floors_below": 1, "year_commissioned": 1968, "wall_material": "panel (fictional)",
        "apartments": 80, "non_residential_premises": 0, "use_code": "1122", "stairwells_guess": 4, "pipes_due_score": 80,
        "demo": True, "label": "ДЕМО", "source": F, "scg_case": None, "district": None, "lat": None, "lon": None, "series": None,
        "data_notes": ["Fictional address for the works/warranty demo flows. Every value is invented for the demo. No coordinates on purpose."],
        "aliases": sorted(set(make_aliases("Parauga iela", "7") + ["Парауга 7", "Параугас 7", "улица Парауга 7", "ул. Парауга 7",
                                                                    "ДЕМО Парауга 7", "Parauga 7", "DEMO Parauga 7"]))})
    demo["provenance"] = {k: F for k in ("address_lv", "street_lv", "house", "floors_above", "floors_below", "year_commissioned",
                                         "wall_material", "apartments", "non_residential_premises", "use_code",
                                         "stairwells_guess", "pipes_due_score")}
    records.append(demo)

    SEED.parent.mkdir(parents=True, exist_ok=True)
    SEED.write_text(json.dumps(records, ensure_ascii=False, sort_keys=True, indent=1) + "\n", encoding="utf-8")
    by = {}
    for r in records:
        by[r["district"] or ("SCG" if r["scg_case"] else "demo")] = by.get(r["district"] or ("SCG" if r["scg_case"] else "demo"), 0) + 1
    print(len(records), "records", by)
    for d, n in DISTRICT_QUOTA:
        print(d, "candidates:", len(cands[d]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
