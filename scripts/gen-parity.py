"""Generate tests/fixtures/parity.json from the Python reference (the single source of truth for prices).

    python scripts/gen-parity.py            # writes tests/fixtures/parity.json

* Never writes bytecode (no __pycache__ next to the INFO reference).
* Runs the reference selftest() first and aborts if it fails.
* Imports ../info/data/price_model_reference.py BY PATH (info/ is read-only; nothing is written there).
* Records every Python round() site that hits an EXACT binary tie (x.5 -> half-even), so the TS port
  can be proven against ties of every kind.
"""
import sys

sys.dont_write_bytecode = True

import builtins
import hashlib
import importlib.util
import itertools
import json
import math
import random
from fractions import Fraction
from pathlib import Path

DV = Path(__file__).resolve().parent.parent
INFO = DV.parent / "info" / "data"
REF_PATH = INFO / "price_model_reference.py"
MODEL_PATH = INFO / "price_model.json"
OUT_PATH = DV / "tests" / "fixtures" / "parity.json"
MAX_BYTES = 300 * 1024

spec = importlib.util.spec_from_file_location("price_model_reference", REF_PATH)
ref = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ref)

print("== reference selftest ==")
if not ref.selftest():
    print("reference selftest FAILED; refusing to generate fixtures")
    sys.exit(1)
print("== selftest OK ==")

# ---- instrument round() inside the reference module (module globals shadow builtins) -------------
# Line numbers are the round() call sites in price_model_reference.py (parametric_quote).
SITE_LINES = {39: "net_gross", 41: "riser_sets", 46: "per_apartment_gross", 47: "monthly", 49: "per_riser_set_net"}
_state = {"ties": [], "l39": 0}


def _is_tie(x, ndigits):
    if not isinstance(x, float):
        return False
    scaled = Fraction(x) * (10 ** (ndigits or 0))
    return (scaled - math.floor(scaled)) == Fraction(1, 2)


def _recording_round(x, ndigits=None):
    line = sys._getframe(1).f_lineno
    site = SITE_LINES.get(line)
    if site == "net_gross":
        site = "net" if _state["l39"] % 2 == 0 else "gross"
        _state["l39"] += 1
    if site and _is_tie(float(x), ndigits):
        _state["ties"].append(site)
    return builtins.round(x) if ndigits is None else builtins.round(x, ndigits)


ref.round = _recording_round


def run(floors, apartments, stairwells, scope="risers_complete", horizontals=True, sewer_outlet=False,
        pump_station=False, options=()):
    _state["ties"] = []
    _state["l39"] = 0
    out = ref.parametric_quote(floors, apartments, stairwells, scope, horizontals, sewer_outlet, pump_station,
                               tuple(options))
    ties = sorted(set(_state["ties"]))
    return out, ties


cases = []
seen = set()


def add(kind, floors, apartments, stairwells, scope="risers_complete", horizontals=True, sewer_outlet=False,
        pump_station=False, options=()):
    key = (floors, apartments, stairwells, scope, horizontals, sewer_outlet, pump_station, tuple(options))
    if key in seen:
        return
    seen.add(key)
    out, ties = run(*key)
    cases.append({
        "kind": kind,
        "in": {"floors": floors, "apartments": apartments, "stairwells": stairwells, "scope": scope,
               "horizontals": horizontals, "sewer_outlet": sewer_outlet, "pump_station": pump_station,
               "options": list(options)},
        "out": out,
        "ties": ties,
    })


# 1. named anchors (must be present: 91880/16 -> 5742 and 104680/16 -> 6542, both exact ties)
add("anchor", 9, 144, 4)  # base net 91880, 16 sets -> 5742
add("anchor", 9, 144, 4, sewer_outlet=True)  # base net 104680 -> 6542
add("anchor", 9, 36, 1, horizontals=False)  # Ilukstes replay, selftest
add("anchor", 9, 144, 4, sewer_outlet=True)

# 2. grid floors x apartments x stairwells (default scope)
FLOORS = (1, 2, 3, 5, 9, 12, 16)
APTS = (1, 7, 16, 36, 72, 144, 250)
STAIRS = (1, 2, 4)
for f, a, s in itertools.product(FLOORS, APTS, STAIRS):
    add("grid", f, a, s)

# 3. every scope on a smaller grid, horizontals on and off
SMALL = ((5, 60, 3), (9, 36, 1), (9, 144, 4), (12, 96, 2), (4, 16, 1), (16, 256, 4))
SCOPES = ref.SCOPES
for scope, (f, a, s), h in itertools.product(SCOPES, SMALL, (True, False)):
    add("scope", f, a, s, scope=scope, horizontals=h)

# 4. every option alone and both, both booleans, on the small grid
OPTS = ("opt_sound_fire_wrap", "opt_new_towel_rail")
for opts, (f, a, s) in itertools.product(((OPTS[0],), (OPTS[1],), OPTS), SMALL):
    add("option", f, a, s, options=opts)
