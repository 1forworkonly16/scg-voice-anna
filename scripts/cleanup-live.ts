// H3 cleanup: removes what REAL (non-test) talk-to calls wrote in a time window. The admin route /admin/test/cleanup only
// removes is_test data, so live calls need this LOCAL script.
//   powershell -NoProfile -ExecutionPolicy Bypass -Command ". .\scripts\env.ps1; node scripts\cleanup-live.ts --since 2026-10-04T08:00:00Z [--until <ISO>] [--apply]"
// Default is a DRY RUN (lists counts only). --apply deletes:
//   - NON-TEST events of the demo calendar «SCG — Бесплатный осмотр» CREATED in [since, until] (Google `created` field; the
//     slot itself may be later). Events with private extended property is_test=true are left to /admin/test/cleanup.
//   - NON-TEST rows (is_test != TRUE) of Leads, Calls, Callbacks and, if present, Tickets, Requests whose timestamp is in [since, until].
// Never touched: header rows (row 1), the Works tab (demo plan) and Access (`reset-works` rewrites Works and clears Access).
// The script refuses to run when the calendar's title is not «SCG — Бесплатный осмотр».
// Telegram group messages cannot be listed by a bot; the group owner deletes them in the Telegram app.
// Needs GOOGLE_SA_KEY_JSON (via scripts/env.ps1). Prints counts only: no names, phones, addresses or ids. Plain node >= 22.18
// (erasable TypeScript only). The window is limited to 72 hours so a typo cannot wipe the whole Sheet.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Tab -> its creation-time column. Works is deliberately absent. */
export const CLEANUP_TABS = {
  Leads: "timestamp",
  Calls: "timestamp",
  Callbacks: "timestamp",
  Tickets: "timestamp",
  Requests: "timestamp",
} as const;
export type CleanupTab = keyof typeof CLEANUP_TABS;
export const PROTECTED_TABS: readonly string[] = ["Works", "Access"];
export const CALENDAR_TITLE = "SCG — Бесплатный осмотр";
export const REMINDER =
  "next: (1) delete the call messages in the Telegram group «заявки(демо)» by hand (a bot cannot list them); (2) run reset-works (POST /admin/demo/reset-works: rewrites Works, clears Access).";
export const MAX_WINDOW_HOURS = 72;

const CAL_API = "https://www.googleapis.com/calendar/v3";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export interface Ids {
  calendarId: string;
  sheetId: string;
}
export interface Window {
  since: Date;
  until: Date;
}
export interface Plan {
  events: string[];
  rows: Record<CleanupTab, number[]>;
  /** Tabs that could not be read or lack the time column (nothing is deleted there). */
  skipped: string[];
}

export function parseArgs(argv: readonly string[], now: Date): Window & { apply: boolean } {
  const val = (n: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    if (i >= 0) return argv[i + 1];
    return argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  };
  const s = val("since");
  if (!s) throw new Error("--since <ISO time> is required");
  const since = new Date(s);
  const u = val("until");
  const until = u ? new Date(u) : now;
  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) throw new Error("--since/--until must be ISO times, e.g. 2026-10-04T08:00:00Z");
  if (since >= until) throw new Error("--since must be before --until");
  if (until.getTime() - since.getTime() > MAX_WINDOW_HOURS * 3600_000) throw new Error(`window longer than ${MAX_WINDOW_HOURS} h; split it`);
  return { since, until, apply: argv.includes("--apply") };
}

const inWindow = (iso: string | undefined, w: Window): boolean => {
  const t = Date.parse(String(iso ?? "").trim());
  return Number.isFinite(t) && t >= w.since.getTime() && t <= w.until.getTime();
};

/**
 * Row selection for one tab. `values` is the tab as returned by values.get (row 0 = header).
 * Returns 0-based sheet row indexes (header = 0, so every result is >= 1) whose time column lies in the window.
 * Returns null when the tab is protected or the header lacks the time column (nothing must be deleted then).
 */
export function selectRows(tab: string, values: readonly (readonly string[])[], column: string, w: Window): number[] | null {
  if (PROTECTED_TABS.includes(tab)) return null;
  const head = values[0] ?? [];
  const col = head.indexOf(column);
  const testCol = head.indexOf("is_test");
  if (col < 0 || testCol < 0) return null;
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const isTest = String(values[i]?.[testCol] ?? "").trim().toUpperCase() === "TRUE";
    if (!isTest && inWindow(values[i]?.[col], w)) out.push(i);
  }
  return out;
}

export interface CalItem {
  id: string;
  created?: string;
  status?: string;
  extendedProperties?: { private?: Record<string, string> };
}
export function selectEvents(items: readonly CalItem[], w: Window): string[] {
  const isTest = (e: CalItem) => String(e.extendedProperties?.private?.is_test ?? "").toLowerCase() === "true";
  return items.filter((e) => e.status !== "cancelled" && !isTest(e) && inWindow(e.created, w)).map((e) => e.id);
}

async function getJson(f: FetchLike, token: string, url: string): Promise<{ status: number; json: any }> {
  const r = await f(url, { headers: { authorization: `Bearer ${token}` } });
  return { status: r.status, json: await r.json().catch(() => null) };
}

