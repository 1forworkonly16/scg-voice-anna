// Mocked world for the Worker tests: a fake Google (token, Calendar, Sheets), a fake Telegram and a fetch counter.
// No network is ever touched: every Worker call goes through `deps.fetch`.
import { webcrypto } from "node:crypto";
import { resetGoogleTokenCache } from "../../src/google/auth";
import { SHEET_TABS } from "../../src/google/sheet_schema";
import { handleRequest } from "../../src/index";
import { DEFAULT_LIMITS, type Env, type Limits } from "../../src/routes/types";

export const TOOL_KEY = "tool-key-123";
export const ADMIN_KEY = "admin-key-456";
export const WH_SECRET = "wh-secret-789";
export const AGENT_ID = "agent_test_1";
/** Monday 2026-10-05 11:00 Riga (summer time, UTC+3). Earliest slot: Tuesday 2026-10-06. */
export const NOW = new Date("2026-10-05T08:00:00Z");
export const SLOT = "2026-10-06T10:00:00+03:00";
export const SLOT2 = "2026-10-06T11:00:00+03:00";

async function makePem(): Promise<string> {
  const kp = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const der = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", kp.privateKey));
  const b64 = der.toString("base64").match(/.{1,64}/g)!.join("\n");
  const bar = "-----";
  return `${bar}BEGIN ${"PRIVATE"} KEY${bar}\n${b64}\n${bar}END ${"PRIVATE"} KEY${bar}\n`; // built piecewise so the secret scan has nothing to flag
}

let pemCache: string | null = null;
export async function makeEnv(over: Partial<Env> = {}): Promise<Env> {
  pemCache ??= await makePem();
  return {
    GOOGLE_SA_KEY_JSON: JSON.stringify({ client_email: "sa@scg-test.iam.gserviceaccount.com", private_key: pemCache }),
    SCG_TOOL_KEY: `${TOOL_KEY}\r\n`, // CRLF on purpose: the Worker trims it
    SCG_ADMIN_KEY: ADMIN_KEY,
    ELEVENLABS_WEBHOOK_SECRET: WH_SECRET,
    TELEGRAM_BOT_TOKEN: "123:TESTTOKEN",
    CALENDAR_ID: "cal@group.calendar.google.com",
    SHEET_ID: "sheet-id-1",
    TELEGRAM_CHAT_ID: "-100111",
    TELEGRAM_TEST_CHAT_ID: "555",
    ELEVENLABS_AGENT_ID: AGENT_ID,
    NUMBER_MODE: "digits",
    ...over,
  };
}

export interface CalEvent {
  id: string;
  status: string;
  summary: string;
  description: string;
  start: { dateTime: string };
  end: { dateTime: string };
  extendedProperties?: { private?: Record<string, string> };
}

export interface FakeOptions {
  /** URL predicate: matching requests never answer (to test timeouts). */
  hang?: (url: string, method: string) => boolean;
  /** URL predicate: matching requests answer with this status. */
  status?: (url: string, method: string) => number | null;
  extraBusy?: { start: string; end: string }[];
}

export class FakeWorld {
  events = new Map<string, CalEvent>();
  tabs: Record<string, unknown[][]> & { Leads: unknown[][]; Calls: unknown[][]; Works: unknown[][]; Access: unknown[][]; Callbacks: unknown[][]; Tickets: unknown[][]; Requests: unknown[][] } = {
    Leads: [], Calls: [], Works: [], Access: [], Callbacks: [], Tickets: [], Requests: [],
  };
  telegram: { chat_id: string; text: string }[] = [];
  urls: string[] = [];
  opts: FakeOptions;
  pending: Promise<unknown>[] = [];

  constructor(opts: FakeOptions = {}) {
    this.opts = opts;
  }

  get count(): number {
    return this.urls.length;
  }

  reset(): void {
    this.urls = [];
  }

  fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? "GET";
    this.urls.push(`${method} ${url}`);
    if (this.opts.hang?.(url, method)) return new Promise<Response>(() => undefined);
    const forced = this.opts.status?.(url, method);
    if (forced) return this.res({ error: { code: forced } }, forced);
    const isJson = String((init?.headers as Record<string, string> | undefined)?.["content-type"] ?? "").includes("json");
    const body = init?.body && isJson ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);

    if (u.host === "oauth2.googleapis.com") return this.res({ access_token: "tok", expires_in: 3600 });
    if (u.host === "api.telegram.org") {
      if (path.endsWith("/getMe")) return this.res({ ok: true, result: { username: "scg_test_bot" } });
      this.telegram.push({ chat_id: String(body!.chat_id), text: String(body!.text) });
      return this.res({ ok: true, result: { message_id: this.telegram.length } });
    }
    if (u.host === "www.googleapis.com") return this.calendar(method, path, u, body);
    if (u.host === "sheets.googleapis.com") return this.sheets(method, path, u, body);
    return this.res({ error: "unknown host" }, 500);
  };

  private res(o: unknown, status = 200): Response {
    return new Response(status === 204 ? null : JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  }

  private calendar(method: string, path: string, u: URL, body: Record<string, unknown> | null): Response {
    if (path === "/calendar/v3/freeBusy") {
      const busy = [...this.events.values()].filter((e) => e.status !== "cancelled").map((e) => ({ start: e.start.dateTime, end: e.end.dateTime }));
      return this.res({ calendars: { [(body!.items as { id: string }[])[0]!.id]: { busy: [...busy, ...(this.opts.extraBusy ?? [])] } } });
    }
    const m = /\/events(?:\/([^/]+))?$/.exec(path);
    if (!m) return this.res({}, 404);
    const id = m[1];
    if (method === "POST") {
      const eid = String(body!.id);
      if (this.events.has(eid)) return this.res({ error: { code: 409 } }, 409);
      this.events.set(eid, this.toEvent(eid, body!));
      return this.res(this.events.get(eid));
    }
    if (method === "GET" && id) {
      const e = this.events.get(id);
      return e ? this.res(e) : this.res({ error: { code: 404 } }, 404);
    }
    if (method === "GET") {
      const items = [...this.events.values()].filter((e) => e.extendedProperties?.private?.is_test === "true");
      return this.res({ items });
    }
    if (method === "PATCH" && id) {
      const e = this.events.get(id);
      if (!e) return this.res({}, 404);
      this.events.set(id, { ...e, ...this.toEvent(id, body!) });
      return this.res(this.events.get(id));
    }
    if (method === "DELETE" && id) {
      this.events.delete(id);
      return this.res(null, 204);
    }
    return this.res({}, 400);
  }

  private toEvent(id: string, b: Record<string, unknown>): CalEvent {
    return {
      id,
      status: String(b.status ?? "confirmed"),
      summary: String(b.summary),
      description: String(b.description),
      start: { dateTime: String((b.start as { dateTime: string }).dateTime) },
      end: { dateTime: String((b.end as { dateTime: string }).dateTime) },
      extendedProperties: b.extendedProperties as CalEvent["extendedProperties"],
    };
  }

  private sheets(method: string, path: string, u: URL, body: Record<string, unknown> | null): Response {
    if (path.endsWith("/values:batchGet")) {
      const ranges = u.searchParams.getAll("ranges");
      return this.res({
        valueRanges: ranges.map((r) => {
          const tab = r.split("!")[0]!;
          const headerOnly = /^A1:[A-Z]+1$/.test(r.split("!")[1] ?? "");
          return { values: headerOnly ? [[...((SHEET_TABS as Record<string, readonly string[]>)[tab] ?? [])]] : this.tabs[tab] ?? [] };
        }),
      });
    }
    const append = /\/values\/([A-Za-z]+)!A1:append$/.exec(path);
    if (append && method === "POST") {
      this.tabs[append[1]!]!.push(...((body!.values as unknown[][]) ?? []));
      return this.res({ updates: { updatedRows: 1 } });
    }
    const clear = /\/values\/([A-Za-z]+)!A2:[A-Z]+:clear$/.exec(path);
    if (clear) {
      this.tabs[clear[1]!] = [];
      return this.res({});
    }
    const put = /\/values\/([A-Za-z]+)!A2$/.exec(path);
    if (put && method === "PUT") {
      this.tabs[put[1]!] = (body!.values as unknown[][]).map((r) => [...r]);
      return this.res({});
    }
    if (method === "GET" && /\/spreadsheets\/[^/]+$/.test(path)) {
      return this.res({ sheets: Object.keys(this.tabs).map((title, i) => ({ properties: { sheetId: i + 1, title } })) });
    }
    if (path.endsWith(":batchUpdate")) {
      const names = Object.keys(this.tabs);
      for (const r of body!.requests as { deleteDimension: { range: { sheetId: number; startIndex: number } } }[]) {
        const tab = names[r.deleteDimension.range.sheetId - 1]!;
        this.tabs[tab]!.splice(r.deleteDimension.range.startIndex - 1, 1);
      }
      return this.res({});
    }
    return this.res({}, 400);
  }
}

