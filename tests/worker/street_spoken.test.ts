// RU_STREET_SPOKEN (WPV3): latin (default) keeps «Ilūkstes iela 16» in say_ru; cyrillic makes say_ru speak «улица Илукстес, дом шестнадцать».
// ONLY say_ru changes: say_lv, the structured fields, the Leads row, the Calendar event and the Telegram text keep the Latin address.
// Phrase texts come from src/copy/phrases.ts (WPV2 may reword them), so the expectations fill the real templates.
import { describe, expect, it } from "vitest";
import { PHRASES } from "../../src/copy/phrases";
import { LEADS_HEADERS } from "../../src/google/sheet_schema";
import { fillTemplate } from "../../src/lib/render";
import { base, bookingBody, harness } from "./helpers";

const ILUKSTES_16 = "varis-101117924"; // Ilūkstes iela 16 in src/data/riga_buildings_search.json
const FACTS_RU = "девять этажей, четыре подъезда и сто сорок одна квартира";
const FACTS_LV = "9 stāvi, 4 kāpņu telpas un 141 dzīvoklis";
const LATIN: (string | undefined)[] = [undefined, "latin", "", "yes", "кириллица"]; // everything but «cyrillic» is the default

const env = (mode: string | undefined) => (mode === undefined ? {} : { RU_STREET_SPOKEN: mode });
const without = <T extends Record<string, unknown>>(o: T, key: string): Record<string, unknown> => {
  const { [key]: _drop, ...rest } = o;
  return rest;
};

describe("lookup_building", () => {
  it("default, «latin» and any unknown value: say_ru keeps the Latin address (live behaviour unchanged)", async () => {
    for (const mode of LATIN) {
      const h = await harness({}, env(mode));
      const r = await h.call("lookup_building", { ...base("s1"), address: "Илукстес 16" });
      expect(r.body.say_ru, String(mode)).toBe(fillTemplate(PHRASES.building_found.ru, { address: "Ilūkstes iela 16", facts: FACTS_RU }));
      await h.flush();
    }
  });

  it("cyrillic: found speaks «улица Илукстес, дом шестнадцать»; say_lv and every other field are identical to latin", async () => {
    const lat = await harness({}, env("latin"));
    const cyr = await harness({}, env("cyrillic"));
    const a = await lat.call("lookup_building", { ...base("s1"), address: "Илукстес 16" });
    const b = await cyr.call("lookup_building", { ...base("s1"), address: "Илукстес 16" });
    expect(b.body.status).toBe("found");
    expect(b.body.say_ru).toBe(fillTemplate(PHRASES.building_found.ru, { address: "улица Илукстес, дом шестнадцать", facts: FACTS_RU }));
    expect(b.body.say_lv).toBe(fillTemplate(PHRASES.building_found.lv, { address: "Ilūkstes iela 16", facts: FACTS_LV }));
    expect(b.body.say_ru).not.toMatch(/[A-Za-zĀ-ž]/);
    expect(without(b.body, "say_ru")).toEqual(without(a.body, "say_ru")); // say_lv, hint, building.address (Latin), candidates, street ...
    expect(b.body.building.address).toBe("Ilūkstes iela 16");
    await lat.flush();
    await cyr.flush();
  });

  it("cyrillic: confirm (korpuss), known building without speakable facts, a mistyped street and need_house", async () => {
    const h = await harness({}, env("cyrillic"));
    const korpuss = await h.call("lookup_building", { ...base("s1"), address: "Tirzas iela 3" });
    expect(korpuss.body.status).toBe("confirm");
    expect(korpuss.body.say_ru).toBe(fillTemplate(PHRASES.building_confirm.ru, { address: "улица Тирзас, дом три, корпус два" }));
    expect(korpuss.body.say_lv).toBe(fillTemplate(PHRASES.building_confirm.lv, { address: "Tirzas iela 3 k-2" }));

    const demo = await h.call("lookup_building", { ...base("s1"), address: "Parauga iela 7" }); // no sourced facts: building_confirm
    expect(demo.body.say_ru).toBe(fillTemplate(PHRASES.building_confirm.ru, { address: "улица Парауга, дом семь" }));
    expect(demo.body.say_lv).toContain("Parauga iela 7");

    const fuzzy = await h.call("lookup_building", { ...base("s1"), address: "Ilukstis 16" });
    expect(fuzzy.body.status).toBe("confirm");
    expect(fuzzy.body.say_ru).toBe(fillTemplate(PHRASES.building_confirm.ru, { address: "улица Илукстес, дом шестнадцать" }));

    const street = await h.call("lookup_building", { ...base("s1"), address: "Ilūkstes iela" });
    expect(street.body.status).toBe("need_house");
    expect(street.body.say_ru).toBe(fillTemplate(PHRASES.building_need_house.ru, { street: "улица Илукстес" }));
    expect(street.body.say_lv).toBe(fillTemplate(PHRASES.building_need_house.lv, { street: "Ilūkstes iela" }));
    expect(street.body.street).toBe("Ilūkstes iela"); // the structured field stays Latin
    await h.flush();
  });

  it("latin: confirm and need_house keep Latin in say_ru", async () => {
    const h = await harness({}, env("latin"));
    const korpuss = await h.call("lookup_building", { ...base("s1"), address: "Tirzas iela 3" });
    expect(korpuss.body.say_ru).toBe(fillTemplate(PHRASES.building_confirm.ru, { address: "Tirzas iela 3 k-2" }));
    const street = await h.call("lookup_building", { ...base("s1"), address: "Ilūkstes iela" });
    expect(street.body.say_ru).toBe(fillTemplate(PHRASES.building_need_house.ru, { street: "Ilūkstes iela" }));
    await h.flush();
  });

  it("gatve, prospekts and bulvāris streets", async () => {
    const h = await harness({}, env("cyrillic"));
    for (const [address, spoken] of [
      ["Jūrmalas gatve 59", "Юрмалас гатве, дом пятьдесят девять"],
      ["Kurzemes prospekts 134", "проспект Курземес, дом сто тридцать четыре"],
      ["Anniņmuižas bulvāris 84", "бульвар Анниньмуйжас, дом восемьдесят четыре"],
    ] as const) {
      const r = await h.call("lookup_building", { ...base("s1"), address });
      expect(r.body.say_ru, address).toContain(spoken);
      expect(r.body.say_lv, address).toContain(address);
    }
    await h.flush();
  });
});

