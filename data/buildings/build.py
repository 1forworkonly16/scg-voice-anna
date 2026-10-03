"""Build the Riga buildings dataset for Anna (Demo C) from seed/buildings_seed.json.

    python data/buildings/build.py          # exit 0 = ok, 1 = selftest or validation failed

Steps: (1) run price_model_reference.selftest() and abort if it fails; (2) validate the seed (schema keys, exactly 30
records, unique ids, provenance rule); (3) fill riser_sets_guess and price_base_net / price_range_net ONLY through
parametric_quote(floors, apartments, stairwells) and only when all inputs are non-null; (4) write out/*.json
deterministically (sorted keys, UTF-8, no ASCII escaping, stable order).
"""
import sys

sys.dont_write_bytecode = True

import hashlib
import importlib.util
import json
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
INFO_DATA = HERE.parents[2] / "info" / "data"
REF = INFO_DATA / "price_model_reference.py"
SEED = HERE / "seed" / "buildings_seed.json"
OUT = HERE / "out"
EXPECTED_RECORDS = 30

KEYS = {
    # brief 00 keys
    "id", "address_lv", "lat", "lon", "floors_above", "floors_below", "year_commissioned", "wall_material",
    "apartments", "non_residential_premises", "use_code", "riser_sets_guess", "stairwells_guess",
    "price_base_net", "price_range_net", "pipes_due_score", "source",
    # additions
    "street_lv", "house", "korpuss", "district", "series", "scg_case", "aliases", "provenance", "demo", "label",
    "data_notes",
}
EXEMPT = {"id", "source", "aliases", "provenance", "demo", "label", "data_notes"}  # no provenance needed
DERIVED = ("riser_sets_guess", "price_base_net", "price_range_net")  # must be null in the seed; filled here
SOURCED_FIELDS = ("lat", "lon", "floors_above", "floors_below", "year_commissioned", "wall_material", "series",
                  "apartments", "non_residential_premises", "use_code", "stairwells_guess")


def load_ref():
    spec = importlib.util.spec_from_file_location("price_model_reference", REF)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def norm(s):
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = "".join(c if c.isalnum() else " " for c in s)
    return " ".join(s.split())


def keys_for(rec):
    forms = set(rec["aliases"]) | {f"{rec['street_lv']} {rec['house']}", rec["address_lv"].split(",")[0]}
    out = set()
    for f in forms:
        n = norm(f)
        out.add(n)
        out.add(re.sub(r"(\d) ([kк]) (\d)", r"\1\2\3", n))
    return sorted(out)


def validate(seed):
    errs = []
    if len(seed) != EXPECTED_RECORDS:
        errs.append(f"expected {EXPECTED_RECORDS} records, got {len(seed)}")
    ids = [r.get("id") for r in seed]
    if len(set(ids)) != len(ids):
        errs.append("duplicate ids")
    for r in seed:
        rid = r.get("id")
        if set(r) != KEYS:
            errs.append(f"{rid}: key mismatch missing={sorted(KEYS - set(r))} extra={sorted(set(r) - KEYS)}")
            continue
        prov = r["provenance"]
        for k, v in r.items():
            if k in EXEMPT:
                continue
            if v is not None and not (isinstance(prov.get(k), str) and prov[k].strip()):
                errs.append(f"{rid}: non-null field {k} has no provenance")
        for k in prov:
            if k not in KEYS or r.get(k) is None:
                errs.append(f"{rid}: provenance for null/unknown field {k}")
        for k in DERIVED:
            if r[k] is not None:
                errs.append(f"{rid}: derived field {k} must be null in the seed")
        if r["demo"] != (r["label"] == "ДЕМО"):
            errs.append(f"{rid}: demo flag and label disagree")
        if r["demo"] and any("fictional-demo" not in str(v) for v in prov.values()):
            errs.append(f"{rid}: demo record has a non-fictional provenance entry")
        if not r["demo"] and any("fictional" in str(v) for v in prov.values()):
            errs.append(f"{rid}: real record cites fictional-demo")
    if sum(1 for r in seed if r.get("demo")) != 1:
        errs.append("exactly one demo record required")
    return errs


