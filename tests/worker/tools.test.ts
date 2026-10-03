import { describe, expect, it } from "vitest";
import { TOOL_NAMES, parseResponse, type ToolName } from "../../src/contract";
import { PHRASES } from "../../src/copy/phrases";
import { demoWorksRows } from "../../src/lib/works";
import { base, bookingBody, harness, NOW, SLOT, TOOL_KEY } from "./helpers";

const MAX_SUBREQUESTS = 6;

describe("auth", () => {
  it("401 only for a bad or missing key; CRLF in the stored secret is trimmed", async () => {
    const h = await harness();
    expect((await h.call("quote_range", { ...base("c1"), floors: 9, stairwells: 4, apartments: 141 }, { key: "wrong" })).status).toBe(401);
    expect((await h.call("quote_range", { ...base("c1"), floors: 9, stairwells: 4, apartments: 141 }, { key: null })).status).toBe(401);
    expect((await h.call("quote_range", { ...base("c1"), floors: 9, stairwells: 4, apartments: 141 }, { key: `${TOOL_KEY}\r\n` })).status).toBe(200);
    expect(h.world.count).toBe(0);
  });

  it("an empty configured key never matches an empty header", async () => {
    const h = await harness({}, { SCG_TOOL_KEY: "" });
    expect((await h.call("quote_range", { ...base("c1"), floors: 9, stairwells: 4, apartments: 141 }, { key: "" })).status).toBe(401);
  });

  it("a web key selects the web channel", async () => {
    const h = await harness({}, { SCG_TOOL_KEY_WEB: "web-key" });
    await h.call("get_slots", base("web1"), { key: "web-key" }); // warms nothing special; just must be accepted
    expect((await h.call("quote_range", { ...base("c1"), floors: 9, stairwells: 4, apartments: 141 }, { key: "web-key" })).status).toBe(200);
  });
});

describe("envelope: always HTTP 200 with a say for the caller", () => {
  it("unknown tool, bad JSON and schema errors are 200 invalid_input", async () => {
    const h = await harness();
    const a = await h.call("nope", {});
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ ok: false, v: 1, error: { code: "invalid_input" } });
    const r = await h.request("/tools/quote_range", { method: "POST", headers: { "x-scg-key": TOOL_KEY }, body: "{not json" });
    expect(r.status).toBe(200);
    const b = await h.call("quote_range", { ...base("c1"), floors: "x" });
    expect(b.body.ok).toBe(false);
    expect(b.body.error.code).toBe("invalid_input");
    expect(b.body.say_ru).toBeTruthy();
    expect(JSON.stringify(b.body)).not.toContain('"x"'); // submitted values are never echoed
  });
});

