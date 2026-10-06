import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAddressIndex, loadSearchIndex, matchAddress } from "../../src/lib/address";
import { displayAddress, speakableFields, toBuilding, type BuildingRecord } from "../../src/lib/buildings";
import { buildingFacts } from "../../src/lib/speech";
import { fromRoot } from "../fixtures/paths";

describe("speakableFields: only sourced fields", () => {
  it("normalises brief-00 names to contract names, passes the rest through", () => {
    expect(speakableFields(["lat", "floors_above", "apartments", "stairwells_guess", "year_commissioned"])).toEqual(["lat", "floors", "apartments", "stairwells", "year"]);
    expect(speakableFields(["floors", "stairwells"])).toEqual(["floors", "stairwells"]);
    expect(speakableFields(undefined)).toEqual([]);
  });
  it("toBuilding + buildingFacts never speak an unsourced number", () => {
    const rec: BuildingRecord = { id: "x", street_lv: "Ilūkstes iela", house: "16", korpuss: null, floors: 9, stairwells: 4, apartments: 141, sourced: ["floors_above", "stairwells_guess", "apartments"] };
    const b = toBuilding(rec);
    expect(b).toMatchObject({ address: "Ilūkstes iela 16", floors: 9, stairwells: 4, sourced: ["floors", "stairwells", "apartments"] });
    expect(buildingFacts(b, "ru")).toBe("девять этажей, четыре подъезда и сто сорок одна квартира");
    expect(buildingFacts(toBuilding({ ...rec, sourced: ["floors_above", "apartments"] }), "ru")).toBe("девять этажей и сто сорок одна квартира");
  });
  it("toBuilding returns every unsourced number as null (WP8 t04: the agent must not see it)", () => {
    const rec: BuildingRecord = { id: "x", street_lv: "Ilūkstes iela", house: "16", korpuss: null, floors: 9, stairwells: 4, apartments: 144, sourced: ["floors_above"] };
    expect(toBuilding(rec)).toMatchObject({ floors: 9, stairwells: null, apartments: null, sourced: ["floors"] });
    expect(toBuilding({ ...rec, sourced: [] })).toMatchObject({ floors: null, stairwells: null, apartments: null });
  });
  it("displayAddress handles korpuss records", () => {
    expect(displayAddress({ id: "a", street_lv: "Tirzas iela", house: "3 k-2", korpuss: "2" })).toBe("Tirzas iela 3 k-2");
    expect(displayAddress({ id: "a", address_lv: "Tirzes iela 3 k-2, Rīga" })).toBe("Tirzes iela 3 k-2");
  });
});

describe("WP1 search-file shape (no address_lv; house '3 k-2'; aliases are full addresses)", () => {
  const raw = [
    { id: "w1", street_lv: "Ilūkstes iela", house: "16", korpuss: null, aliases: ["Илукстес 16"], floors: 9, stairwells: 4, apartments: 141, sourced: ["floors_above"] },
    { id: "w2", street_lv: "Tirzas iela", house: "3 k-2", korpuss: "2", aliases: ["Tirzas 3 k-2"], floors: 4, stairwells: null, apartments: 44, sourced: ["floors_above"] },
  ];
  const idx = buildAddressIndex(loadSearchIndex(raw));
  it("loads and matches", () => {
    expect(matchAddress("Илукстес 16", idx).building?.id).toBe("w1");
    expect(matchAddress("Tirzas iela 3 korpuss 2", idx).building?.id).toBe("w2");
    expect(matchAddress("Tirzas 3", idx).status).toBe("confirm");
    // «Tirzes» (spelling used in the plan) vs the cadastre's «Tirzas»: must still resolve, but ask to confirm
    const r = matchAddress("Tirzes 3 k-2", idx);
    expect(r.status).toBe("confirm");
    expect(r.building?.id).toBe("w2");
  });
});

const searchFile = fromRoot("src/data/riga_buildings_search.json");
describe.skipIf(!existsSync(searchFile))("real data: src/data/riga_buildings_search.json (copied from WP1 by sync-data)", () => {
  const entries = loadSearchIndex(JSON.parse(readFileSync(searchFile, "utf8")));
  const idx = buildAddressIndex(entries);
  it("loads every record with a usable address", () => {
    expect(entries.length).toBeGreaterThanOrEqual(30);
    for (const e of entries) expect(e.address_lv.length).toBeGreaterThan(3);
  });
  it("every record is found by its own address, and by each of its aliases", () => {
    for (const e of entries) {
      const own = matchAddress(e.address_lv, idx);
      expect(own.building?.id, `${e.address_lv}: ${own.status}`).toBe(e.id);
      for (const a of (e as { aliases?: string[] }).aliases ?? []) {
        const r = matchAddress(a, idx);
        expect(r.building?.id ?? r.candidates[0]?.id, `alias ${a}`).toBe(e.id);
      }
    }
  });
  it("spoken forms of the plan examples resolve to the right records", () => {
    const f = (t: string) => matchAddress(t, idx);
    expect(f("Илукстес 16").status).toBe("found");
    expect(f("Илукстес шестнадцать").building?.id).toBe(f("Ilūkstes iela 16").building?.id);
    expect(f("Ilūkstes iela 16").building).toMatchObject({ floors: 9 });
    expect(f("Tirzes 3 k-2").building?.id).toBe(f("Tirzas iela 3 k-2").building?.id);
    expect(f("Parauga 7").building).toMatchObject({ demo: true, label: "ДЕМО" });
    expect(f("Ilūkstes iela 100").status).toBe("not_found");
    expect(f("Ilūkstes iela").status).toBe("need_house");
  });
  it("Ilūkstes iela 16: floors 9, stairwells 4, apartments 141, all sourced; facts in RU and LV", () => {
    const rec = matchAddress("Ilūkstes iela 16", idx).building as unknown as BuildingRecord;
    const b = toBuilding(rec);
    expect(b).toMatchObject({ floors: 9, stairwells: 4, apartments: 141 });
    for (const f of ["floors", "stairwells", "apartments"]) expect(b.sourced).toContain(f);
    expect(b.sourced).not.toContain("floors_above");
    expect(b.sourced).not.toContain("stairwells_guess");
    expect(buildingFacts(b, "ru")).toBe("девять этажей, четыре подъезда и сто сорок одна квартира");
    expect(buildingFacts(b, "lv")).toBe("9 stāvi, 4 kāpņu telpas un 141 dzīvoklis");
  });
  it("an entry with null stairwells does not list stairwells as sourced", () => {
    const rec = entries.map((e) => e as unknown as BuildingRecord).find((e) => e.stairwells == null);
    expect(rec).toBeDefined();
    const b = toBuilding(rec!);
    expect(b.sourced).not.toContain("stairwells");
    expect(buildingFacts(b, "ru")).not.toMatch(/подъезд/);
  });
});
