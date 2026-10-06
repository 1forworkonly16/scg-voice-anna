// Russian spoken form of street addresses (RU_STREET_SPOKEN=cyrillic): the reviewed map, the generic fallback, house words.
import { describe, expect, it } from "vitest";
import searchRaw from "../../src/data/riga_buildings_search.json";
import { displayAddress, type BuildingRecord } from "../../src/lib/buildings";
import { STREET_RU, addressSpokenRu, streetSpokenMode, streetSpokenRu, transliterateLvRu } from "../../src/lib/street_ru";

const records = searchRaw as unknown as BuildingRecord[];
const streetsInData = [...new Set(records.map((r) => r.street_lv!))];

/** The name part of «Ilūkstes iela» (the last word is the street type). */
const nameOf = (street: string): string => street.replace(/\s+\S+$/, "");

describe("streetSpokenMode", () => {
  it("only «cyrillic» switches it on; everything else is the Latin default", () => {
    expect(streetSpokenMode("cyrillic")).toBe("cyrillic");
    expect(streetSpokenMode(" Cyrillic ")).toBe("cyrillic");
    for (const v of ["latin", "", " ", "yes", "кириллица", undefined, null, 1, true]) expect(streetSpokenMode(v), String(v)).toBe("latin");
  });
});

describe("the reviewed street map", () => {
  it("has an entry for every street of riga_buildings_search.json and for «Parauga iela»", () => {
    expect(streetsInData.length).toBeGreaterThanOrEqual(24);
    for (const s of streetsInData) expect(STREET_RU, s).toHaveProperty([s]);
    expect(STREET_RU["Parauga iela"]).toBe("улица Парауга");
    expect(Object.keys(STREET_RU).filter((k) => !streetsInData.includes(k) && k !== "Parauga iela")).toEqual([]); // no stale entries either
  });

  it("every entry is plain Cyrillic words with a Russian street type", () => {
    for (const [lv, ru] of Object.entries(STREET_RU)) {
      expect(ru, lv).toMatch(/^[А-Яа-яЁё]+(?: [А-Яа-яЁё]+)+$/);
      expect(ru, lv).toMatch(/^(улица|проспект|бульвар) | гатве$/);
    }
  });

  it("the type words: iela -> улица, gatve -> гатве (after the name), prospekts -> проспект, bulvāris -> бульвар", () => {
    expect(STREET_RU["Ilūkstes iela"]).toBe("улица Илукстес");
    expect(STREET_RU["Jūrmalas gatve"]).toBe("Юрмалас гатве");
    expect(STREET_RU["Rigondas gatve"]).toBe("Ригондас гатве");
    expect(STREET_RU["Kurzemes prospekts"]).toBe("проспект Курземес");
    expect(STREET_RU["Anniņmuižas bulvāris"]).toBe("бульвар Анниньмуйжас");
  });

  it("the generic transliteration gives the same name as the reviewed map for every street (one convention, no drift)", () => {
    for (const [lv, ru] of Object.entries(STREET_RU)) {
      const name = transliterateLvRu(nameOf(lv));
      expect(ru.replace(/^(улица|проспект|бульвар) /, "").replace(/ гатве$/, ""), lv).toBe(name);
    }
  });
});

describe("addressSpokenRu: the examples", () => {
  it.each([
    ["Ilūkstes iela 16", "улица Илукстес, дом шестнадцать"],
    ["Parauga iela 7", "улица Парауга, дом семь"],
    ["Jūrmalas gatve 59", "Юрмалас гатве, дом пятьдесят девять"],
    ["Rigondas gatve 6", "Ригондас гатве, дом шесть"],
    ["Kurzemes prospekts 134", "проспект Курземес, дом сто тридцать четыре"],
    ["Anniņmuižas bulvāris 84", "бульвар Анниньмуйжас, дом восемьдесят четыре"],
    ["Tirzas iela 3 k-2", "улица Тирзас, дом три, корпус два"],
    ["Ilūkstes iela 103 k-1", "улица Илукстес, дом сто три, корпус один"],
    ["Bauskas iela 63 k-1", "улица Баускас, дом шестьдесят три, корпус один"],
    ["Ozolciema iela 32 k-4", "улица Озолциема, дом тридцать два, корпус четыре"],
    ["Bērzupes iela 31A", "улица Берзупес, дом тридцать один А"],
    ["Mazā Krūmu iela 6", "улица Маза Круму, дом шесть"],
    ["Vizmas Belševicas iela 3", "улица Визмас Белшевицас, дом три"],
  ])("%s -> %s", (lv, ru) => {
    expect(addressSpokenRu(lv)).toBe(ru);
  });

  it("every address of the building list is spoken in words only: no Latin letter, no digit", () => {
    for (const r of records) {
      const spoken = addressSpokenRu(displayAddress(r));
      expect(spoken, displayAddress(r)).toMatch(/^[А-Яа-яЁё ,]+$/);
    }
  });

  it("house numbers are masculine words from words.ts", () => {
    expect(addressSpokenRu("Zemes iela 1")).toBe("улица Земес, дом один");
    expect(addressSpokenRu("Zemes iela 2")).toBe("улица Земес, дом два");
    expect(addressSpokenRu("Zemes iela 21 k-2")).toBe("улица Земес, дом двадцать один, корпус два");
    expect(addressSpokenRu("Zemes iela 112")).toBe("улица Земес, дом сто двенадцать");
  });
});

