import { readFileSync } from "node:fs";
import { fromRoot } from "../fixtures/paths";
import { describe, expect, it } from "vitest";
import {
  type AddressEntry,
  buildAddressIndex,
  jaroWinkler,
  loadSearchIndex,
  matchAddress,
  normalizeText,
  parseAddress,
  streetScore,
  wordsToDigits,
} from "../../src/lib/address";

const fixture: AddressEntry[] = loadSearchIndex(JSON.parse(readFileSync(fromRoot("tests/fixtures/buildings.sample.json"), "utf8")));

// Test-only extras (street names are real Riga streets, the buildings are NOT claims about real buildings).
const extra: AddressEntry[] = [
  { id: "t-07", address_lv: "Balvu iela 15, Rīga", address_ru: "ул. Балву, 15" },
  { id: "t-08", address_lv: "Kuldīgas iela 15, Rīga", address_ru: "ул. Кулдигас, 15" },
  { id: "t-09", address_lv: "Dzelzavas iela 74, Rīga", address_ru: "ул. Дзелзавас, 74" },
  { id: "t-10", address_lv: "Brīvības gatve 201, Rīga" },
  { id: "t-11", address_lv: "Anniņmuižas bulvāris 30, Rīga" },
  { id: "t-12", address_lv: "Mežotnes iela 12, Rīga" },
  { id: "t-13", address_lv: "Vaidavas iela 6, Rīga" },
  { id: "t-14", address_lv: "Maskavas iela 240, Rīga" },
  { id: "t-15", address_lv: "13. janvāra iela 5, Rīga" },
  { id: "t-16", address_lv: "Ilūkstes iela 18, Rīga" },
  { id: "t-17", address_lv: "Ilūkstes iela 120, Rīga" },
  { id: "t-18", address_lv: "Ziepniekkalna iela 25a, Rīga" },
];
const index = buildAddressIndex([...fixture, ...extra]);

describe("normalizeText", () => {
  it("strips Latvian accents and transliterates Cyrillic the same way", () => {
    expect(normalizeText("Ilūkstes ielā 16")).toBe("ilukstes iela 16");
    expect(normalizeText("Илукстес 16")).toBe("ilukstes 16");
    expect(normalizeText("Анниньмуйжас")).toBe(normalizeText("Anniņmuižas"));
    expect(normalizeText("Велконю")).toBe(normalizeText("Velkoņu"));
    expect(normalizeText("Вайдавас")).toBe(normalizeText("Vaidavas"));
    expect(normalizeText("Межотнес")).toBe(normalizeText("Mežotnes"));
    expect(normalizeText("Юрмалас")).toBe(normalizeText("Jūrmalas"));
  });
});

describe("wordsToDigits (RU, LV, EN spoken numbers)", () => {
  it.each([
    ["дом шестнадцать", "dom 16"],
    ["сто двадцать", "120"],
    ["сто двадцать пять", "125"],
    ["семьдесят четыре квартира сорок пять", "74 kvartira 45"],
    ["sešpadsmit", "16"],
    ["simts divdesmit", "120"],
    ["divdesmit pieci", "25"],
    ["trīs", "3"],
    ["fifty nine", "59"],
    ["двадцать", "20"],
  ])("%s -> %s", (input, out) => {
    expect(wordsToDigits(normalizeText(input))).toBe(out);
  });
});

describe("parseAddress", () => {
  it("reads korpuss in all spoken forms", () => {
    for (const t of [
      "Tirzes iela 3 k-2",
      "Tirzes 3k2",
      "Тирзес 3 корпус 2",
      "улица Тирзес, дом 3, корп. 2",
      "Tirzes 3 korpuss 2",
      "Тирзес три корпус два",
      "Tirzes iela 3 k 2",
    ]) {
      const p = parseAddress(t);
      expect([t, p.house, p.korpuss]).toEqual([t, "3", "2"]);
    }
  });
  it("reads the apartment (RU words, LV words, Latvian 74-45 convention)", () => {
    expect(parseAddress("Дзелзавас 74, квартира 45").apartment).toBe("45");
    expect(parseAddress("Dzelzavas iela 74, dzīvoklis 45").apartment).toBe("45");
    expect(parseAddress("Dzelzavas 74-45").apartment).toBe("45");
    expect(parseAddress("Dzelzavas 74-45").house).toBe("74");
    expect(parseAddress("Дзелзавас 74 кв. 45").apartment).toBe("45");
    expect(parseAddress("Ilūkstes iela 16, dz. 9").apartment).toBe("9");
  });
  it("drops the city, postcode, street type and filler words", () => {
    expect(parseAddress("Ilūkstes iela 16, Rīga, LV-1082").streetTokens).toEqual(["ilukstes"]);
    expect(parseAddress("я живу на улице Илукстес шестнадцать").streetTokens).toEqual(["ilukstes"]);
    expect(parseAddress("Рига, Юрмалас гатве 59").streetTokens).toEqual(["jurmalas"]);
  });
  it("treats a street named after a date as a street, not a house number", () => {
    const p = parseAddress("13. janvāra iela 5");
    expect(p.house).toBe("5");
    expect(p.streetTokens).toEqual(["13janvara"]);
  });
});