describe("book_inspection", () => {
  async function book(mode: string | undefined, over: Record<string, unknown> = {}, conv = "s-book") {
    const h = await harness({}, env(mode));
    const r = await h.call("book_inspection", bookingBody(conv, over));
    await h.flush();
    return { h, r, leads: h.world.tabs.Leads, event: [...h.world.events.values()][0], telegram: h.world.telegram };
  }

  it("default, «latin» and any unknown value keep the Latin address in say_ru", async () => {
    for (const mode of LATIN) {
      const { r } = await book(mode, { building_id: ILUKSTES_16 });
      expect(r.body.say_ru, String(mode)).toBe(fillTemplate(PHRASES.booking_ok.ru, { address: "Ilūkstes iela 16", slot: r.body.slot.label_ru }));
    }
  });

  it("cyrillic changes only say_ru: say_lv, the answer fields, the Leads row, the Calendar event and Telegram stay Latin", async () => {
    const lat = await book("latin", { building_id: ILUKSTES_16 });
    const cyr = await book("cyrillic", { building_id: ILUKSTES_16 });
    expect(cyr.r.body.ok).toBe(true);
    expect(cyr.r.body.say_ru).toBe(fillTemplate(PHRASES.booking_ok.ru, { address: "улица Илукстес, дом шестнадцать", slot: cyr.r.body.slot.label_ru }));
    expect(cyr.r.body.say_lv).toBe(fillTemplate(PHRASES.booking_ok.lv, { address: "Ilūkstes iela 16", slot: cyr.r.body.slot.label_lv }));
    expect(cyr.r.body.address).toBe("Ilūkstes iela 16");
    expect(without(cyr.r.body, "say_ru")).toEqual(without(lat.r.body, "say_ru"));
    // everything the team reads is byte-identical to the latin run
    expect(cyr.leads).toEqual(lat.leads);
    expect(cyr.event).toEqual(lat.event);
    expect(cyr.telegram).toEqual(lat.telegram);
    expect(cyr.leads[0]![LEADS_HEADERS.indexOf("address")]).toBe("Ilūkstes iela 16");
    expect(cyr.event!.summary).toContain("Ilūkstes iela 16");
    expect(cyr.telegram[0]!.text).toContain("Ilūkstes iela 16");
    expect(JSON.stringify([cyr.leads, cyr.event, cyr.telegram])).not.toMatch(/улица Илукстес|дом шестнадцать/);
    expect(cyr.h.world.count).toBe(5); // token, freeBusy, insert, sheets, telegram: the setting costs no subrequest
  });

  it("an address the agent passes in Latin without a building_id is spoken in Cyrillic; the Sheet keeps what was passed", async () => {
    const { r, leads } = await book("cyrillic", { address_spoken: "Brīvības iela 100", building_id: undefined });
    expect(r.body.ok).toBe(true);
    expect(r.body.say_ru).toBe(fillTemplate(PHRASES.booking_ok.ru, { address: "улица Бривибас, дом сто", slot: r.body.slot.label_ru }));
    expect(r.body.say_lv).toBe(fillTemplate(PHRASES.booking_ok.lv, { address: "Brīvības iela 100", slot: r.body.slot.label_lv }));
    expect(leads[0]![LEADS_HEADERS.indexOf("address")]).toBe("Brīvības iela 100");
    const lat = await book("latin", { address_spoken: "Brīvības iela 100", building_id: undefined });
    expect(lat.r.body.say_ru).toContain("Brīvības iela 100");
  });

  it("an address already in Russian is left alone in both modes", async () => {
    for (const mode of ["latin", "cyrillic"]) {
      const { r } = await book(mode, { address_spoken: "Илукстес 16", building_id: undefined });
      expect(r.body.say_ru, mode).toBe(fillTemplate(PHRASES.booking_ok.ru, { address: "Илукстес 16", slot: r.body.slot.label_ru }));
    }
  });

  it("the replayed booking and the moved booking speak the Cyrillic address too; Telegram stays Latin", async () => {
    const h = await harness({}, env("cyrillic"));
    const first = await h.call("book_inspection", bookingBody("s-re", { building_id: ILUKSTES_16 }));
    const replay = await h.call("book_inspection", bookingBody("s-re", { building_id: ILUKSTES_16 }));
    const moved = await h.call("book_inspection", bookingBody("s-re", { building_id: ILUKSTES_16, slot_start: "2026-10-07T14:00:00+03:00" }));
    await h.flush();
    expect(replay.body).toMatchObject({ ok: true, replayed: true });
    expect(moved.body).toMatchObject({ ok: true, replayed: false, booking_id: first.body.booking_id });
    for (const r of [first, replay, moved]) {
      expect(r.body.say_ru).toContain("улица Илукстес, дом шестнадцать");
      expect(r.body.say_lv).toContain("Ilūkstes iela 16");
    }
    expect(moved.body.say_ru).toContain(moved.body.slot.label_ru);
    expect(h.world.telegram[1]!.text).toContain("Перенос осмотра");
    expect(h.world.telegram.map((m) => m.text).join("\n")).not.toContain("улица Илукстес");
  });
});

describe("the other tools are untouched", () => {
  it("quote_range and get_slots answer the same in both modes", async () => {
    const lat = await harness({}, env("latin"));
    const cyr = await harness({}, env("cyrillic"));
    for (const [tool, body] of [["quote_range", { ...base("s1"), floors: 9, stairwells: 4, apartments: 141 }], ["get_slots", base("s1")]] as const) {
      const a = await lat.call(tool, body);
      const b = await cyr.call(tool, body);
      expect(b.body, tool).toEqual(a.body);
    }
  });
});
