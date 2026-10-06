// TOOLS_ENABLED (WPV3): live keeps the M2 tools (create_ticket, log_request) off until WP13 while the Worker is deployed from HEAD.
// A tool that is not in the comma list is answered EXACTLY like a name that does not exist (HTTP 200, invalid_input, «Unknown tool name.»);
// only the log tells them apart. Unset or empty = every tool, so the M2 tests run unchanged with the default harness env.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TOOL_NAMES, parseResponse, type ToolName } from "../../src/contract";
import { PHRASES } from "../../src/copy/phrases";
import { demoWorksRows } from "../../src/lib/works";
import { enabledTools } from "../../src/routes/tools";
import { fromRoot } from "../fixtures/paths";
import { base, bookingBody, harness, TOOL_KEY } from "./helpers";

type H = Awaited<ReturnType<typeof harness>>;

/** wrangler.jsonc has `//` comments only: drop them (a string-aware strip, so a «//» inside a value survives), then JSON.parse. */
const parseJsonc = (jsonc: string): Record<string, unknown> =>
  JSON.parse(jsonc.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*/g, (_m, str: string | undefined) => str ?? "")) as Record<string, unknown>;

/** The M1 list as the harness tests below set it (decoupled from the file; the describe on wrangler.jsonc checks the file itself). */
const M1_LIST = "lookup_building,quote_range,get_slots,book_inspection,find_works_schedule,reschedule_access,request_callback";
const M1_TOOLS: ToolName[] = ["lookup_building", "quote_range", "get_slots", "book_inspection", "find_works_schedule", "reschedule_access", "request_callback"];
const M2_TOOLS: ToolName[] = ["create_ticket", "log_request"];
const MAX_SUBREQUESTS = 6;

const seedWorks = (h: H) => {
  const rows = demoWorksRows("2026-10-05", "demo-parauga-iela-7");
  h.world.tabs.Works = rows.map((w) => [w.building_id, w.address_lv, w.stairwell, w.apt_from, w.apt_to, w.start_date, w.end_date, w.apts_per_day, w.window, w.foreman_label, w.status, ""]);
};

/** One valid call per tool (valid for the schema and the handler, so a refusal can only come from the switch). */
const CALLS: Record<ToolName, (h: H) => Promise<{ status: number; body: Record<string, any> }>> = {
  lookup_building: (h) => h.call("lookup_building", { ...base("e1"), address: "Илукстес 16" }),
  quote_range: (h) => h.call("quote_range", { ...base("e1"), floors: 9, stairwells: 4, apartments: 141 }),
  get_slots: (h) => h.call("get_slots", base("e1")),
  book_inspection: (h) => h.call("book_inspection", bookingBody("e1")),
  find_works_schedule: (h) => h.call("find_works_schedule", { ...base("e1"), apartment: 12, address: "Parauga iela 7" }),
  reschedule_access: (h) => h.call("reschedule_access", { ...base("e1"), building_id: "demo-parauga-iela-7", apartment: 12, new_date: "2026-10-13", new_window: "09:00-13:00" }),
  request_callback: (h) => h.call("request_callback", { ...base("e1"), reason: "human_requested", summary_ru: "Хочет поговорить с человеком.", phone: "29327275" }),
  create_ticket: (h) => h.call("create_ticket", { ...base("e1"), type: "leak", urgency: "urgent", description: "Течёт с потолка", address: "Parauga iela 7", apartment: 12 }),
  log_request: (h) => h.call("log_request", { ...base("e1"), kind: "b2b", summary_ru: "Шведский подрядчик, нужны сварщики" }),
};

afterEach(() => vi.restoreAllMocks());

/** The JSON lines the Worker wrote with console.log. */
function captureLogs(): () => Record<string, any>[] {
  const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  return () => spy.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as Record<string, any>);
}

