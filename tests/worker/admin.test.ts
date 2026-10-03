import { describe, expect, it } from "vitest";
import { handleScheduled } from "../../src/index";
import { DEFAULT_LIMITS } from "../../src/routes/types";
import { ACCESS_HEADERS, CALLBACKS_HEADERS, CALLS_HEADERS, LEADS_HEADERS, SHEET_TABS, WORKS_HEADERS, columnLetter, headerRange } from "../../src/google/sheet_schema";
import { ADMIN_KEY, base, bookingBody, harness, NOW } from "./helpers";

const admin = (h: Awaited<ReturnType<typeof harness>>, path: string, method = "POST", key: string | null = ADMIN_KEY) =>
  h.request(path, { method, headers: key ? { "x-admin-key": key } : {} });

describe("sheet schema (single source for WP5)", () => {
  it("brief A's 20 columns come first, is_test is always last", () => {
    expect(LEADS_HEADERS.slice(0, 20)).toEqual([
      "timestamp", "channel", "language", "role", "address", "building_id", "floors", "apartments", "stairwells", "scope",
      "price_range", "decision_stage", "timing", "name", "phone", "email", "consent", "booked_slot", "status", "notes",
    ]);
    for (const h of Object.values(SHEET_TABS)) expect(h[h.length - 1]).toBe("is_test");
    expect(Object.keys(SHEET_TABS)).toEqual(["Leads", "Calls", "Works", "Access", "Callbacks"]);
    expect([CALLS_HEADERS, WORKS_HEADERS, ACCESS_HEADERS, CALLBACKS_HEADERS].every((h) => new Set(h).size === h.length)).toBe(true);
  });
  it("column letters and header ranges", () => {
    expect([columnLetter(1), columnLetter(26), columnLetter(27)]).toEqual(["A", "Z", "AA"]);
    expect(headerRange("Leads")).toBe("Leads!A1:Y1");
  });
});

describe("admin auth and health", () => {
  it("401 without or with a bad x-admin-key", async () => {
    const h = await harness();
    expect((await admin(h, "/admin/health", "GET", null)).status).toBe(401);
    expect((await admin(h, "/admin/health", "GET", "nope")).status).toBe(401);
    expect((await admin(h, "/admin/demo/reset-works", "POST", "nope")).status).toBe(401);
  });
  it("health reports names present/missing, never values; deep checks Google, headers and Telegram", async () => {
    const h = await harness();
    const res = await admin(h, "/admin/health?deep=1", "GET");
    const b = (await res.json()) as any;
    expect(b.ok).toBe(true);
    expect(b.configured.GOOGLE_SA_KEY_JSON).toBe(true);
    expect(b.deep.google_token).toEqual({ ok: true });
    expect(b.deep.calendar).toEqual({ ok: true });
    expect(Object.values(b.deep.sheet_headers).every(Boolean)).toBe(true);
    expect(b.deep.telegram).toEqual({ ok: true, username: "scg_test_bot" });
    expect(JSON.stringify(b)).not.toContain("TESTTOKEN");
    expect(JSON.stringify(b)).not.toContain("BEGIN PRIVATE KEY");
  });
});

describe("demo works", () => {
  it("reset-works writes 3 fictional stairwells and clears Access", async () => {
    const h = await harness();
    h.world.tabs.Access = [["old"]];
    const res = await admin(h, "/admin/demo/reset-works");
    expect(((await res.json()) as any).stairwells).toBe(3);
    expect(h.world.tabs.Works).toHaveLength(3);
    expect(h.world.tabs.Works[0]![0]).toBe("demo-parauga-iela-7");
    expect(h.world.tabs.Works[0]![1]).toBe("Parauga iela 7, Rīga");
    expect(h.world.tabs.Works[0]![10]).toBe("ДЕМО");
    expect(h.world.tabs.Works[0]![11]).toBe("");
    expect(h.world.tabs.Access).toEqual([]);
  });

  it("cron 0 4 * * *: keeps a future plan, resets a stale one", async () => {
    const h = await harness();
    const run = () => handleScheduled("0 4 * * *", h.env, { waitUntil: () => undefined }, { fetch: h.world.fetch, now: () => h.now.value, limits: DEFAULT_LIMITS });
    expect(await run()).toMatchObject({ action: "reset" }); // empty tab
    expect(await run()).toMatchObject({ action: "kept" });
    h.now.value = new Date(NOW.getTime() + 8 * 86400000); // the plan's first start (Mon 2026-10-12) is in the past now
    expect(await run()).toMatchObject({ action: "reset" });
    expect(h.world.tabs.Works[0]![5]).toBe("2026-10-19");
  });
});