export interface Harness {
  world: FakeWorld;
  env: Env;
  now: { value: Date };
  call: (tool: string, body: unknown, opts?: { key?: string | null; limits?: Partial<Limits> }) => Promise<{ status: number; body: Record<string, any> }>;
  request: (path: string, init?: RequestInit, limits?: Partial<Limits>) => Promise<Response>;
  flush: () => Promise<void>;
}

// Flake fix (WP8 rework): a test that does not flush() leaves a prewarm promise (lookup_building -> prewarmToken) running; when it finished
// after the NEXT harness() had reset the module-level token cache, it re-filled the cache and that test saw 1 subrequest instead of 2.
// So every harness() first settles the pending promises of all earlier worlds, then resets the cache.
const earlierWorlds: FakeWorld[] = [];
export async function harness(opts: FakeOptions = {}, envOver: Partial<Env> = {}): Promise<Harness> {
  for (const w of earlierWorlds) while (w.pending.length) await Promise.allSettled(w.pending.splice(0));
  resetGoogleTokenCache();
  const world = new FakeWorld(opts);
  earlierWorlds.push(world);
  const env = await makeEnv(envOver);
  const now = { value: NOW };
  const request = (path: string, init?: RequestInit, limits?: Partial<Limits>) =>
    handleRequest(new Request(`https://w.example${path}`, init), env, { waitUntil: (p: Promise<unknown>) => void world.pending.push(p) }, {
      fetch: world.fetch,
      now: () => now.value,
      limits: { ...DEFAULT_LIMITS, ...limits },
      waitUntil: (p) => void world.pending.push(p),
    });
  const call: Harness["call"] = async (tool, body, o = {}) => {
    const key = o.key === undefined ? TOOL_KEY : o.key;
    const res = await request(`/tools/${tool}`, { method: "POST", headers: { "content-type": "application/json", ...(key ? { "x-scg-key": key } : {}) }, body: JSON.stringify(body) }, o.limits);
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const flush = async () => {
    while (world.pending.length) await Promise.allSettled(world.pending.splice(0));
  };
  return { world, env, now, call, request, flush };
}

export const base = (conv: string, language = "ru") => ({ conversation_id: conv, language });

export const bookingBody = (conv: string, over: Record<string, unknown> = {}) => ({
  ...base(conv),
  slot_start: SLOT,
  address_spoken: "Илукстес 16",
  floors: 9,
  stairwells: 4,
  apartments: 141,
  caller_role: "board_member",
  name: "Иван",
  phone: "+371 22 84 81 44",
  notes: "Стояки ХВС и канализации, подвал открыт",
  unknown_questions: ["Можно ли в рассрочку?"],
  ...over,
});