describe("success path of every M1 tool", () => {
  it("lookup_building: found + facts only from sourced fields; warms the Google token in the background", async () => {
    const h = await harness();
    const r = await h.call("lookup_building", { ...base("c1"), address: "Илукстес 16" });
    parseResponse("lookup_building", r.body);
    expect(r.body).toMatchObject({ ok: true, status: "found" });
    expect(r.body.building.address).toBe("Ilūkstes iela 16");
    expect(r.body.say_ru).toContain("9 этажей");
    await h.flush();
    expect(h.world.urls.filter((u) => u.includes("oauth2")).length).toBe(1);
    expect(h.world.count).toBeLessThanOrEqual(MAX_SUBREQUESTS);
  });

  it("lookup_building: a number that is not in `sourced` comes back as null (Parauga iela 7 has unsourced apartments)", async () => {
    const h = await harness();
    const r = await h.call("lookup_building", { ...base("c1"), address: "Parauga iela 7" });
    parseResponse("lookup_building", r.body);
    expect(r.body.building.address).toBe("Parauga iela 7");
    for (const f of ["floors", "stairwells", "apartments"]) if (!r.body.building.sourced.includes(f)) expect(r.body.building[f], f).toBeNull();
    expect(r.body.building.apartments).toBeNull();
  });

  it("lookup_building: need_house and not_found", async () => {
    const h = await harness();
    const a = await h.call("lookup_building", { ...base("c1"), address: "Ilūkstes iela" });
    expect(a.body.status).toBe("need_house");
    parseResponse("lookup_building", a.body);
    const b = await h.call("lookup_building", { ...base("c1"), address: "Abrakadabra iela 99" });
    expect(b.body.status).toBe("not_found");
    expect(b.body.building).toBeNull();
  });

  it("quote_range: price from code, hedged, net and incl. VAT", async () => {
    const h = await harness();
    const r = await h.call("quote_range", { ...base("c1"), floors: 9, stairwells: 4, apartments: 141 });
    parseResponse("quote_range", r.body);
    expect(r.body.ok).toBe(true);
    expect(r.body.say_ru).toMatch(/^Ориентировочно/);
    expect(r.body.say_ru).toContain("с НДС 21%");
    expect(r.body.say_ru).toContain("Точную цену даст инженер после бесплатного осмотра");
    expect(r.body.say_lv).toMatch(/^Orientējoši/);
    expect(r.body.say_ru).toContain(String(r.body.figures.low_net));
    expect(h.world.count).toBe(0);
  });

  it("get_slots: up to 3 slots, today in Riga time, 2 subrequests on a cold token", async () => {
    const h = await harness();
    const r = await h.call("get_slots", base("c1"));
    parseResponse("get_slots", r.body);
    expect(r.body.ok).toBe(true);
    expect(r.body.slots).toHaveLength(3);
    expect(r.body.today.date).toBe("2026-10-05");
    expect(r.body.office_open_now).toBe(true);
    expect(r.body.say_ru).toContain(r.body.slots[0].label_ru);
    expect(h.world.count).toBe(2); // token + freeBusy
  });

  it("get_slots honours weekday / part_of_day filters", async () => {
    const h = await harness();
    const r = await h.call("get_slots", { ...base("c1"), weekday: "thu", part_of_day: "morning" });
    expect(r.body.slots[0].start).toBe("2026-10-08T09:00:00+03:00");
  });

  it("book_inspection: Calendar synchronous, Leads row + Telegram in the background, ≤ 6 subrequests cold", async () => {
    const h = await harness();
    const r = await h.call("book_inspection", bookingBody("c-book"));
    parseResponse("book_inspection", r.body);
    expect(r.body).toMatchObject({ ok: true, replayed: false });
    expect(r.body.slot.start).toBe(SLOT);
    expect(r.body.say_ru).toContain(r.body.slot.label_ru);
    // Calendar written before the answer
    expect(h.world.events.size).toBe(1);
    const ev = [...h.world.events.values()][0]!;
    expect(ev.id).toMatch(/^[0-9a-f]{32}$/);
    expect(ev.summary).toBe("Осмотр: Илукстес 16 · 9 эт., 4 под. [ДЕМО]");
    expect(ev.description.endsWith("Записала ИИ-ассистент Анна")).toBe(true);
    expect(ev.description).toContain("Ориентировочно");
    expect(ev.extendedProperties?.private).toMatchObject({ conversation_id: "c-book", is_test: "false" });
    await h.flush();
    expect(h.world.tabs.Leads).toHaveLength(1);
    expect(h.world.tabs.Leads[0]![20]).toBe(r.body.booking_id); // lead_id column
    expect(h.world.tabs.Leads[0]![24]).toBe(""); // is_test is the LAST column
    expect(h.world.telegram).toHaveLength(1);
    const t = h.world.telegram[0]!;
    expect(t.chat_id).toBe("-100111");
    expect(t.text).toContain("<b>Новая заявка</b>: Илукстес 16, 9 эт., 4 под., 141 кв., член правления / старший по дому");
    expect(t.text).toContain("осмотр вторник, 6 октября, 10:00");
    expect(t.text.endsWith(`ДЕМО · ${r.body.booking_id}`)).toBe(true);
    expect(h.world.count).toBeLessThanOrEqual(MAX_SUBREQUESTS);
    expect(h.world.count).toBe(5); // token, freeBusy, insert, sheets, telegram
  });

  it("book_inspection with a [TEST] conversation goes to the test chat only and is flagged", async () => {
    const h = await harness();
    const r = await h.call("book_inspection", bookingBody("[TEST]-1"));
    expect(r.body.ok).toBe(true);
    await h.flush();
    expect(h.world.telegram.map((m) => m.chat_id)).toEqual(["555"]);
    expect(h.world.telegram[0]!.text.startsWith("[TEST] ")).toBe(true);
    expect(h.world.tabs.Leads[0]![24]).toBe("TRUE");
    expect([...h.world.events.values()][0]!.summary.startsWith("[TEST] ")).toBe(true);
  });

  it("book_inspection validates consent and phone before touching Google", async () => {
    const h = await harness();
    const a = await h.call("book_inspection", bookingBody("c1", { consent: false }));
    expect(a.body.error.code).toBe("consent_required");
    const b = await h.call("book_inspection", bookingBody("c1", { phone: "123456" }));
    expect(b.body.error.code).toBe("invalid_phone");
    expect(h.world.count).toBe(0);
  });

  it("book_inspection: Telegram text is HTML-escaped", async () => {
    const h = await harness();
    await h.call("book_inspection", bookingBody("c-esc", { name: "A<b>&", notes: "<script>" }));
    await h.flush();
    const text = h.world.telegram[0]!.text;
    expect(text).toContain("A&lt;b&gt;&amp;");
    expect(text).toContain("&lt;script&gt;");
    expect(text).not.toContain("<script>");
  });

  describe("works flow (demo rows in the Works tab)", () => {
    const seed = (h: Awaited<ReturnType<typeof harness>>) => {
      const rows = demoWorksRows("2026-10-05", "demo-parauga-iela-7");
      h.world.tabs.Works = rows.map((w) => [w.building_id, w.address_lv, w.stairwell, w.apt_from, w.apt_to, w.start_date, w.end_date, w.apts_per_day, w.window, w.foreman_label, w.status, ""]);
    };

    it("find_works_schedule by address, then reschedule_access writes the Access row + Telegram", async () => {
      const h = await harness();
      seed(h);
      const f = await h.call("find_works_schedule", { ...base("c-w"), apartment: 12, address: "Parauga iela 7" });
      parseResponse("find_works_schedule", f.body);
      expect(f.body).toMatchObject({ ok: true, found: true, building_id: "demo-parauga-iela-7", stairwell: 1, rescheduled: false });
      expect(f.body.options.length).toBeGreaterThan(0);
      expect(f.body.say_ru).toContain("Квартира 12, подъезд 1");
      expect(h.world.count).toBe(2); // token + batchGet

      const pick = f.body.options[0];
      const r = await h.call("reschedule_access", { ...base("c-w"), building_id: "demo-parauga-iela-7", apartment: 12, new_date: pick.date, new_window: pick.window });
      parseResponse("reschedule_access", r.body);
      expect(r.body).toMatchObject({ ok: true, date: pick.date, window: pick.window });
      expect(h.world.tabs.Access).toHaveLength(1);
      await h.flush();
      const t = h.world.telegram[0]!;
      expect(t.text).toContain("Прорабу: в пилоте — SMS");
      expect(t.text.endsWith(`ДЕМО · ${r.body.access_id}`)).toBe(true);

      // the new time is now the current one
      const again = await h.call("find_works_schedule", { ...base("c-w"), apartment: 12, building_id: "demo-parauga-iela-7" });
      expect(again.body).toMatchObject({ date: pick.date, rescheduled: true });
    });

    it("find_works_schedule: unknown apartment or real building -> found:false, never invented", async () => {
      const h = await harness();
      seed(h);
      const a = await h.call("find_works_schedule", { ...base("c1"), apartment: 999, address: "Parauga iela 7" });
      expect(a.body).toMatchObject({ ok: true, found: false, options: [] });
      expect(a.body.say_ru).toBe(PHRASES.works_not_found.ru);
      const b = await h.call("find_works_schedule", { ...base("c1"), apartment: 5, address: "Илукстес 16" });
      expect(b.body.found).toBe(false);
    });

    it("reschedule_access rejects a date outside the works period", async () => {
      const h = await harness();
      seed(h);
      const r = await h.call("reschedule_access", { ...base("c1"), building_id: "demo-parauga-iela-7", apartment: 12, new_date: "2027-02-02", new_window: "09:00-13:00" });
      expect(r.body.error.code).toBe("invalid_reschedule");
      const n = await h.call("reschedule_access", { ...base("c1"), building_id: "nope", apartment: 12, new_date: "2026-10-13", new_window: "09:00-13:00" });
      expect(n.body.error.code).toBe("not_found");
    });
  });

  it("request_callback: Callbacks row + Telegram, 3 subrequests cold", async () => {
    const h = await harness();
    const r = await h.call("request_callback", { ...base("c-cb"), reason: "human_requested", summary_ru: "Хочет поговорить с человеком про смету.", phone: "29327275", consent: true, name: "Пётр" });
    parseResponse("request_callback", r.body);
    expect(r.body.ok).toBe(true);
    expect(h.world.tabs.Callbacks).toHaveLength(1);
    expect(h.world.tabs.Callbacks[0]![7]).toBe("+37129327275");
    expect(h.world.telegram[0]!.text).toContain("Просьба перезвонить");
    expect(h.world.telegram[0]!.text.endsWith(`ДЕМО · ${r.body.callback_id}`)).toBe(true);
    expect(h.world.count).toBe(3);
    const bad = await h.call("request_callback", { ...base("c-cb"), reason: "x", summary_ru: "y", phone: "123456", consent: true });
    expect(bad.body.error.code).toBe("invalid_phone");
    const noc = await h.call("request_callback", { ...base("c-cb"), reason: "x", summary_ru: "y", phone: "29327275", consent: false });
    expect(noc.body.error.code).toBe("consent_required");
  });
});