describe("string similarity", () => {
  it("Jaro-Winkler basics", () => {
    expect(jaroWinkler("ilukstes", "ilukstes")).toBe(1);
    expect(jaroWinkler("ilukstes", "ilukste")).toBeGreaterThan(0.95);
    expect(jaroWinkler("ilukstes", "tirzes")).toBeLessThan(0.7);
  });
  it("ignores filler words around the street name", () => {
    expect(streetScore(["zivu", "na", "ilukstes"], ["ilukstes"])).toBe(1);
  });
});

type Expect = { status: "found" | "confirm" | "need_house" | "not_found"; id?: string };
const CASES: [string, Expect][] = [
  // --- the plan's examples ---
  ["Илукстес 16", { status: "found", id: "fx-01" }],
  ["Илукстес шестнадцать", { status: "found", id: "fx-01" }],
  ["Tirzes 3 k-2", { status: "found", id: "fx-02" }],
  // --- Russian spoken forms ---
  ["улица Илукстес, дом 16", { status: "found", id: "fx-01" }],
  ["ул. Илукстес д. 16", { status: "found", id: "fx-01" }],
  ["я живу на Илукстес шестнадцать", { status: "found", id: "fx-01" }],
  ["Рига, Илукстес 16", { status: "found", id: "fx-01" }],
  ["Илукстес двадцать", { status: "not_found" }],
  ["Илукстес восемнадцать", { status: "found", id: "t-16" }],
  ["Илукстес сто двадцать", { status: "found", id: "t-17" }],
  ["Тирзес 3 корпус 2", { status: "found", id: "fx-02" }],
  ["Тирзес три корпус два", { status: "found", id: "fx-02" }],
  ["Тирзес 3 второй корпус", { status: "found", id: "fx-02" }],
  ["Тирзес 3 корпус 1", { status: "found", id: "fx-03" }],
  ["Велконю 2", { status: "found", id: "fx-04" }],
  ["Велконю два", { status: "found", id: "fx-04" }],
  ["Юрмалас гатве 59", { status: "found", id: "fx-05" }],
  ["Юрмалас гатве пятьдесят девять", { status: "found", id: "fx-05" }],
  ["Дзелзавас 74, квартира 45", { status: "found", id: "t-09" }],
  ["Балву пятнадцать", { status: "found", id: "t-07" }],
  ["Кулдигас 15", { status: "found", id: "t-08" }],
  ["Вайдавас 6", { status: "found", id: "t-13" }],
  ["Межотнес 12", { status: "found", id: "t-12" }],
  ["Анниньмуйжас бульвар 30", { status: "found", id: "t-11" }],
  ["Бривибас гатве 201", { status: "found", id: "t-10" }],
  ["Парауга 7", { status: "found", id: "fx-06" }],
  ["13 января улица 5", { status: "found", id: "t-15" }],
  // --- Latvian spoken forms ---
  ["Ilūkstes iela 16", { status: "found", id: "fx-01" }],
  ["Ilukstes iela 16", { status: "found", id: "fx-01" }],
  ["Ilūkstes ielā sešpadsmit", { status: "found", id: "fx-01" }],
  ["Ilūkstes iela 16, Rīga, LV-1082", { status: "found", id: "fx-01" }],
  ["16 Ilukstes street, Riga", { status: "found", id: "fx-01" }],
  ["Tirzes iela 3 korpuss 2", { status: "found", id: "fx-02" }],
  ["Tirzes 3k2", { status: "found", id: "fx-02" }],
  ["Jūrmalas gatve 59", { status: "found", id: "fx-05" }],
  ["Dzelzavas iela 74, dzīvoklis 45", { status: "found", id: "t-09" }],
  ["Dzelzavas 74-45", { status: "found", id: "t-09" }],
  ["Ziepniekkalna iela 25a", { status: "found", id: "t-18" }],
  ["Kuldīgas iela piecpadsmit", { status: "found", id: "t-08" }],
  // --- ASR-style misspellings (should still resolve, usually asking to confirm) ---
  ["Илукстэс 16", { status: "found", id: "fx-01" }],
  ["Илуксте 16", { status: "confirm", id: "fx-01" }],
  ["Ilukstes 16", { status: "found", id: "fx-01" }],
  ["Ilukstis iela 16", { status: "confirm", id: "fx-01" }],
  ["Балву 15 кв 3", { status: "found", id: "t-07" }],
  ["Дзелзавас 74", { status: "found", id: "t-09" }],
  ["Дзельзавас 74", { status: "found", id: "t-09" }],
  ["Дзелзавс 74", { status: "confirm", id: "t-09" }],
  // --- need house number ---
  ["Илукстес", { status: "need_house" }],
  ["улица Тирзес", { status: "need_house" }],
  ["Jūrmalas gatve", { status: "need_house" }],
  // --- korpuss ambiguity / assumption ---
  ["Тирзес 3", { status: "confirm" }],
  ["Velkoņu 2 korpuss 1", { status: "not_found" }],
  // --- not found ---
  ["Илукстес 17", { status: "not_found" }],
  ["Бривибас 5", { status: "not_found" }],
  ["Lāčplēša iela 10", { status: "not_found" }],
  ["Пушкина 10", { status: "not_found" }],
  ["", { status: "not_found" }],
  ["16", { status: "not_found" }],
];

