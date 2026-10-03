"""Dataset tests (stdlib unittest). Run from the DV root:  python -B data/buildings/tests/test_build.py"""
import sys

sys.dont_write_bytecode = True

import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

B = Path(__file__).resolve().parents[1]
INFO_DATA = B.parents[2] / "info" / "data"
OUT = B / "out"
PREFIXES = ("info/", "osm:", "vzd:", "fictional-demo", "derived:")


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


REF = _load("price_model_reference", INFO_DATA / "price_model_reference.py")
BUILD = _load("scg_build", B / "build.py")


class DatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (OUT / "riga_buildings.json").exists():
            assert BUILD.main() == 0
        rd = lambda n: json.loads((OUT / n).read_text(encoding="utf-8"))
        cls.recs = rd("riga_buildings.json")
        cls.idx = rd("riga_buildings_search.json")
        cls.manifest = rd("MANIFEST.json")
        cls.by = {f"{r['street_lv']} {r['house']}": r for r in cls.recs}

    def test_30_records_unique_ids(self):
        self.assertEqual(len(self.recs), 30)
        self.assertEqual(len({r["id"] for r in self.recs}), 30)

    def test_ilukstes_16(self):
        r = self.by["Ilūkstes iela 16"]
        self.assertEqual((r["floors_above"], r["stairwells_guess"], r["apartments"], r["year_commissioned"]), (9, 4, 141, 1981))
        self.assertIn("site_text_lv.md:318", r["provenance"]["floors_above"])
        self.assertIn("[S13]", r["provenance"]["floors_above"])
        self.assertIn("site_text_lv.md:318", r["provenance"]["stairwells_guess"])
        self.assertTrue(r["provenance"]["apartments"].startswith("vzd:PremiseGroup.zip@2026-09-26"))
        self.assertNotIn("[A17]", r["provenance"]["apartments"])
        self.assertTrue(r["provenance"]["year_commissioned"].startswith("vzd:Building.zip@2026-09-26"))
        e = next(x for x in self.idx if x["id"] == r["id"])
        self.assertIn("floors_above", e["sourced"])
        self.assertIn("stairwells_guess", e["sourced"])
        for f in ("apartments", "year_commissioned"):
            self.assertIn(f, e["sourced"])
        self.assertEqual(e["assumed"], [])
        self.assertEqual(r["riser_sets_guess"], round(141 / 9))
        q = REF.parametric_quote(9, 141, 4)
        self.assertEqual(r["price_base_net"], q["range"]["base"]["net"])
        self.assertEqual(r["price_range_net"], [q["range"]["low"]["net"], q["range"]["high"]["net"]])

    def test_tirzes_stairwells_null(self):
        r = self.by["Tirzas iela 3 k-2"]
        self.assertIsNone(r["stairwells_guess"])
        self.assertEqual(r["floors_above"], 4)
        self.assertIsNone(r["price_base_net"])
        self.assertTrue(any("tirzes iela 3 k 2" == k for e in self.idx if e["id"] == r["id"] for k in e["keys"]))

    def test_six_scg_addresses(self):
        for a in ("Ilūkstes iela 16", "Tirzas iela 3 k-2", "Velkoņu iela 2", "Balvu iela 15", "Kuldīgas iela 15", "Jūrmalas gatve 59"):
            self.assertIsNotNone(self.by[a]["scg_case"], a)
            self.assertIn("info/data/projects.json", self.by[a]["provenance"]["scg_case"])

    def test_provenance_rule(self):
        exempt = BUILD.EXEMPT
        for r in self.recs:
            for k, v in r.items():
                if k in exempt:
                    continue
                if v is None:
                    self.assertNotIn(k, r["provenance"], f"{r['id']}.{k}: provenance for null field")
                else:
                    p = r["provenance"].get(k)
                    self.assertTrue(isinstance(p, str) and p.startswith(PREFIXES), f"{r['id']}.{k}: {p!r}")

    def test_demo_record(self):
        demos = [r for r in self.recs if r["demo"]]
        self.assertEqual(len(demos), 1)
        d = demos[0]
        self.assertEqual((d["street_lv"], d["house"], d["label"]), ("Parauga iela", "7", "ДЕМО"))
        self.assertTrue(all("fictional-demo" in v for v in d["provenance"].values()))
        e = next(x for x in self.idx if x["id"] == d["id"])
        self.assertTrue(e["demo"])
        self.assertEqual(e["sourced"], [])
        self.assertEqual([r for r in self.recs if not r["demo"] and any("fictional" in v for v in r["provenance"].values())], [])

    def test_prices_equal_fresh_quote(self):
        priced = 0
        for r in self.recs:
            f, a, s = r["floors_above"], r["apartments"], r["stairwells_guess"]
            if f and a and s:
                q = REF.parametric_quote(f, a, s)
                self.assertEqual(r["price_base_net"], q["range"]["base"]["net"], r["id"])
                self.assertEqual(r["price_range_net"], [q["range"]["low"]["net"], q["range"]["high"]["net"]], r["id"])
                priced += 1
            else:
                self.assertIsNone(r["price_base_net"], r["id"])
                self.assertIsNone(r["price_range_net"], r["id"])
        self.assertEqual(priced, self.manifest["counts"]["with_price"])
        self.assertGreaterEqual(priced, 2)

    def test_search_index_matches_records(self):
        self.assertEqual([e["id"] for e in self.idx], [r["id"] for r in self.recs])
        allkeys = {}
        for e, r in zip(self.idx, self.recs):
            self.assertEqual((e["street_lv"], e["house"], e["korpuss"]), (r["street_lv"], r["house"], r["korpuss"]))
            self.assertEqual((e["floors"], e["stairwells"], e["apartments"], e["demo"]),
                             (r["floors_above"], r["stairwells_guess"], r["apartments"], r["demo"]))
            self.assertEqual(e["aliases"], r["aliases"])
            self.assertTrue(e["keys"])
            for f in e["sourced"]:
                self.assertIsNotNone(r[f])
                self.assertNotIn("fictional", r["provenance"][f])
            for k in e["keys"]:
                self.assertNotIn(k, allkeys, f"key collision {k}")
                allkeys[k] = e["id"]
        self.assertEqual(allkeys["илукстес 16"], self.by["Ilūkstes iela 16"]["id"])
        self.assertEqual(allkeys["ilukstes iela 16"], self.by["Ilūkstes iela 16"]["id"])
        self.assertEqual(allkeys["парауга 7"], self.by["Parauga iela 7"]["id"])

    def test_manifest_hashes_and_no_pycache(self):
        for n, h in self.manifest["sha256"].items():
            self.assertEqual(hashlib.sha256((OUT / n).read_bytes()).hexdigest(), h, n)
        self.assertEqual(self.manifest["counts"]["records"], 30)
        self.assertEqual(self.manifest["selftest"], "passed")
        self.assertEqual(list(B.rglob("__pycache__")), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
