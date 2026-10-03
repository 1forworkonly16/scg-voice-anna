// M2 tools: create_ticket and log_request, against the fake Google + Telegram world (no network).
import { describe, expect, it } from "vitest";
import { parseResponse } from "../../src/contract";
import { PHRASES_M2 } from "../../src/copy/phrases_m2";
import { demoWorksRows } from "../../src/lib/works";
import { base, harness, TOOL_KEY } from "./helpers";

type H = Awaited<ReturnType<typeof harness>>;

const seedWorks = (h: H) => {
  const rows = demoWorksRows("2026-10-05", "demo-parauga-iela-7");
  h.world.tabs.Works = rows.map((w) => [w.building_id, w.address_lv, w.stairwell, w.apt_from, w.apt_to, w.start_date, w.end_date, w.apts_per_day, w.window, w.foreman_label, w.status, ""]);
};

const leak = (conv: string, over: Record<string, unknown> = {}) => ({
  ...base(conv),
  type: "leak",
  urgency: "urgent",
  description: "После замены стояка течёт с потолка в ванной.",
  address: "Parauga iela 7",
  apartment: 12,
  ...over,
});

// Tickets columns: 0 timestamp, 1 ticket_id, 2 conversation_id, 3 language, 4 type, 5 urgency, 6 escalated, 7 address, 8 building_id,
// 9 apartment, 10 scg_site, 11 description, 12 status, 13 is_test
describe("create_ticket", () => {
  it("leak at a known SCG site: escalated, «СРОЧНО» alert to the real chat, Tickets row, 4 subrequests cold", async () => {
    const h = await harness();
    seedWorks(h);
    const r = await h.call("create_ticket", leak("c-leak"));
    parseResponse("create_ticket", r.body);
    expect(r.body).toMatchObject({ ok: true, v: 1, scg_site: true, escalated: true, replayed: false });
    expect(r.body.ticket_id).toMatch(/^T-[0-9A-F]{6}$/);
    expect(r.body.say_ru).toBe(PHRASES_M2.ticket_urgent.ru);
    expect(r.body.say_lv).toBe(PHRASES_M2.ticket_urgent.lv);
    expect(h.world.tabs.Tickets).toHaveLength(1);
    const row = h.world.tabs.Tickets[0]!;
    expect(row).toHaveLength(14);
    expect(row.slice(1, 13)).toEqual([r.body.ticket_id, "c-leak", "ru", "leak", "urgent", "TRUE", "Parauga iela 7", "demo-parauga-iela-7", 12, "TRUE", "После замены стояка течёт с потолка в ванной.", "escalated"]);
    expect(row[13]).toBe("");
    expect(h.world.telegram).toHaveLength(1);
    const t = h.world.telegram[0]!;
    expect(t.chat_id).toBe("-100111");
    expect(t.text.startsWith("<b>СРОЧНО</b>: течь / протечка")).toBe(true);
    expect(t.text).toContain("Адрес: Parauga iela 7, кв. 12");
    expect(t.text).toContain("Объект SCG: да");
    expect(t.text).toContain("Дежурный мастер: [уточнить]"); // unknown on-call is a visible placeholder, never invented
    expect(t.text.endsWith(`ДЕМО · ${r.body.ticket_id}`)).toBe(true);
    expect(h.world.count).toBe(4); // token, batchGet, append, Telegram
  });

  it("safety net: a complaint that describes a leak is escalated even if the model said normal", async () => {
    const h = await harness();
    seedWorks(h);
    const r = await h.call("create_ticket", leak("c-net", { type: "complaint", urgency: "normal", description: "Сосед жалуется: после замены течёт с потолка" }));
    expect(r.body).toMatchObject({ ok: true, escalated: true });
    expect(h.world.tabs.Tickets[0]![5]).toBe("urgent");
    expect(h.world.telegram[0]!.text).toContain("<b>СРОЧНО</b>");
  });

  it("urgent without a leak word is also an alert", async () => {
    const h = await harness();
    seedWorks(h);
    const r = await h.call("create_ticket", leak("c-urg", { type: "maintenance", urgency: "urgent", description: "Нет холодной воды во всём стояке" }));
    expect(r.body).toMatchObject({ ok: true, escalated: true });
    expect(h.world.telegram[0]!.text).toContain("<b>СРОЧНО</b>: заявка на обслуживание");
  });

  it("normal ticket: row + plain notice, no «СРОЧНО», no urgent speech", async () => {
    const h = await harness();
    seedWorks(h);
    const r = await h.call("create_ticket", leak("c-norm", { type: "maintenance", urgency: "normal", description: "Подтекает смеситель, нужен мастер" }));
    // "Подтекает" is not a leak word; make sure the plain path is really plain
    expect(r.body).toMatchObject({ ok: true, escalated: false, scg_site: true });
    expect(r.body.say_ru).toBe(PHRASES_M2.ticket_ok.ru);
    expect(h.world.tabs.Tickets[0]![12]).toBe("new");
    expect(h.world.tabs.Tickets[0]![6]).toBe("FALSE");
    const t = h.world.telegram[0]!.text;
    expect(t).toContain("<b>Новая заявка (обращение)</b>");
    expect(t).not.toContain("СРОЧНО");
    expect(t).not.toContain("[уточнить]");
  });

  it("a leak at a building that is not on the SCG list: alert still goes out, speech refers to the manager's emergency service", async () => {
    const h = await harness();
    seedWorks(h);
    const r = await h.call("create_ticket", leak("c-other", { address: "Илукстес 16", apartment: undefined }));
    expect(r.body).toMatchObject({ ok: true, escalated: true, scg_site: false });
    expect(r.body.say_ru).toBe(PHRASES_M2.ticket_urgent_other.ru);
    expect(r.body.say_ru).toContain("аварийную службу вашего управляющего");
    expect(h.world.tabs.Tickets[0]![7]).toBe("Ilūkstes iela 16");
    expect(h.world.tabs.Tickets[0]![10]).toBe("FALSE");
    expect(h.world.telegram[0]!.text).toContain("Объект SCG: нет в списке объектов");
  });

  it("an address that matches nothing: scg_site null (unknown), spoken address kept", async () => {
    const h = await harness();
    seedWorks(h);
    const r = await h.call("create_ticket", leak("c-unk", { address: "Abrakadabra iela 99" }));
    expect(r.body).toMatchObject({ ok: true, scg_site: null, escalated: true });
    expect(h.world.tabs.Tickets[0]![7]).toBe("Abrakadabra iela 99");
    expect(h.world.tabs.Tickets[0]![10]).toBe("");
    expect(h.world.telegram[0]!.text).toContain("Объект SCG: не удалось проверить");
  });

  it("[TEST] traffic: test chat only, [TEST] prefix, is_test flag on the row", async () => {
    const h = await harness();
    seedWorks(h);
    const r = await h.call("create_ticket", leak("[TEST]-7"));
    expect(r.body.ok).toBe(true);
    expect(h.world.telegram.map((m) => m.chat_id)).toEqual(["555"]);
    expect(h.world.telegram[0]!.text.startsWith("[TEST] <b>СРОЧНО</b>")).toBe(true);
    expect(h.world.tabs.Tickets[0]![13]).toBe("TRUE");
  });

  it("[TEST] traffic without a configured test chat is dropped, not sent to the real chat, and is not reported as a failed alert", async () => {
    const h = await harness({}, { TELEGRAM_TEST_CHAT_ID: "" });
    seedWorks(h);
    const r = await h.call("create_ticket", leak("[TEST]-8"));
    expect(h.world.telegram).toHaveLength(0);
    expect(r.body.say_ru).toBe(PHRASES_M2.ticket_urgent.ru);
  });

  it("idempotent: the same conversation re-sending the ticket gets the same id, replayed:true, no second row or alert", async () => {
    const h = await harness();
    seedWorks(h);
    const a = await h.call("create_ticket", leak("c-idem"));
    h.world.reset();
    const b = await h.call("create_ticket", leak("c-idem", { description: "Течёт с потолка (повтор)" }));
    expect(b.body).toMatchObject({ ok: true, replayed: true, escalated: true, scg_site: true, ticket_id: a.body.ticket_id });
    expect(h.world.tabs.Tickets).toHaveLength(1);
    expect(h.world.telegram).toHaveLength(1);
    expect(h.world.urls.some((u) => u.includes("append"))).toBe(false);
    // a different conversation is a different ticket
    const c = await h.call("create_ticket", leak("c-idem-2"));
    expect(c.body.ticket_id).not.toBe(a.body.ticket_id);
    expect(h.world.tabs.Tickets).toHaveLength(2);
  });

  it("data minimisation: phone numbers in free text are redacted before the Sheet and Telegram; the schema has no name or phone field", async () => {
    const h = await harness();
    seedWorks(h);
    await h.call("create_ticket", leak("c-pii", { description: "Течёт. Звонить на 22848144 или +371 29 327 275, кв. 12" }));
    const joined = JSON.stringify(h.world.tabs.Tickets) + h.world.telegram[0]!.text;
    expect(joined).not.toMatch(/22848144|29 327 275|29327275/);
    expect(joined).toContain("[номер скрыт]");
    expect(joined).toContain("кв. 12");
  });

  it("Telegram text is HTML-escaped", async () => {
    const h = await harness();
    seedWorks(h);
    await h.call("create_ticket", leak("c-esc", { description: "Течёт <script>&" }));
    expect(h.world.telegram[0]!.text).toContain("&lt;script&gt;&amp;");
    expect(h.world.telegram[0]!.text).not.toContain("<script>");
  });

  it("urgent but the Telegram alert fails: the ticket is still recorded and Anna does not claim it was passed on", async () => {
    const h = await harness({ status: (u) => (u.includes("api.telegram.org") ? 500 : null) });
    seedWorks(h);
    const r = await h.call("create_ticket", leak("c-tgfail"));
    expect(r.body).toMatchObject({ ok: true, escalated: true });
    expect(r.body.say_ru).toBe(PHRASES_M2.ticket_alert_failed.ru);
    expect(h.world.tabs.Tickets).toHaveLength(1);
  });

  it("Sheets down but the alert delivered: still ok (scg_site unknown); both down: internal_error with the generic phrase", async () => {
    const h = await harness({ status: (u) => (u.includes("sheets.googleapis") ? 500 : null) });
    const r = await h.call("create_ticket", leak("c-sheetdown"));
    expect(r.body).toMatchObject({ ok: true, escalated: true, scg_site: null });
    expect(h.world.telegram).toHaveLength(1);
    const h2 = await harness({ status: (u) => (u.includes("sheets.googleapis") || u.includes("api.telegram.org") ? 500 : null) });
    const r2 = await h2.call("create_ticket", leak("c-bothdown"));
    expect(r2.status).toBe(200);
    expect(r2.body).toMatchObject({ ok: false, error: { code: "internal_error" } });
    expect(r2.body.say_ru).toBeTruthy();
  });

  it("invalid input: HTTP 200 invalid_input, submitted values never echoed, Google never touched", async () => {
    const h = await harness();
    for (const bad of [
      { ...base("c1"), type: "leak", urgency: "urgent", address: "Parauga iela 7" }, // no description
      { ...leak("c1"), type: "explosion" },
      { ...leak("c1"), urgency: "asap" },
      { ...leak("c1"), apartment: 12.5 },
      { ...leak("c1"), description: "" },
      { type: "leak", urgency: "urgent", description: "x", address: "y" }, // no conversation_id / language
    ]) {
      const r = await h.call("create_ticket", bad);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ ok: false, error: { code: "invalid_input" } });
      expect(r.body.say_ru).toBeTruthy();
    }
    const echo = await h.call("create_ticket", { ...leak("c1"), type: "SECRETVALUE" });
    expect(JSON.stringify(echo.body)).not.toContain("SECRETVALUE");
    expect(h.world.count).toBe(0);
  });

  it("401 only for a bad key", async () => {
    const h = await harness();
    expect((await h.call("create_ticket", leak("c1"), { key: "wrong" })).status).toBe(401);
    expect((await h.call("log_request", { ...base("c1"), kind: "b2b", summary_ru: "x" }, { key: null })).status).toBe(401);
    expect((await h.call("create_ticket", leak("c1"), { key: `${TOOL_KEY}\r\n` })).status).toBe(200);
  });
});