export async function planCleanup(f: FetchLike, token: string, ids: Ids, w: Window): Promise<Plan> {
  const cal = await getJson(f, token, `${CAL_API}/calendars/${encodeURIComponent(ids.calendarId)}`);
  if (cal.status !== 200) throw new Error(`calendars.get -> HTTP ${cal.status}`);
  if (String(cal.json?.summary ?? "") !== CALENDAR_TITLE) throw new Error("calendar title is not «SCG — Бесплатный осмотр»; refusing");
  // Events modified since `since` include every event created since then; then filter on `created`.
  const items: CalItem[] = [];
  let page: string | undefined;
  do {
    const q = new URLSearchParams({ updatedMin: w.since.toISOString(), showDeleted: "false", singleEvents: "true", maxResults: "250" });
    if (page) q.set("pageToken", page);
    const r = await getJson(f, token, `${CAL_API}/calendars/${encodeURIComponent(ids.calendarId)}/events?${q}`);
    if (r.status !== 200) throw new Error(`calendar events.list -> HTTP ${r.status}`);
    items.push(...((r.json?.items ?? []) as CalItem[]));
    page = r.json?.nextPageToken;
  } while (page);
  const plan: Plan = { events: selectEvents(items, w), rows: { Leads: [], Calls: [], Callbacks: [], Tickets: [], Requests: [] }, skipped: [] };
  for (const [tab, column] of Object.entries(CLEANUP_TABS) as [CleanupTab, string][]) {
    const r = await getJson(f, token, `${SHEETS_API}/${ids.sheetId}/values/${encodeURIComponent(`${tab}!A1:Z5000`)}`);
    const sel = r.status === 200 ? selectRows(tab, (r.json?.values ?? []) as string[][], column, w) : null;
    if (sel === null) plan.skipped.push(tab);
    else plan.rows[tab] = sel;
  }
  return plan;
}

export async function applyCleanup(f: FetchLike, token: string, ids: Ids, plan: Plan): Promise<{ events_deleted: number; rows_deleted: Record<string, number> }> {
  const auth = { authorization: `Bearer ${token}` };
  let events = 0;
  for (const id of plan.events) {
    const r = await f(`${CAL_API}/calendars/${encodeURIComponent(ids.calendarId)}/events/${encodeURIComponent(id)}`, { method: "DELETE", headers: auth });
    if (r.status === 204 || r.status === 200 || r.status === 410) events++;
  }
  const rowsDeleted: Record<string, number> = {};
  const targets = (Object.entries(plan.rows) as [CleanupTab, number[]][]).filter(([t, ix]) => ix.length && !PROTECTED_TABS.includes(t));
  if (targets.length) {
    const meta = await getJson(f, token, `${SHEETS_API}/${ids.sheetId}?fields=${encodeURIComponent("sheets.properties(sheetId,title)")}`);
    if (meta.status !== 200) throw new Error(`spreadsheets.get -> HTTP ${meta.status}`);
    const gid = new Map<string, number>(((meta.json?.sheets ?? []) as any[]).map((s) => [String(s.properties?.title), Number(s.properties?.sheetId)]));
    const requests: unknown[] = [];
    for (const [tab, ix] of targets) {
      const id = gid.get(tab);
      if (id === undefined) continue;
      // bottom-up so earlier deletions do not shift later indexes; index 0 (the header) is never deleted
      for (const i of [...new Set(ix)].filter((x) => Number.isInteger(x) && x >= 1).sort((a, b) => b - a)) {
        requests.push({ deleteDimension: { range: { sheetId: id, dimension: "ROWS", startIndex: i, endIndex: i + 1 } } });
        rowsDeleted[tab] = (rowsDeleted[tab] ?? 0) + 1;
      }
    }
    if (requests.length) {
      const r = await f(`${SHEETS_API}/${ids.sheetId}:batchUpdate`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ requests }) });
      if (r.status !== 200) throw new Error(`batchUpdate -> HTTP ${r.status}`);
    }
  }
  return { events_deleted: events, rows_deleted: rowsDeleted };
}

export const counts = (p: Plan) => ({ events: p.events.length, ...Object.fromEntries(Object.entries(p.rows).map(([t, ix]) => [t, ix.length])), skipped: p.skipped });

async function main(): Promise<void> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let w: Window & { apply: boolean };
  try {
    w = parseArgs(process.argv.slice(2), new Date());
  } catch (e) {
    console.error(`cleanup-live: ${(e as Error).message}`);
    process.exit(2);
  }
  if (!(process.env.GOOGLE_SA_KEY_JSON ?? "").trim()) {
    console.error("missing env: GOOGLE_SA_KEY_JSON (load scripts/env.ps1)");
    process.exit(2);
  }
  const state = JSON.parse(readFileSync(resolve(root, "scripts/provision/state.json"), "utf8"));
  const ids: Ids = { calendarId: String(state.calendar_id), sheetId: String(state.sheet_id) };
  const tok = spawnSync(process.execPath, [resolve(root, "scripts/provision/sa_token.mjs"), "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets"], { env: process.env, encoding: "utf8" });
  if (tok.status !== 0 || !tok.stdout) {
    console.error(`could not mint a Google token (exit ${tok.status}): ${String(tok.stderr ?? tok.error?.message ?? "").trim().slice(0, 200)}`);
    process.exit(1);
  }
  const token = tok.stdout.trim();
  const f: FetchLike = (url, init) => fetch(url, init);
  console.log(`window ${w.since.toISOString()} .. ${w.until.toISOString()} (${w.apply ? "APPLY" : "dry run"})`);
  const plan = await planCleanup(f, token, ids, w);
  console.log("found:", JSON.stringify(counts(plan)));
  if (!w.apply) {
    console.log("dry run: nothing deleted. Re-run with --apply to delete.");
    console.log(REMINDER);
    return;
  }
  const done = await applyCleanup(f, token, ids, plan);
  console.log("deleted:", JSON.stringify(done));
  console.log(REMINDER);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`cleanup-live failed: ${e instanceof Error ? e.message.slice(0, 200) : "error"}`);
    process.exit(1);
  });
}