describe("matchAddress: addresses as people say them", () => {
  it("has at least 40 spoken-address cases", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(40);
  });
  it.each(CASES)("%s", (text, expected) => {
    const r = matchAddress(text, index);
    expect(r.status, JSON.stringify({ text, street: r.street, conf: r.confidence, b: r.building?.id, c: r.candidates.map((c) => c.id) })).toBe(expected.status);
    if (expected.id) {
      const id = r.building?.id ?? r.candidates[0]?.id;
      expect(id).toBe(expected.id);
    }
    expect(r.candidates.length).toBeLessThanOrEqual(3);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });
});

describe("matchAddress details", () => {
  it("returns the street and up to 3 candidates when only the street is given", () => {
    const r = matchAddress("Ilūkstes iela", index);
    expect(r.status).toBe("need_house");
    expect(r.street).toBe("Ilūkstes iela");
    expect(r.candidates.map((c) => c.id)).toEqual(["fx-01", "t-16", "t-17"]);
  });
  it("offers both korpuss variants when the number is ambiguous", () => {
    const r = matchAddress("Tirzes iela 3", index);
    expect(r.status).toBe("confirm");
    expect(r.building).toBeNull();
    expect(r.candidates.map((c) => c.id).sort()).toEqual(["fx-02", "fx-03"]);
  });
  it("requires the house number to match exactly (16 is not 18, 25 is not 25a)", () => {
    expect(matchAddress("Ilūkstes iela 16", index).building?.id).toBe("fx-01");
    expect(matchAddress("Ilūkstes iela 18", index).building?.id).toBe("t-16");
    expect(matchAddress("Ziepniekkalna iela 25", index).status).toBe("not_found");
  });
  it("keeps the confidence of a clean match high and of a fuzzy one lower", () => {
    const exact = matchAddress("Ilūkstes iela 16", index);
    const fuzzy = matchAddress("Илуксте 16", index);
    expect(exact.confidence).toBe(1);
    expect(fuzzy.confidence).toBeLessThan(exact.confidence);
    expect(fuzzy.confidence).toBeGreaterThanOrEqual(0.88);
  });
  it("parses the apartment along the way", () => {
    expect(matchAddress("Дзелзавас 74, квартира 45", index).parsed.apartment).toBe("45");
  });
  it("passes extra record fields (floors, stairwells, sourced) through untouched", () => {
    const r = matchAddress("Илукстес 16", index);
    expect(r.building).toMatchObject({ floors: 9, stairwells: 4, sourced: ["floors", "stairwells"] });
  });
  it("loadSearchIndex accepts records and an address -> id map", () => {
    expect(loadSearchIndex([{ id: "a", address_lv: "X iela 1" }])).toHaveLength(1);
    expect(loadSearchIndex({ "Y iela 2, Rīga": "b" })).toEqual([{ id: "b", address_lv: "Y iela 2, Rīga" }]);
    expect(loadSearchIndex(null)).toEqual([]);
  });
});