// Requests columns: 0 timestamp, 1 request_id, 2 conversation_id, 3 language, 4 kind, 5 summary_ru, 6 status, 7 is_test
describe("log_request", () => {
  it("b2b: Requests row + short Telegram notice, 4 subrequests cold", async () => {
    const h = await harness();
    const r = await h.call("log_request", { ...base("c-b2b", "en"), kind: "b2b", summary_ru: "Шведский подрядчик ищет 4 сварщиков TIG на март." });
    parseResponse("log_request", r.body);
    expect(r.body).toMatchObject({ ok: true, replayed: false });
    expect(r.body.request_id).toMatch(/^R-[0-9A-F]{6}$/);
    expect(r.body.say_ru).toBe(PHRASES_M2.request_ok.ru);
    expect(h.world.tabs.Requests).toHaveLength(1);
    expect(h.world.tabs.Requests[0]).toEqual([expect.any(String), r.body.request_id, "c-b2b", "en", "b2b", "Шведский подрядчик ищет 4 сварщиков TIG на март.", "new", ""]);
    const t = h.world.telegram[0]!;
    expect(t.chat_id).toBe("-100111");
    expect(t.text).toContain("<b>Новое обращение</b>: запрос B2B / проект");
    expect(t.text).not.toContain("СРОЧНО");
    expect(t.text.endsWith(`ДЕМО · ${r.body.request_id}`)).toBe(true);
    expect(h.world.count).toBe(4);
  });

  it("every kind has a Russian label; emergency_referral speaks the referral phrase and does not promise a transfer", async () => {
    const h = await harness();
    for (const kind of ["job_candidate", "admin_message", "other"]) {
      const r = await h.call("log_request", { ...base(`c-${kind}`), kind, summary_ru: "Сварщик MMA/TIG, русский и латышский." });
      expect(r.body.ok, kind).toBe(true);
    }
    const e = await h.call("log_request", { ...base("c-em"), kind: "emergency_referral", summary_ru: "Затопило подвал, дом не клиент SCG." });
    expect(e.body.say_ru).toBe(PHRASES_M2.request_emergency_referral.ru);
    expect(e.body.say_lv).toBe(PHRASES_M2.request_emergency_referral.lv);
    expect(e.body.say_ru).not.toMatch(/соедин|перевед/i);
    expect(h.world.tabs.Requests).toHaveLength(4);
    expect(h.world.telegram.map((m) => m.text).some((t) => t.includes("не клиент SCG, направлен в аварийную службу управляющего"))).toBe(true);
  });

  it("[TEST] traffic: test chat only, flagged row", async () => {
    const h = await harness();
    await h.call("log_request", { ...base("[TEST]-9"), kind: "admin_message", summary_ru: "Поставщик предлагает трубы." });
    expect(h.world.telegram.map((m) => m.chat_id)).toEqual(["555"]);
    expect(h.world.telegram[0]!.text.startsWith("[TEST] ")).toBe(true);
    expect(h.world.tabs.Requests[0]![7]).toBe("TRUE");
  });

  it("idempotent replay: same conversation and kind -> same id, replayed:true, nothing written or sent again", async () => {
    const h = await harness();
    const body = { ...base("c-rep"), kind: "job_candidate", summary_ru: "Сварщик." };
    const a = await h.call("log_request", body);
    h.world.reset();
    const b = await h.call("log_request", { ...body, summary_ru: "Сварщик (повтор)." });
    expect(b.body).toMatchObject({ ok: true, replayed: true, request_id: a.body.request_id });
    expect(h.world.tabs.Requests).toHaveLength(1);
    expect(h.world.telegram).toHaveLength(1);
    expect(h.world.urls.some((u) => u.includes("append"))).toBe(false);
    // a different kind in the same conversation is a new request
    const c = await h.call("log_request", { ...body, kind: "b2b" });
    expect(c.body.request_id).not.toBe(a.body.request_id);
    expect(h.world.tabs.Requests).toHaveLength(2);
  });

  it("redacts phone numbers in the summary", async () => {
    const h = await harness();
    await h.call("log_request", { ...base("c-pii"), kind: "b2b", summary_ru: "Перезвонить на +46 70 123 45 67 или 22848144" });
    expect(JSON.stringify(h.world.tabs.Requests) + h.world.telegram[0]!.text).not.toMatch(/123 45 67|22848144/);
  });

  it("invalid input is a 200 invalid_input", async () => {
    const h = await harness();
    for (const bad of [{ ...base("c1"), kind: "sales", summary_ru: "x" }, { ...base("c1"), kind: "b2b" }, { ...base("c1"), kind: "b2b", summary_ru: "" }, { kind: "b2b", summary_ru: "x" }]) {
      const r = await h.call("log_request", bad);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    }
    expect(h.world.count).toBe(0);
  });

  it("Sheets and Telegram both down: internal_error; only one down: still ok", async () => {
    const h1 = await harness({ status: (u) => (u.includes("sheets.googleapis") ? 500 : null) });
    expect((await h1.call("log_request", { ...base("c1"), kind: "b2b", summary_ru: "x" })).body.ok).toBe(true);
    const h2 = await harness({ status: (u) => (u.includes("api.telegram.org") ? 500 : null) });
    expect((await h2.call("log_request", { ...base("c1"), kind: "b2b", summary_ru: "x" })).body.ok).toBe(true);
    const h3 = await harness({ status: (u) => (u.includes("sheets.googleapis") || u.includes("api.telegram.org") ? 500 : null) });
    expect((await h3.call("log_request", { ...base("c1"), kind: "b2b", summary_ru: "x" })).body).toMatchObject({ ok: false, error: { code: "internal_error" } });
  });
});

describe("admin test cleanup covers the new tabs", () => {
  it("cleanup removes [TEST] ticket and request rows", async () => {
    const h = await harness();
    seedWorks(h);
    await h.call("create_ticket", leak("[TEST]-c1"));
    await h.call("log_request", { ...base("[TEST]-c2"), kind: "b2b", summary_ru: "x" });
    await h.call("create_ticket", leak("real-1"));
    const res = await h.request("/admin/test/cleanup", { method: "POST", headers: { "x-admin-key": "admin-key-456" } });
    const b = (await res.json()) as any;
    expect(b.rows_deleted).toMatchObject({ Tickets: 1, Requests: 1 });
    expect(h.world.tabs.Tickets).toHaveLength(1);
    expect(h.world.tabs.Requests).toHaveLength(0);
  });
});