describe("addressSpokenRu: free text from the agent", () => {
  it("accents, case, a missing or inflected street type and the korpuss spellings do not matter for known streets", () => {
    for (const s of ["Ilūkstes 16", "ilukstes iela 16", "ILŪKSTES IELA 16", "Ilūkstes ielā 16", "Ilūkstes iela 16,", "Ilūkstes iela, 16", "  Ilūkstes   iela   16 "]) {
      expect(addressSpokenRu(s), s).toBe("улица Илукстес, дом шестнадцать");
    }
    for (const s of ["Tirzas iela 3k2", "Tirzas iela 3 k2", "Tirzas 3 korpuss 2", "Tirzas iela 3, k-2", "Tirzas iela 3 korp. 2"]) {
      expect(addressSpokenRu(s), s).toBe("улица Тирзас, дом три, корпус два");
    }
    expect(addressSpokenRu("Dzenu iela 10")).toBe("улица Дзеньу, дом десять"); // no cedilla: still the reviewed form
  });

  it("a wrong street type is not silently replaced by the known one", () => {
    expect(addressSpokenRu("Ilūkstes gatve 16")).toBe("Илукстес гатве, дом шестнадцать");
  });

  it("an unknown street is transliterated and keeps its type", () => {
    expect(addressSpokenRu("Brīvības iela 100")).toBe("улица Бривибас, дом сто");
    expect(addressSpokenRu("Brīvības gatve 201")).toBe("Бривибас гатве, дом двести один");
    expect(addressSpokenRu("Elizabetes iela 22")).toBe("улица Элизабетес, дом двадцать два");
    expect(addressSpokenRu("Aizkraukles iela 5 k-3")).toBe("улица Айзкрауклес, дом пять, корпус три");
  });

  it("a city at the end is spoken as «Рига»; a house letter is a Russian capital letter", () => {
    expect(addressSpokenRu("Ilūkstes iela 16, Rīga")).toBe("улица Илукстес, дом шестнадцать, Рига");
    expect(addressSpokenRu("Brīvības iela 100 Riga")).toBe("улица Бривибас, дом сто, Рига");
    expect(addressSpokenRu("Brīvības iela 12b")).toBe("улица Бривибас, дом двенадцать Б");
  });

  it("text without a Latin letter (already Russian) and empty text are returned as given", () => {
    expect(addressSpokenRu("Илукстес 16")).toBe("Илукстес 16");
    expect(addressSpokenRu("улица Бривибас, дом сто")).toBe("улица Бривибас, дом сто");
    expect(addressSpokenRu("")).toBe("");
    expect(addressSpokenRu("   ")).toBe("");
  });

  it("odd shapes never throw and never leave a Latin letter or a digit behind", () => {
    for (const s of ["Ilūkstes iela 16-5", "Ilūkstes iela 16/18", "Brīvības iela", "iela", "Rīga", "13. janvāra iela 5", "Ilūkstes iela 16 dz. 5", "Ilūkstes iela 16 un 18"]) {
      const out = addressSpokenRu(s);
      expect(out, s).not.toMatch(/[A-Za-z\u00C0-\u017F0-9]/);
    }
    expect(addressSpokenRu("Brīvības iela")).toBe("улица Бривибас");
    expect(addressSpokenRu("Rīga")).toBe("Рига");
  });
});

describe("streetSpokenRu (the street alone, for «street — какой номер дома?»)", () => {
  it("known and unknown streets", () => {
    expect(streetSpokenRu("Ilūkstes iela")).toBe("улица Илукстес");
    expect(streetSpokenRu("Jūrmalas gatve")).toBe("Юрмалас гатве");
    expect(streetSpokenRu("Brīvības iela")).toBe("улица Бривибас");
    expect(streetSpokenRu("Balvu")).toBe("улица Балву");
    expect(streetSpokenRu("улица Илукстес")).toBe("улица Илукстес");
    expect(streetSpokenRu("")).toBe("");
  });
});

describe("transliterateLvRu: the generic rules", () => {
  it.each([
    ["Ilūkstes", "Илукстес"],
    ["Brīvības", "Бривибас"],
    ["Šampētera", "Шампетера"],
    ["Čaka", "Чака"],
    ["Ģertrūdes", "Гертрудес"],
    ["Ķekavas", "Кекавас"],
    ["Ļermontova", "Лермонтова"],
    ["Cēsu", "Цесу"],
    ["Jūrmalas", "Юрмалас"],
    ["Jelgavas", "Елгавас"],
    ["Ilmājas", "Илмаяс"],
    ["Dzeņu", "Дзеньу"],
    ["Raiņa", "Райньа"],
    ["Skaistkalnes", "Скайсткалнес"],
    ["Anniņmuižas", "Анниньмуйжас"],
    ["Ozolciema", "Озолциема"],
    ["Bauskas", "Баускас"],
    ["Elizabetes", "Элизабетес"],
    ["Aeroporta", "Аэропорта"],
    ["Dzirnavu", "Дзирнаву"],
  ])("%s -> %s", (lv, ru) => {
    expect(transliterateLvRu(lv)).toBe(ru);
  });

  it("keeps capitals, shouting words, digits, punctuation and Cyrillic text", () => {
    expect(transliterateLvRu("Dz")).toBe("Дз");
    expect(transliterateLvRu("KRŪMU")).toBe("КРУМУ");
    expect(transliterateLvRu("Mazā Krūmu, 6-a")).toBe("Маза Круму, 6-а");
    expect(transliterateLvRu("Илукстес Ilūkstes")).toBe("Илукстес Илукстес");
  });
});
