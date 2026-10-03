// M2 unit tests: contract schemas, phrase table, Sheet schema, leak detection, phone redaction, Telegram texts.
import { describe, expect, it } from "vitest";
import { TOOLS, parseResponse, toElevenLabsTool } from "../../src/contract";
import { PHRASES_M2, PHRASE_SPEC_M2 } from "../../src/copy/phrases_m2";
import { REQUESTS_HEADERS, SHEET_TABS, TICKETS_HEADERS, headerRange } from "../../src/google/sheet_schema";
import { placeholdersOf } from "../../src/lib/render";
import { looksLikeLeak, redactPhones } from "../../src/lib/ticket";
import { requestMessage, ticketMessage } from "../../src/notify/messages";

const base = { conversation_id: "conv_1", language: "ru" as const };
const env = { v: 1 as const, say_ru: "р", say_lv: "l", hint: "h" };

describe("M2 contract", () => {
  const t = { ...base, type: "leak", urgency: "urgent", description: "Течёт с потолка", address: "Parauga iela 7" };
  it("create_ticket: required set, enums, integer apartment", () => {
    expect(TOOLS.create_ticket.input.safeParse(t).success).toBe(true);
    expect(TOOLS.create_ticket.input.safeParse({ ...t, apartment: 12 }).success).toBe(true);
    for (const k of ["type", "urgency", "description", "address", "conversation_id", "language"]) {
      const { [k]: _omit, ...rest } = t as Record<string, unknown>;
      expect(TOOLS.create_ticket.input.safeParse(rest).success, k).toBe(false);
    }
    expect(TOOLS.create_ticket.input.safeParse({ ...t, type: "other" }).success).toBe(false);
    expect(TOOLS.create_ticket.input.safeParse({ ...t, urgency: "high" }).success).toBe(false);
    expect(TOOLS.create_ticket.input.safeParse({ ...t, apartment: 1.5 }).success).toBe(false);
    expect(TOOLS.create_ticket.input.safeParse({ ...t, description: "x".repeat(601) }).success).toBe(false);
  });
  it("create_ticket: no name or phone field (data minimisation)", () => {
    expect(Object.keys(TOOLS.create_ticket.input.shape).join(",")).not.toMatch(/name|phone|email/);
    expect(Object.keys(TOOLS.log_request.input.shape).join(",")).not.toMatch(/name|phone|email/);
  });
  it("log_request: kinds", () => {
    for (const kind of ["b2b", "job_candidate", "emergency_referral", "admin_message", "other"]) {
      expect(TOOLS.log_request.input.safeParse({ ...base, kind, summary_ru: "x" }).success, kind).toBe(true);
    }
    expect(TOOLS.log_request.input.safeParse({ ...base, kind: "sales", summary_ru: "x" }).success).toBe(false);
    expect(TOOLS.log_request.input.safeParse({ ...base, kind: "b2b" }).success).toBe(false);
  });
  it("outputs", () => {
    expect(parseResponse("create_ticket", { ok: true, ...env, ticket_id: "T-ABC123", scg_site: null, escalated: true, replayed: false }).ok).toBe(true);
    expect(() => parseResponse("create_ticket", { ok: true, ...env, ticket_id: "T-1", escalated: true })).toThrow();
    expect(parseResponse("log_request", { ok: true, ...env, request_id: "R-ABC123", replayed: false }).ok).toBe(true);
  });
  it("ElevenLabs definitions: 8 s timeout, conversation_id dynamic, enums carried", () => {
    const a = toElevenLabsTool("create_ticket");
    expect(a.response_timeout_secs).toBe(8);
    expect(a.api_schema.request_body_schema.properties.conversation_id!.dynamic_variable).toBe("system__conversation_id");
    expect(a.api_schema.request_body_schema.properties.type!.enum).toEqual(["complaint", "warranty", "maintenance", "leak"]);
    expect(a.api_schema.request_body_schema.properties.apartment!.type).toBe("integer");
    expect(toElevenLabsTool("log_request").api_schema.url).toBe("{base_url}/tools/log_request");
  });
});

describe("M2 phrases", () => {
  it("placeholder sets match the spec, both languages filled, no unresolved facts spoken", () => {
    for (const [key, entry] of Object.entries(PHRASES_M2)) {
      for (const lang of ["ru", "lv"] as const) {
        expect(entry[lang].trim().length, `${key}.${lang}`).toBeGreaterThan(20);
        expect(placeholdersOf(entry[lang]).sort(), `${key}.${lang}`).toEqual([...PHRASE_SPEC_M2[key as keyof typeof PHRASE_SPEC_M2]].sort());
        expect(entry[lang]).not.toMatch(/\[уточнить\]|SMS|смс|₽|евро|eiro/i);
      }
    }
  });
  it("no invented emergency numbers and no promised callback time or transfer", () => {
    for (const entry of Object.values(PHRASES_M2)) {
      expect(entry.ru).not.toMatch(/\d{3}/);
      expect(entry.ru).not.toMatch(/соединя|переключ|в течение|через \d+/i);
    }
  });
});