describe("enabledTools: the TOOLS_ENABLED parser", () => {
  it("unset, empty, blank, separators only and non-strings mean no restriction", () => {
    for (const v of [undefined, "", "   ", ",", " , ,, ", null, 5, {}]) expect(enabledTools({ TOOLS_ENABLED: v as never }), String(v)).toBeNull();
  });
  it("a comma list; spaces around the names are ignored", () => {
    expect([...enabledTools({ TOOLS_ENABLED: M1_LIST })!].sort()).toEqual([...M1_TOOLS].sort());
    expect([...enabledTools({ TOOLS_ENABLED: " create_ticket , log_request ,, " })!]).toEqual(["create_ticket", "log_request"]);
  });
  it("the M1 and M2 lists together are every tool of the contract (a new tool must be sorted into one of them)", () => {
    expect([...M1_TOOLS, ...M2_TOOLS].sort()).toEqual([...TOOL_NAMES].sort());
  });
});

// What live really runs: the var in wrangler.jsonc, read from the file (the other tests below set the var through the harness).
// WP13 changes this var and elevenlabs/agent_config.json "tools" together; these tests then fail until both are updated.
describe("TOOLS_ENABLED in wrangler.jsonc", () => {
  const vars = parseJsonc(readFileSync(fromRoot("wrangler.jsonc"), "utf8")).vars as Record<string, unknown>;
  const agentTools = (JSON.parse(readFileSync(fromRoot("elevenlabs/agent_config.json"), "utf8")) as { tools: unknown }).tools;

  it("is set and lists exactly the 7 M1 tools, written plainly (no spaces, no empty item, no duplicate) and no M2 tool", () => {
    expect(typeof vars.TOOLS_ENABLED).toBe("string");
    const listed = (vars.TOOLS_ENABLED as string).split(","); // no trim: a stray space or comma must show up here
    expect([...listed].sort()).toEqual([...M1_TOOLS].sort());
    expect(listed).toHaveLength(7);
    for (const tool of M2_TOOLS) expect(listed, tool).not.toContain(tool);
  });

  it("is the same set as the tools of the live agent (elevenlabs/agent_config.json \"tools\")", () => {
    expect(Array.isArray(agentTools)).toBe(true);
    expect([...(vars.TOOLS_ENABLED as string).split(",")].sort()).toEqual([...(agentTools as string[])].sort());
  });

  it("the file parser keeps «//» inside a string and drops comments", () => {
    expect(parseJsonc('{ // note\n "u": "https://x.example/a", "n": 1 // tail\n}')).toEqual({ u: "https://x.example/a", n: 1 });
  });
});

