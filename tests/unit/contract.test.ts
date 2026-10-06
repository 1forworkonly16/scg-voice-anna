import { readFileSync } from "node:fs";
import { fromRoot } from "../fixtures/paths";
import { describe, expect, it } from "vitest";
import { ERROR_CODES, ErrorResponseSchema, TOOLS, TOOL_NAMES, parseResponse, toElevenLabsTool } from "../../src/contract";
import { normalizePhone } from "../../src/lib/phone";

const base = { conversation_id: "conv_1", language: "ru" as const };
const env = { v: 1 as const, say_ru: "р", say_lv: "l", hint: "h" };

describe("contract: inputs", () => {
  it("has the 7 M1 tools plus the 2 M2 tools", () => {
    expect([...TOOL_NAMES].sort()).toEqual(["book_inspection", "create_ticket", "find_works_schedule", "get_slots", "log_request", "lookup_building", "quote_range", "request_callback", "reschedule_access"]);
  });
  it("every request needs conversation_id and language", () => {
    for (const n of TOOL_NAMES) {
      const shape = TOOLS[n].input.shape as Record<string, unknown>;
      expect(Object.keys(shape), n).toContain("conversation_id");
      expect(Object.keys(shape), n).toContain("language");
    }
    expect(TOOLS.lookup_building.input.safeParse({ address: "x" }).success).toBe(false);
    expect(TOOLS.lookup_building.input.safeParse({ ...base, address: "Илукстес 16" }).success).toBe(true);
    expect(TOOLS.lookup_building.input.safeParse({ ...base, language: "de", address: "x" }).success).toBe(false);
  });
  it("quote_range: integers in range, enum scope and options", () => {
    const ok = { ...base, floors: 9, stairwells: 4, apartments: 144 };
    expect(TOOLS.quote_range.input.safeParse(ok).success).toBe(true);
    expect(TOOLS.quote_range.input.safeParse({ ...ok, floors: 0 }).success).toBe(false);
    expect(TOOLS.quote_range.input.safeParse({ ...ok, apartments: 12.5 }).success).toBe(false);
    expect(TOOLS.quote_range.input.safeParse({ ...ok, scope: "heating_risers", options: ["opt_new_towel_rail"] }).success).toBe(true);
    expect(TOOLS.quote_range.input.safeParse({ ...ok, scope: "nope" }).success).toBe(false);
  });
  it("get_slots: everything optional, dates are YYYY-MM-DD", () => {
    expect(TOOLS.get_slots.input.safeParse(base).success).toBe(true);
    expect(TOOLS.get_slots.input.safeParse({ ...base, weekday: "tue", date_from: "2026-10-05", part_of_day: "morning" }).success).toBe(true);
    expect(TOOLS.get_slots.input.safeParse({ ...base, weekday: "sat" }).success).toBe(false);
    expect(TOOLS.get_slots.input.safeParse({ ...base, date_from: "5.10.2026" }).success).toBe(false);
  });
  it("book_inspection: required set (the name is optional)", () => {
    const ok = {
      ...base, slot_start: "2026-10-05T10:00:00+03:00", address_spoken: "Илукстес 16", floors: 9, stairwells: 4, apartments: 144,
      caller_role: "owner", name: "Иван", phone: "+371 22848144",
    };
    expect(TOOLS.book_inspection.input.safeParse(ok).success).toBe(true);
    for (const k of ["slot_start", "address_spoken", "floors", "stairwells", "apartments", "caller_role", "phone"]) {
      const { [k]: _omit, ...rest } = ok as Record<string, unknown>;
      expect(TOOLS.book_inspection.input.safeParse(rest).success, k).toBe(false);
    }
    expect(TOOLS.book_inspection.input.safeParse({ ...ok, unknown_questions: ["a", "b", "c", "d", "e", "f"] }).success).toBe(false);
  });
  it("book_inspection: name is optional (omitted, empty and blank pass), at most 100 characters", () => {
    const ok = {
      ...base, slot_start: "2026-10-05T10:00:00+03:00", address_spoken: "Илукстес 16", floors: 9, stairwells: 4, apartments: 144,
      caller_role: "owner", phone: "+371 22848144",
    };
    expect(TOOLS.book_inspection.input.safeParse(ok).success).toBe(true); // no name at all
    for (const name of ["", "   ", "Иван", "я".repeat(100)]) expect(TOOLS.book_inspection.input.safeParse({ ...ok, name }).success, `${name.length} chars`).toBe(true);
    expect(TOOLS.book_inspection.input.safeParse({ ...ok, name: "я".repeat(101) }).success).toBe(false);
    expect(TOOLS.book_inspection.input.safeParse({ ...ok, name: 5 }).success).toBe(false);
  });
  it("works and callback inputs", () => {
    expect(TOOLS.find_works_schedule.input.safeParse({ ...base, apartment: 12, building_id: "b" }).success).toBe(true);
    expect(TOOLS.reschedule_access.input.safeParse({ ...base, building_id: "b", apartment: 12, new_date: "2026-10-08", new_window: "09:00-13:00" }).success).toBe(true);
    expect(TOOLS.reschedule_access.input.safeParse({ ...base, building_id: "b", apartment: 12, new_date: "2026-10-08", new_window: "10:00-11:00" }).success).toBe(false);
    expect(TOOLS.request_callback.input.safeParse({ ...base, reason: "human_requested", summary_ru: "Хочет с человеком", phone: "22848144" }).success).toBe(true);
  });
  it("no consent field (decision 2026-10-06); a stale consent from the old tool definition is stripped, never required", () => {
    expect(Object.keys(TOOLS.book_inspection.input.shape)).not.toContain("consent");
    expect(Object.keys(TOOLS.request_callback.input.shape)).not.toContain("consent");
    const cb = TOOLS.request_callback.input.parse({ ...base, reason: "x", summary_ru: "y", phone: "22848144", consent: false });
    expect(cb).not.toHaveProperty("consent");
  });
});