def fill_derived(rec, ref):
    f, a, s = rec["floors_above"], rec["apartments"], rec["stairwells_guess"]
    fict = "fictional-demo: " if rec["demo"] else ""
    if f and a:
        q = ref.parametric_quote(f, a, s or 1)  # riser sets do not depend on stairwells
        rec["riser_sets_guess"] = q["riser_sets_estimate"]
        rec["provenance"]["riser_sets_guess"] = (
            f"{fict}derived: info/data/price_model_reference.py parametric_quote riser_sets_estimate = max(1, round({a}/{f}))")
    if f and a and s:
        q = ref.parametric_quote(f, a, s)
        rec["price_base_net"] = q["range"]["base"]["net"]
        rec["price_range_net"] = [q["range"]["low"]["net"], q["range"]["high"]["net"]]
        why = f"{fict}derived: info/data/price_model_reference.py parametric_quote(floors={f}, apartments={a}, stairwells={s}) [A25], indicative net EUR, base and low/high"
        rec["provenance"]["price_base_net"] = rec["provenance"]["price_range_net"] = why


def index_entry(rec):
    prov = rec["provenance"]
    sourced = [k for k in SOURCED_FIELDS if rec[k] is not None and "fictional" not in prov.get(k, "")]
    assumed = [k for k in sourced if re.search(r"\[A\d+\]", prov.get(k, ""))]
    return {
        "id": rec["id"], "street_lv": rec["street_lv"], "house": rec["house"], "korpuss": rec["korpuss"],
        "aliases": rec["aliases"], "keys": keys_for(rec), "floors": rec["floors_above"],
        "stairwells": rec["stairwells_guess"], "apartments": rec["apartments"],
        "sourced": sourced, "assumed": assumed, "demo": rec["demo"], "label": rec["label"],
    }


def dump(obj):
    return (json.dumps(obj, ensure_ascii=False, sort_keys=True, indent=1) + "\n").encode("utf-8")


def main():
    ref = load_ref()
    if not ref.selftest():
        print("price model selftest FAILED: aborting", file=sys.stderr)
        return 1
    seed = json.loads(SEED.read_text(encoding="utf-8"))
    errs = validate(seed)
    if errs:
        print("seed validation FAILED:\n  " + "\n  ".join(errs), file=sys.stderr)
        return 1
    for r in seed:
        fill_derived(r, ref)
    index = [index_entry(r) for r in seed]
    seen = {}
    for e in index:
        for k in e["keys"]:
            if seen.setdefault(k, e["id"]) != e["id"]:
                print(f"search key collision: {k!r} -> {seen[k]} and {e['id']}", file=sys.stderr)
                return 1
    OUT.mkdir(exist_ok=True)
    blobs = {"riga_buildings.json": dump(seed), "riga_buildings_search.json": dump(index)}
    for name, b in blobs.items():
        (OUT / name).write_bytes(b)
    dates = sorted({d for r in seed for v in r["provenance"].values() for d in re.findall(r"(?:retrieved |@)(\d{4}-\d{2}-\d{2})", v)})
    model = json.loads((INFO_DATA / "price_model.json").read_text(encoding="utf-8"))
    manifest = {
        "build_date": dates[-1] if dates else None,
        "build_date_note": "latest source snapshot date found in the provenance strings (keeps the build reproducible)",
        "counts": {"records": len(seed), "demo": sum(r["demo"] for r in seed),
                   "scg_published": sum(1 for r in seed if r["scg_case"]),
                   "with_price": sum(1 for r in seed if r["price_base_net"] is not None),
                   "with_floors": sum(1 for r in seed if r["floors_above"] is not None),
                   "with_apartments": sum(1 for r in seed if r["apartments"] is not None),
                   "with_stairwells": sum(1 for r in seed if r["stairwells_guess"] is not None),
                   "with_year": sum(1 for r in seed if r["year_commissioned"] is not None),
                   "search_keys": sum(len(e["keys"]) for e in index)},
        "price_model": {"version": model.get("version"),
                        "price_model_json_sha256": hashlib.sha256((INFO_DATA / "price_model.json").read_bytes()).hexdigest(),
                        "reference_py_sha256": hashlib.sha256(REF.read_bytes()).hexdigest()},
        "seed_sha256": hashlib.sha256(SEED.read_bytes()).hexdigest(),
        "sha256": {n: hashlib.sha256(b).hexdigest() for n, b in blobs.items()},
        "selftest": "passed",
    }
    (OUT / "MANIFEST.json").write_bytes(dump(manifest))
    print("OK", json.dumps(manifest["counts"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