describe("timeouts fall back to a phrase the agent can read", () => {
  it("Google freeBusy hangs -> calendar_down with the calendar_down phrase (get_slots and book_inspection)", async () => {
    const h = await harness({ hang: (u) => u.includes("freeBusy") });
    const lim = { googleMs: 40, toolMs: 400 };
    const a = await h.call("get_slots", base("c1"), { limits: lim });
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ ok: false, error: { code: "calendar_down" }, say_ru: PHRASES.calendar_down.ru, say_lv: PHRASES.calendar_down.lv });
    parseResponse("get_slots", a.body);
    const b = await h.call("book_inspection", bookingBody("c-to"), { limits: lim });
    expect(b.body.error.code).toBe("calendar_down");
    expect(h.world.events.size).toBe(0);
  });

  it("the whole-tool deadline fires even if every call hangs", async () => {
    const h = await harness({ hang: () => true });
    const r = await h.call("get_slots", base("c1"), { limits: { googleMs: 5000, toolMs: 60 } });
    expect(r.body).toMatchObject({ ok: false, error: { code: "calendar_down" } });
  });

  it("Sheets hang on a Sheets-based tool -> internal_error + generic phrase", async () => {
    const h = await harness({ hang: (u) => u.includes("sheets.googleapis") });
    const r = await h.call("find_works_schedule", { ...base("c1"), apartment: 3, address: "Parauga iela 7" }, { limits: { googleMs: 40, toolMs: 400 } });
    expect(r.body).toMatchObject({ ok: false, error: { code: "internal_error" }, say_ru: PHRASES.tool_error_generic.ru });
  });

  it("a Google 500 is calendar_down, not a crash", async () => {
    const h = await harness({ status: (u) => (u.includes("freeBusy") ? 500 : null) });
    const r = await h.call("get_slots", base("c1"));
    expect(r.status).toBe(200);
    expect(r.body.error.code).toBe("calendar_down");
  });
});