describe("contract: responses (envelope)", () => {
  it("lookup_building success and error", () => {
    const b = { id: "x", address: "Ilūkstes iela 16, Rīga", floors: 9, stairwells: 4, apartments: null, sourced: ["floors", "stairwells"] };
    const r = parseResponse("lookup_building", { ok: true, ...env, status: "found", confidence: 1, building: b, candidates: [], street: "Ilūkstes iela" });
    expect(r.ok).toBe(true);
    expect(() => parseResponse("lookup_building", { ok: true, ...env, status: "maybe" })).toThrow();
    const e = parseResponse("lookup_building", { ok: false, ...env, error: { code: "internal_error" } });
    expect(e.ok).toBe(false);
  });
  it("slot_taken carries at most 2 alternatives", () => {
    const slot = { start: "2026-10-05T10:00:00+03:00", label_ru: "a", label_lv: "b" };
    expect(ErrorResponseSchema.safeParse({ ok: false, ...env, error: { code: "slot_taken" }, alternatives: [slot, slot] }).success).toBe(true);
    expect(ErrorResponseSchema.safeParse({ ok: false, ...env, error: { code: "slot_taken" }, alternatives: [slot, slot, slot] }).success).toBe(false);
  });
  it("error codes from the plan are present; consent_required is gone", () => {
    for (const c of ["slot_taken", "invalid_slot", "invalid_phone", "calendar_down"]) expect(ERROR_CODES).toContain(c);
    expect(ERROR_CODES).not.toContain("consent_required");
    expect(ErrorResponseSchema.safeParse({ ok: false, ...env, error: { code: "consent_required" } }).success).toBe(false);
  });
  it("quote_range output carries only the rounded figures plus the raw range, never instalments or days", () => {
    const keys = Object.keys(TOOLS.quote_range.output.shape);
    expect(keys.join(",")).not.toMatch(/month|day/i);
    expect(keys).toContain("figures");
  });
});