describe("Sheet schema M2", () => {
  it("Tickets and Requests: unique headers, is_test last, ranges", () => {
    for (const h of [TICKETS_HEADERS, REQUESTS_HEADERS]) {
      expect(new Set(h).size).toBe(h.length);
      expect(h[h.length - 1]).toBe("is_test");
      expect(h.join(",")).not.toMatch(/name|phone|email/);
    }
    expect(Object.keys(SHEET_TABS).slice(-2)).toEqual(["Tickets", "Requests"]);
    expect(headerRange("Tickets")).toBe("Tickets!A1:N1");
    expect(headerRange("Requests")).toBe("Requests!A1:H1");
  });
});

describe("looksLikeLeak", () => {
  it.each([
    "после замены течёт с потолка",
    "У нас течет труба",
    "Протечка в ванной",
    "затопило подвал",
    "Прорыв стояка",
    "капает с потолка",
    "water is leaking",
    "flood in the basement",
    "pipe burst",
    "no griestiem tek ūdens",
    "noplūde vannas istabā",
  ])("leak: %s", (s) => expect(looksLikeLeak(s)).toBe(true));
  it.each([
    "нужна замена смесителя",
    "жалоба на шум и грязь в подъезде",
    "Подтекает смеситель, нужен мастер",
    "течение времени",
    "gribu pieteikt apkopi",
    "heating does not work",
  ])("not a leak: %s", (s) => expect(looksLikeLeak(s)).toBe(false));
});

describe("looksLikeLeak: negation", () => {
  it.each([
    "не течёт",
    "Сейчас уже не течет, просто пятно",
    "не капает",
    "после замены не капает с потолка",
    "нет течи",
    "никаких протечек нет",
    "nav sūces",
    "ūdens vairs ne tek",
    "netek",
    "nenoplūd",
    "it is not leaking",
  ])("negated, no leak: %s", (s) => expect(looksLikeLeak(s)).toBe(false));
  it.each([
    "Нет воды. Течёт с потолка",
    "Нет, течёт сильно",
    "Не знаю что делать, сильно течёт с потолка",
    "течёт, не капает",
    "no griestiem tek ūdens",
    "Tek no griestiem",
  ])("a negation outside the clause or the 2-word window does not cancel: %s", (s) => expect(looksLikeLeak(s)).toBe(true));
});

describe("redactPhones", () => {
  it.each([
    ["+371 22848144", "[номер скрыт]"],
    ["звонить 22848144", "звонить [номер скрыт]"],
    ["22 84 81 44 после обеда", "[номер скрыт] после обеда"],
    ["00371 29 327 275", "[номер скрыт]"],
    ["+46 70 123 45 67", "[номер скрыт]"],
  ])("%s", (a, b) => expect(redactPhones(a)).toBe(b));
  it.each(["кв. 12, 9 этажей, 4 подъезда", "144 квартиры", "2026-10-05", "05.10.2026", "дом 16 корпус 2"])("keeps %s", (s) => expect(redactPhones(s)).toBe(s));
});

describe("Telegram texts", () => {
  const t = { id: "T-ABC123", isTest: false, type: "leak", address: "Parauga iela 7", apartment: 12, scgSite: true as boolean | null, description: "Течёт" };
  it("urgent ticket: «СРОЧНО», visible [уточнить] for the unknown on-call, footer", () => {
    const m = ticketMessage({ ...t, escalated: true });
    expect(m.startsWith("<b>СРОЧНО</b>: течь / протечка")).toBe(true);
    expect(m).toContain("Дежурный мастер: [уточнить]");
    expect(m.endsWith("ДЕМО · T-ABC123")).toBe(true);
  });
  it("plain ticket and request: no «СРОЧНО»; test prefix", () => {
    expect(ticketMessage({ ...t, escalated: false, type: "complaint" })).not.toContain("СРОЧНО");
    expect(ticketMessage({ ...t, escalated: true, isTest: true }).startsWith("[TEST] ")).toBe(true);
    const r = requestMessage({ id: "R-ABC123", isTest: true, kind: "job_candidate", summary: "Сварщик <b>" });
    expect(r.startsWith("[TEST] <b>Новое обращение</b>: кандидат на работу")).toBe(true);
    expect(r).toContain("Сварщик &lt;b&gt;");
    expect(r.endsWith("ДЕМО · R-ABC123")).toBe(true);
  });
});