for h, so, ps in itertools.product((True, False), repeat=3):
    for (f, a, s) in SMALL:
        add("flags", f, a, s, horizontals=h, sewer_outlet=so, pump_station=ps)
for scope, so, ps, opts in itertools.product(SCOPES, (True, False), (True, False), ((), OPTS)):
    add("combo", 9, 144, 4, scope=scope, sewer_outlet=so, pump_station=ps, options=opts)

# 5. seeded random cases
rng = random.Random(20261003)
for _ in range(120):
    f = rng.randint(1, 20)
    s = rng.randint(1, 6)
    a = rng.randint(1, 60) * s + rng.randint(0, s)
    opts = tuple(o for o in OPTS if rng.random() < 0.4)
    add("random", f, a, s, scope=rng.choice(SCOPES), horizontals=rng.random() < 0.7,
        sewer_outlet=rng.random() < 0.3, pump_station=rng.random() < 0.2, options=opts)

# 6. exact-tie hunting: make sure each round() site is hit by an exact binary tie, with (mostly) integer inputs.
def tie_sites():
    got = set()
    for c in cases:
        got.update(c["ties"])
    return got


WANT = {"net", "gross", "riser_sets", "per_apartment_gross", "monthly", "per_riser_set_net"}
# (cap of 6 added cases per site so the fixture stays small)
tie_counts = {}
for f in range(1, 21):
    for a in range(1, 400):
        for s in (1, 2, 3, 4):
            for scope in ("risers_complete", "risers_water_only"):
                _, ties = run(f, a, s, scope)
                useful = [t for t in ties if tie_counts.get(t, 0) < 6]
                if useful:
                    for t in ties:
                        tie_counts[t] = tie_counts.get(t, 0) + 1
                    add("tie", f, a, s, scope=scope)
# net ties need a half-integer quantity (rates are integers): synthetic fractional apartments, flagged.
for a in (0.5, 1.5, 10.5, 36.5, 143.5):
    for opts in ((OPTS[0],), (OPTS[1],), OPTS):
        out, ties = run(9, a, 4, "risers_complete", True, False, False, opts)
        if "net" in ties:
            add("tie_fractional", 9, a, 4, options=opts)
# sets tie with explicit small examples (x.5): 9 apts / 2 floors = 4.5 -> 4; 11/2 = 5.5 -> 6
for f, a in ((2, 9), (2, 11), (4, 18), (6, 15), (10, 25)):
    add("tie_sets", f, a, 1)

missing = WANT - tie_sites()
if missing:
    print("WARNING: no exact tie found for sites:", sorted(missing))
    sys.exit(1)

# ---- direct rounding vectors (so the TS roundHalfEven is proven apart from the quote) -----------
round0 = []
for x in (0.5, 1.5, 2.5, 3.5, 4.5, 5742.5, 6542.5, 0.49999999999999994, 0.5000000000000001, 1e15 + 0.5, 2.0, 7.25, 7.75, 0.0):
    round0.append({"x": x, "r": builtins.round(x)})
for _ in range(60):
    x = rng.randint(0, 20000) / 2 if rng.random() < 0.5 else rng.uniform(0, 100000)
    round0.append({"x": x, "r": builtins.round(x)})
round2 = []
for x in (0.125, 0.375, 0.625, 0.875, 2.675, 1.005, 3.125, 18.75 / 6, 0.285, 1.115, 5742.5 / 7, 0.005, 0.015, 2.5, 8.505,
          10.125, 99.995, 0.0, 12.0):
    round2.append({"x": x, "r": builtins.round(x, 2)})
for _ in range(80):
    x = rng.randint(0, 40000) / 8 if rng.random() < 0.4 else rng.uniform(0, 5000)
    round2.append({"x": x, "r": builtins.round(x, 2)})

model_bytes = MODEL_PATH.read_bytes()
# The hash is over LF-normalised bytes (CRLF -> LF): a Windows checkout has CRLF, Linux has LF.
# tests/unit/quote.parity.test.ts hashes the same way.
model_lf_bytes = model_bytes.replace(b"\r\n", b"\n")
model = json.loads(model_bytes.decode("utf-8"))
fixture = {
    "_about": "GENERATED by scripts/gen-parity.py from info/data/price_model_reference.py. Do not edit.",
    "model_version": model["version"],
    "price_model_sha256": hashlib.sha256(model_lf_bytes).hexdigest(),
    "reference_selftest": "passed",
    "tie_sites_covered": sorted(tie_sites()),
    "anchors": {"91880/16": 5742, "104680/16": 6542},
    "round0": round0,
    "round2": round2,
    "cases": cases,
}
payload = json.dumps(fixture, ensure_ascii=False, separators=(",", ":")) + "\n"
size = len(payload.encode("utf-8"))
if size > MAX_BYTES:
    print(f"fixture too large: {size} bytes > {MAX_BYTES}")
    sys.exit(1)
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(payload)
print(f"wrote {OUT_PATH} ({size} bytes, {len(cases)} cases, ties: {sorted(tie_sites())})")