describe("subrequest budget: every tool stays within 6 fetches per call (cold token included)", () => {
  const cases: Record<ToolName, (h: Awaited<ReturnType<typeof harness>>) => Promise<unknown>> = {
    lookup_building: (h) => h.call("lookup_building", { ...base("s1"), address: "Илукстес 16" }),
    quote_range: (h) => h.call("quote_range", { ...base("s1"), floors: 5, stairwells: 2, apartments: 40 }),
    get_slots: (h) => h.call("get_slots", base("s1")),
    book_inspection: (h) => h.call("book_inspection", bookingBody("s1")),
    find_works_schedule: (h) => h.call("find_works_schedule", { ...base("s1"), apartment: 3, address: "Parauga iela 7" }),
    reschedule_access: (h) => h.call("reschedule_access", { ...base("s1"), building_id: "demo-parauga-iela-7", apartment: 3, new_date: "2026-10-13", new_window: "09:00-13:00" }),
    request_callback: (h) => h.call("request_callback", { ...base("s1"), reason: "x", summary_ru: "y", phone: "29327275", consent: true }),
  };
  for (const name of TOOL_NAMES) {
    it(name, async () => {
      const h = await harness();
      const rows = demoWorksRows("2026-10-05", "demo-parauga-iela-7");
      h.world.tabs.Works = rows.map((w) => [w.building_id, w.address_lv, w.stairwell, w.apt_from, w.apt_to, w.start_date, w.end_date, w.apts_per_day, w.window, w.foreman_label, w.status, ""]);
      await cases[name](h);
      await h.flush();
      expect(h.world.count, `${name}: ${h.world.urls.join(" | ")}`).toBeLessThanOrEqual(MAX_SUBREQUESTS);
    });
  }
});

describe("misc", () => {
  it("NOW is a Monday before the first slot", () => {
    expect(NOW.getUTCDay()).toBe(1);
  });
});
