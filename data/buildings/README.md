# Riga buildings dataset (WP1, Demo C "Anna")

30 hand-picked records for the address lookup of the voice assistant: 6 SCG published addresses, 23 typical
Soviet-series apartment buildings (Purvciems, Imanta, Pļavnieki, Ziepniekkalns) and 1 fictional **ДЕМО** record
(`Parauga iela 7`, `"demo": true`; used by the works/warranty demo flows, every value invented, no coordinates).
Demos A and B copy `out/riga_buildings.json` / `out/riga_buildings_search.json` from here.

## Sources (per field, see each record's `provenance`)
- **VZD cadastre open data** (CC BY 4.0, Valsts zemes dienests, Building/PremiseGroup/Address ZIPs, snapshot 2026-09-26):
  floors, year (exploitation year, may be a reconstruction year), wall material text (LV), use code, apartments
  (count of premise groups with use kind 1122; may undercount) and non-residential premises. Ownership data is never read.
- **OpenStreetMap** (ODbL, Overpass, retrieved 2026-10-02): coordinates, `building:levels` (cross-check), `design:ref` series.
- **INFO** `[Sxx]`/`[Axx]`: SCG-published facts (Ilūkstes 16: floors 9, stairwells 4; Tirzes 3 k-2: 4 floors).
- `fictional-demo` for the ДЕМО record. Prices and `riser_sets_guess` are derived by `build.py` from `parametric_quote`.

## Provenance rule (hard)
Every non-null field has a source string; no source means `null`. Nothing is inferred from the series or from memory.
Where two sources disagree (floors, apartments) the field is null and the conflict sits in `data_notes` (developer only).
Stairwells are null unless a source says so (only Ilūkstes 16); so only Ilūkstes 16 and the ДЕМО record carry a price.
Anna asks the caller for missing values. `pipes_due_score` is null (demo D, not needed here).

## Rebuild
```
PYTHONUTF8=1 python data/buildings/build.py                 # selftest first; writes out/ (idempotent)
python -B data/buildings/tests/test_build.py                 # tests
# regenerate the seed (optional; needs network + cache dir for the ~350 MB VZD ZIPs, kept outside the repo):
python data/buildings/sources/fetch_osm.py --refresh
python data/buildings/sources/probe_vzd.py --refresh
python data/buildings/sources/fetch_vzd.py --cache-dir <dir>
python data/buildings/sources/extract_vzd.py --cache-dir <dir>
python data/buildings/sources/make_seed.py
```
Outputs: `out/riga_buildings.json`, `out/riga_buildings_search.json` (id, street_lv, house, korpuss, aliases, normalized `keys`,
floors, stairwells, apartments, `sourced[]`, `assumed[]`, demo), `out/MANIFEST.json` (counts, sha256, price-model version).

## Notes
- The register spells the street **Tirzas iela**; SCG's blog says "Tirzes". Both are aliases.
- Ilūkstes 16: floors 9 and stairwells 4 from INFO; apartments 141 and year 1981 from VZD (VZD floors say 10, see `data_notes`).
- `build_date` in the MANIFEST is the latest source snapshot date, so rebuilds are byte-identical.