describe("toElevenLabsTool", () => {
  it.each(TOOL_NAMES)("%s: every property has a description; conversation_id is a dynamic variable", (name) => {
    const t = toElevenLabsTool(name);
    const props = t.api_schema.request_body_schema.properties;
    for (const [k, p] of Object.entries(props)) expect(p.description, `${name}.${k}`).toBeTruthy();
    expect(props.conversation_id!.dynamic_variable).toBe("system__conversation_id");
    expect(props.language!.enum).toEqual(["ru", "lv", "en"]);
    expect(t.api_schema.request_body_schema.required).toContain("conversation_id");
    expect(t.api_schema.request_headers["x-scg-key"]).toEqual({ secret_id: "{secret_id}" });
    expect(t.api_schema.method).toBe("POST");
  });
  it("the URL is a parameter, the secret id is a parameter", () => {
    expect(toElevenLabsTool("get_slots").api_schema.url).toBe("{base_url}/tools/get_slots");
    const t = toElevenLabsTool("get_slots", { baseUrl: "https://w.example.workers.dev/", secretId: "sec_1" });
    expect(t.api_schema.url).toBe("https://w.example.workers.dev/tools/get_slots");
    expect(t.api_schema.request_headers["x-scg-key"]).toEqual({ secret_id: "sec_1" });
  });
  it("book_inspection and request_callback carry no consent parameter", () => {
    for (const n of ["book_inspection", "request_callback"] as const) {
      const s = toElevenLabsTool(n).api_schema.request_body_schema;
      expect(Object.keys(s.properties), n).not.toContain("consent");
      expect(s.required, n).not.toContain("consent");
      expect(s.required, n).toContain("phone");
    }
    expect(toElevenLabsTool("book_inspection").description).not.toMatch(/consent/i);
    expect(toElevenLabsTool("request_callback").description).not.toMatch(/consent/i);
  });
  it("book_inspection: the name is optional in the tool JSON; the phone stays required", () => {
    const t = toElevenLabsTool("book_inspection");
    const s = t.api_schema.request_body_schema;
    expect(Object.keys(s.properties)).toContain("name");
    expect(s.required).not.toContain("name");
    expect(s.required).toContain("phone");
    expect(s.properties.name!.description).toBe("Caller's name, if they gave one; omit it if the caller did not want to say it.");
    expect(t.description).toBe("Book the free inspection after the caller chose a slot and gave the phone (and the name, if they gave one). Confirm to the caller only when ok is true.");
  });
  it("timeouts: 10 s for booking, 8 s otherwise", () => {
    expect(toElevenLabsTool("book_inspection").response_timeout_secs).toBe(10);
    expect(toElevenLabsTool("quote_range").response_timeout_secs).toBe(8);
  });
  it("snapshot of all tool definitions", () => {
    expect(TOOL_NAMES.map((n) => toElevenLabsTool(n))).toMatchSnapshot();
  });
});

describe("docs/tool_contract.md stays in step with the schemas", () => {
  const md = readFileSync(fromRoot("docs/tool_contract.md"), "utf8");
  it("mentions every tool, every input field and every error code; at most 120 lines", () => {
    expect(md.split("\n").length).toBeLessThanOrEqual(121);
    for (const n of TOOL_NAMES) {
      expect(md, n).toContain(`\`${n}\``);
      for (const f of Object.keys(TOOLS[n].input.shape)) expect(md, `${n}.${f}`).toContain(f);
    }
    for (const c of ERROR_CODES) expect(md, c).toContain(c);
    expect(md).toMatch(/create_ticket/);
  });
});

describe("normalizePhone", () => {
  it.each([
    ["+371 22848144", "+37122848144"],
    ["22848144", "+37122848144"],
    ["29327275", "+37129327275"],
    ["00371 29 327 275", "+37129327275"],
    ["371 22848144", "+37122848144"],
    ["67123456", "+37167123456"],
    ["+7 916 123-45-67", "+79161234567"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("%s -> %s", (raw, out) => {
    expect(normalizePhone(raw)).toBe(out);
  });
  it.each(["", "123", "abcdefgh", "12345678", "+371 1234567", "+371 222", "0000"])("rejects %s", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});
