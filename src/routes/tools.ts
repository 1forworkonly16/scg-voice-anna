// POST /tools/<name>: auth (x-scg-key, constant time), zod validation, handler dispatch, 6 s deadline, always HTTP 200 except a bad key (401).
import { TOOLS, TOOL_NAMES, type ToolName } from "../contract";
import { say, fail, sayGeneric, type Body } from "./envelope";
import {
  bookInspection,
  findWorksSchedule,
  getSlots,
  lookupBuilding,
  quoteRange,
  requestCallback,
  rescheduleAccess,
} from "./handlers";
import type { Channel, Deps } from "./types";
import { TimeoutError, cleanSecret, json, safeEqual, withTimeout } from "./util";

const MAX_BODY = 50_000;
const CALENDAR_TOOLS = new Set<ToolName>(["get_slots", "book_inspection"]);

const HANDLERS: { [N in ToolName]: (c: { deps: Deps; channel: Channel }, input: never) => Promise<Body> } = {
  lookup_building: lookupBuilding as never,
  quote_range: quoteRange as never,
  get_slots: getSlots as never,
  book_inspection: bookInspection as never,
  find_works_schedule: findWorksSchedule as never,
  reschedule_access: rescheduleAccess as never,
  request_callback: requestCallback as never,
};

/** Which channel does this key belong to? null = not a valid key. */
export async function channelOfKey(deps: Deps, key: string | null): Promise<Channel | null> {
  const k = cleanSecret(key);
  if (!k) return null;
  if (await safeEqual(k, cleanSecret(deps.env.SCG_TOOL_KEY))) return "voice";
  if (await safeEqual(k, cleanSecret(deps.env.SCG_TOOL_KEY_WEB))) return "web";
  return null;
}

function fallbackFor(name: ToolName, why: string): Body {
  if (CALENDAR_TOOLS.has(name)) {
    return fail("calendar_down", say("calendar_down", { ru: {}, lv: {} }), "The system is slow or down. Do not confirm any booking; offer a callback with request_callback.", {}, why);
  }
  return fail("internal_error", sayGeneric(), "Technical problem. Apologise and offer a callback with request_callback.", {}, why);
}

export async function handleToolRequest(req: Request, name: string, deps: Deps): Promise<Response> {
  const channel = await channelOfKey(deps, req.headers.get("x-scg-key"));
  if (!channel) return json({ ok: false, error: "unauthorized" }, 401);

  const started = Date.now();
  const log = (fields: Record<string, unknown>) => console.log(JSON.stringify({ evt: "tool", tool: name, channel, ms: Date.now() - started, ...fields }));

  if (!(TOOL_NAMES as string[]).includes(name)) {
    return json(fail("invalid_input", sayGeneric(), "Unknown tool name.", {}, "unknown tool"));
  }
  const tool = name as ToolName;

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) throw new Error("too large");
    raw = JSON.parse(text);
  } catch {
    log({ ok: false, code: "invalid_input" });
    return json(fail("invalid_input", sayGeneric(), "The request body was not valid JSON.", {}, "bad json"));
  }
  const parsed = TOOLS[tool].input.safeParse(raw);
  if (!parsed.success) {
    // paths and messages only, never the submitted values (they can hold names and phone numbers)
    const msg = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ").slice(0, 300);
    log({ ok: false, code: "invalid_input" });
    return json(fail("invalid_input", sayGeneric(), "Some input fields are missing or invalid; ask the caller for them and call again.", {}, msg));
  }

  let body: Body;
  try {
    body = await withTimeout(HANDLERS[tool]({ deps, channel }, parsed.data as never), deps.limits.toolMs, `tool ${tool}`);
  } catch (e) {
    const timeout = e instanceof TimeoutError;
    log({ ok: false, code: timeout ? "timeout" : "exception", err: e instanceof Error ? e.name : "error" });
    return json(fallbackFor(tool, timeout ? "tool deadline exceeded" : "internal error"));
  }
  log({ ok: body.ok, code: (body.error as { code?: string } | undefined)?.code });
  return json(body);
}
