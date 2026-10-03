// /admin/* (header x-admin-key): health, digest, demo/reset-works, test/cleanup. Responses are plain JSON, never secrets.
import { deleteEvent, freeBusy, listTestEvents } from "../google/calendar";
import { getAccessToken } from "../google/auth";
import { deleteTestRows, readHeaders } from "../google/sheets";
import { SHEET_TABS, TAB_NAMES } from "../google/sheet_schema";
import { telegramGetMe } from "../notify/telegram";
import type { Deps } from "../routes/types";
import { cleanSecret, json, safeEqual } from "../routes/util";
import { sendDigest } from "./digest";
import { resetWorks } from "./works";

export const VERSION = "wp6-1";

function configured(deps: Deps): Record<string, boolean> {
  const e = deps.env;
  return {
    GOOGLE_SA_KEY_JSON: Boolean(cleanSecret(e.GOOGLE_SA_KEY_JSON)),
    SCG_TOOL_KEY: Boolean(cleanSecret(e.SCG_TOOL_KEY)),
    SCG_ADMIN_KEY: Boolean(cleanSecret(e.SCG_ADMIN_KEY)),
    ELEVENLABS_WEBHOOK_SECRET: Boolean(cleanSecret(e.ELEVENLABS_WEBHOOK_SECRET)),
    TELEGRAM_BOT_TOKEN: Boolean(cleanSecret(e.TELEGRAM_BOT_TOKEN)),
    CALENDAR_ID: Boolean(e.CALENDAR_ID?.trim()),
    SHEET_ID: Boolean(e.SHEET_ID?.trim()),
    TELEGRAM_CHAT_ID: Boolean(e.TELEGRAM_CHAT_ID?.trim()),
    TELEGRAM_TEST_CHAT_ID: Boolean(e.TELEGRAM_TEST_CHAT_ID?.trim()),
    ELEVENLABS_AGENT_ID: Boolean(e.ELEVENLABS_AGENT_ID?.trim()),
  };
}

async function deepHealth(deps: Deps): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const step = async (name: string, f: () => Promise<unknown>) => {
    try {
      out[name] = await f();
    } catch (e) {
      out[name] = { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : "error" };
    }
  };
  await step("google_token", async () => ((await getAccessToken(deps)) ? { ok: true } : { ok: false }));
  await step("calendar", async () => {
    const now = deps.now();
    await freeBusy(deps, now, new Date(now.getTime() + 3600_000));
    return { ok: true };
  });
  await step("sheet_headers", async () => {
    const got = await readHeaders(deps, TAB_NAMES);
    return Object.fromEntries(TAB_NAMES.map((t) => [t, JSON.stringify(got[t]) === JSON.stringify(SHEET_TABS[t])]));
  });
  await step("telegram", () => telegramGetMe(deps));
  return out;
}

export async function handleAdminRequest(req: Request, url: URL, deps: Deps): Promise<Response> {
  if (!(await safeEqual(cleanSecret(req.headers.get("x-admin-key")), cleanSecret(deps.env.SCG_ADMIN_KEY)))) return json({ ok: false, error: "unauthorized" }, 401);
  const path = url.pathname.replace(/\/+$/, "");
  const q = url.searchParams;
  try {
    if (path === "/admin/health" && req.method === "GET") {
      return json({ ok: true, version: VERSION, now: deps.now().toISOString(), configured: configured(deps), ...(q.get("deep") === "1" ? { deep: await deepHealth(deps) } : {}) });
    }
    if (path === "/admin/digest" && (req.method === "POST" || req.method === "GET")) {
      const r = await sendDigest(deps, { date: q.get("date") ?? undefined, test: q.get("test") === "1", dry: q.get("dry") === "1" || req.method === "GET" });
      return json({ ok: true, dry: q.get("dry") === "1" || req.method === "GET", ...r });
    }
    if (path === "/admin/demo/reset-works" && req.method === "POST") {
      return json({ ok: true, ...(await resetWorks(deps)) });
    }
    if (path === "/admin/test/cleanup" && req.method === "POST") {
      const rows = await deleteTestRows(deps, TAB_NAMES);
      const events = await listTestEvents(deps, 40);
      let deleted = 0;
      for (const e of events) if (await deleteEvent(deps, e.id)) deleted++;
      return json({ ok: true, rows_deleted: rows, events_deleted: deleted, more_events: events.length >= 40 });
    }
    return json({ ok: false, error: "not_found" }, 404);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "error" }, 500);
  }
}