describe("digest from real rows only", () => {
  it("counts today's real rows, ignores is_test and other days, ends with ДЕМО · D-<date>", async () => {
    const h = await harness();
    await h.call("book_inspection", bookingBody("real-1"));
    await h.call("book_inspection", bookingBody("[TEST]-2", { slot_start: "2026-10-07T10:00:00+03:00" }));
    await h.call("request_callback", { ...base("real-3"), reason: "x", summary_ru: "y", phone: "29327275", consent: true });
    await h.flush();
    h.world.tabs.Calls.push(["2026-10-05T05:00:00.000Z", "c1", "a", "ru", 60, "done", "success", "s", "{}", "{}", ""]); // 08:00 Riga: outside office hours
    h.world.tabs.Calls.push([NOW.toISOString(), "c2", "a", "ru", 60, "done", "success", "s", "{}", "{}", ""]);
    h.world.tabs.Calls.push([NOW.toISOString(), "c3", "a", "ru", 60, "done", "success", "s", "{}", "{}", "TRUE"]);
    h.world.tabs.Calls.push(["2026-10-01T10:00:00.000Z", "c4", "a", "ru", 60, "done", "success", "s", "{}", "{}", ""]); // another day
    h.world.telegram.length = 0;
    const res = await admin(h, "/admin/digest");
    const b = (await res.json()) as any;
    expect(b.stats).toMatchObject({ date: "2026-10-05", calls: 2, callsOutsideHours: 1, inspections: 1, callbacks: 1, accessChanges: 0, unknownQuestions: 1 });
    expect(b.sent.ok).toBe(true);
    expect(h.world.telegram).toHaveLength(1);
    expect(h.world.telegram[0]!.chat_id).toBe("-100111");
    expect(h.world.telegram[0]!.text).toContain("Записано осмотров: 1");
    expect(h.world.telegram[0]!.text.endsWith("ДЕМО · D-2026-10-05")).toBe(true);
  });

  it("GET is a dry run; ?test=1 goes to the test chat; cron 0 15 * * 1-5 sends", async () => {
    const h = await harness();
    const dry = (await (await admin(h, "/admin/digest", "GET")).json()) as any;
    expect(dry.dry).toBe(true);
    expect(h.world.telegram).toHaveLength(0);
    await admin(h, "/admin/digest?test=1");
    expect(h.world.telegram[0]!.chat_id).toBe("555");
    await handleScheduled("0 15 * * 1-5", h.env, { waitUntil: () => undefined }, { fetch: h.world.fetch, now: () => h.now.value, limits: DEFAULT_LIMITS });
    expect(h.world.telegram[1]!.chat_id).toBe("-100111");
    expect(h.world.telegram[1]!.text).toContain("Звонков: 0"); // empty sheet: honest zeros, nothing invented
  });
});

describe("test cleanup", () => {
  it("removes is_test rows from every tab and is_test events from the calendar, keeps real ones", async () => {
    const h = await harness();
    await h.call("book_inspection", bookingBody("real-1"));
    await h.call("book_inspection", bookingBody("[TEST]-9", { slot_start: "2026-10-07T10:00:00+03:00" }));
    await h.call("request_callback", { ...base("[TEST]-9"), reason: "x", summary_ru: "y", phone: "29327275", consent: true });
    await h.flush();
    expect(h.world.events.size).toBe(2);
    const res = await admin(h, "/admin/test/cleanup");
    const b = (await res.json()) as any;
    expect(b).toMatchObject({ ok: true, events_deleted: 1, rows_deleted: { Leads: 1, Callbacks: 1 } });
    expect(h.world.events.size).toBe(1);
    expect(h.world.tabs.Leads).toHaveLength(1);
    expect(h.world.tabs.Leads[0]![21]).toBe("real-1");
    expect(h.world.tabs.Callbacks).toHaveLength(0);
  });
});