describe("TOOLS_ENABLED = the M1 list (what live runs)", () => {
  it("the M2 tools get exactly the answer of an unknown tool name, and nothing is read, written or sent", async () => {
    const h = await harness({}, { TOOLS_ENABLED: M1_LIST });
    seedWorks(h);
    const unknown = await h.call("no_such_tool", { ...base("e1") });
    expect(unknown.status).toBe(200);
    expect(unknown.body).toMatchObject({ ok: false, v: 1, hint: "Unknown tool name.", error: { code: "invalid_input", message: "unknown tool" }, say_ru: PHRASES.tool_error_generic.ru, say_lv: PHRASES.tool_error_generic.lv });
    for (const tool of M2_TOOLS) {
      const r = await CALLS[tool](h);
      expect(r.status, tool).toBe(200);
      expect(r.body, tool).toEqual(unknown.body);
      parseResponse(tool, r.body); // still a valid error envelope for the agent
    }
    await h.flush();
    expect(h.world.count).toBe(0); // no token, no Sheet, no Telegram
    expect(h.world.tabs.Tickets).toHaveLength(0);
    expect(h.world.tabs.Requests).toHaveLength(0);
    expect(h.world.telegram).toHaveLength(0);
  });

  it("the switch comes before the body is read, and after the key check", async () => {
    const h = await harness({}, { TOOLS_ENABLED: M1_LIST });
    const unknown = await h.call("no_such_tool", {});
    const notJson = await h.request("/tools/create_ticket", { method: "POST", headers: { "x-scg-key": TOOL_KEY }, body: "{not json" });
    expect(notJson.status).toBe(200);
    expect(await notJson.json()).toEqual(unknown.body); // not «The request body was not valid JSON.»
    expect((await h.call("create_ticket", {}, { key: "wrong" })).status).toBe(401); // a bad key learns nothing about the switch
    expect((await h.call("create_ticket", {}, { key: null })).status).toBe(401);
  });

  it("a switched-off tool is logged (tool, ok:false, invalid_input, why), an unknown name too", async () => {
    const h = await harness({}, { TOOLS_ENABLED: M1_LIST });
    const logs = captureLogs();
    await h.call("create_ticket", { ...base("conv-secret-77") });
    await h.call("no_such_tool", { ...base("conv-secret-77") });
    const tool = logs().filter((l) => l.evt === "tool");
    expect(tool).toHaveLength(2);
    expect(tool[0]).toMatchObject({ tool: "create_ticket", channel: "voice", ok: false, code: "invalid_input", why: "tool_disabled" });
    expect(tool[1]).toMatchObject({ tool: "no_such_tool", ok: false, code: "invalid_input", why: "unknown_tool" });
    expect(JSON.stringify(tool)).not.toContain("secret-77"); // no conversation data in the log
  });

  it("the 7 M1 tools are unaffected: each answers ok:true within 6 subrequests (cold token included)", async () => {
    for (const tool of M1_TOOLS) {
      const h = await harness({}, { TOOLS_ENABLED: M1_LIST });
      seedWorks(h);
      const r = await CALLS[tool](h);
      await h.flush();
      expect(r.status, tool).toBe(200);
      expect(r.body.ok, `${tool}: ${JSON.stringify(r.body)}`).toBe(true);
      parseResponse(tool, r.body);
      expect(h.world.count, `${tool}: ${h.world.urls.join(" | ")}`).toBeLessThanOrEqual(MAX_SUBREQUESTS);
    }
  });

  it("the production vars together (M1 list + cyrillic street names): still within 6 subrequests, still ok", async () => {
    for (const tool of M1_TOOLS) {
      const h = await harness({}, { TOOLS_ENABLED: M1_LIST, RU_STREET_SPOKEN: "cyrillic" });
      seedWorks(h);
      const r = await CALLS[tool](h);
      await h.flush();
      expect(r.body.ok, tool).toBe(true);
      expect(h.world.count, `${tool}: ${h.world.urls.join(" | ")}`).toBeLessThanOrEqual(MAX_SUBREQUESTS);
    }
  });
});

describe("TOOLS_ENABLED unset, empty or without a name: every tool works as before", () => {
  const settings: [string, Record<string, string>][] = [["unset", {}], ["empty", { TOOLS_ENABLED: "" }], ["blank", { TOOLS_ENABLED: "  " }], ["only a comma", { TOOLS_ENABLED: "," }]];
  for (const [label, env] of settings) {
    it(`${label}: all ${TOOL_NAMES.length} tools answer ok:true`, async () => {
      for (const tool of TOOL_NAMES) {
        const h = await harness({}, env);
        seedWorks(h);
        const r = await CALLS[tool](h);
        await h.flush();
        expect(r.body.ok, `${tool}: ${JSON.stringify(r.body)}`).toBe(true);
      }
    });
  }
});

describe("TOOLS_ENABLED with other lists", () => {
  it("only the listed tools work, whatever the spacing", async () => {
    const h = await harness({}, { TOOLS_ENABLED: " create_ticket , log_request " });
    seedWorks(h);
    for (const tool of M2_TOOLS) expect((await CALLS[tool](h)).body.ok, tool).toBe(true);
    const off = await CALLS.lookup_building(h);
    expect(off.body).toMatchObject({ ok: false, error: { code: "invalid_input", message: "unknown tool" } });
    expect((await CALLS.get_slots(h)).body.ok).toBe(false);
  });

  it("a name that is not a tool in the list does not open anything", async () => {
    const h = await harness({}, { TOOLS_ENABLED: "nope,quote_range" });
    expect((await CALLS.quote_range(h)).body.ok).toBe(true);
    expect((await h.call("nope", base("e1"))).body.error.message).toBe("unknown tool");
    expect((await CALLS.get_slots(h)).body.ok).toBe(false);
  });
});
