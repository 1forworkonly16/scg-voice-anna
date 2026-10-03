// WP7 live integration: 10 [TEST] bookings against the deployed Worker, verified end to end, then cleaned up.
//   powershell -NoProfile -ExecutionPolicy Bypass -Command ". .\scripts\env.ps1; node scripts\integration.ts [--bookings=10] [--no-tail]"
// Needs (from scripts/env.ps1): SCG_TOOL_KEY, SCG_ADMIN_KEY, GOOGLE_SA_KEY_JSON, TELEGRAM_BOT_TOKEN, CLOUDFLARE_API_TOKEN (+ ACCOUNT_ID) for the tail.
// Plain node (>= 22.18, type stripping): erasable TypeScript only. No ElevenLabs call, no secret is ever printed or written.
// Verifies per booking: latency, Calendar event (by its deterministic id), Leads row with is_test, Telegram message in the TEST chat only.
// Telegram proof: the bot cannot read chats, so new message ids are found by probing editMessageReplyMarkup (a non-mutating
// existence check: "message to edit not found" = not in that chat) in the TEST chat and in the real group, before and after each booking.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n: string, d: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const N = Number(arg("bookings", "10"));
const USE_TAIL = !process.argv.includes("--no-tail");

const state = JSON.parse(readFileSync(resolve(root, "scripts/provision/state.json"), "utf8"));
const CAL = String(state.calendar_id);
const SHEET = String(state.sheet_id);
const GROUP = String(state.tg_group_id);
const TESTCHAT = String(state.tg_test_chat_id);
// Hard guard: [TEST] traffic may only ever target the private test chat, never the real group.
if (TESTCHAT !== "1010766038" || GROUP === TESTCHAT) {
  console.error("refusing to run: test chat id must be 1010766038 and differ from the group");
  process.exit(2);
}
const WORKER = (process.env.WORKER_URL ?? "https://scg-voice-demo.scg-voice-demo.workers.dev").replace(/\/+$/, "");
const clean = (v: string | undefined) => (v ?? "").trim();
const TOOL_KEY = clean(process.env.SCG_TOOL_KEY);
const ADMIN_KEY = clean(process.env.SCG_ADMIN_KEY);
const BOT = clean(process.env.TELEGRAM_BOT_TOKEN);
for (const [k, v] of [["SCG_TOOL_KEY", TOOL_KEY], ["SCG_ADMIN_KEY", ADMIN_KEY], ["TELEGRAM_BOT_TOKEN", BOT], ["GOOGLE_SA_KEY_JSON", clean(process.env.GOOGLE_SA_KEY_JSON)]] as const) {
  if (!v) {
    console.error(`missing env: ${k} (load scripts/env.ps1)`);
    process.exit(2);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]! : NaN;
};

// ---------- Google (service account, read-only checks) ----------
let gTok = "";
let gTokAt = 0;
function googleToken(): string {
  if (gTok && Date.now() - gTokAt < 40 * 60_000) return gTok;
  const r = spawnSync(process.execPath, [resolve(root, "scripts/provision/sa_token.mjs"), "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets"], { env: process.env, encoding: "utf8" });
  if (r.status !== 0 || !r.stdout) throw new Error("could not mint a Google token");
  gTok = r.stdout.trim();
  gTokAt = Date.now();
  return gTok;
}
async function g(url: string): Promise<{ status: number; json: any }> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${googleToken()}` } });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const eventIdOf = (conv: string) => createHash("sha256").update(`${conv}|inspection`).digest("hex").slice(0, 32);
const getEvent = async (id: string) => g(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL)}/events/${id}`);
async function listTestEvents(): Promise<any[]> {
  const q = `privateExtendedProperty=${encodeURIComponent("is_test=true")}&maxResults=250&showDeleted=false&singleEvents=true`;
  const a = await g(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL)}/events?${q}`);
  const b = await g(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL)}/events?q=${encodeURIComponent("[TEST]")}&maxResults=250&showDeleted=false&singleEvents=true`);
  const byId = new Map<string, any>();
  for (const e of [...(a.json?.items ?? []), ...(b.json?.items ?? [])]) byId.set(e.id, e);
  return [...byId.values()];
}
const TABS = ["Leads", "Calls", "Works", "Access", "Callbacks"];
async function readTab(tab: string): Promise<Record<string, string>[]> {
  const r = await g(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/${tab}!A1:Z2000`);
  const rows: string[][] = r.json?.values ?? [];
  const head = rows[0] ?? [];
  return rows.slice(1).map((row) => Object.fromEntries(head.map((h, i) => [h, row[i] ?? ""])));
}

// ---------- Telegram existence probe ----------
async function tgExists(chat: string, id: number): Promise<boolean> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`https://api.telegram.org/bot${BOT}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, message_id: id }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (res.status === 429) {
      await sleep((Number(j?.parameters?.retry_after) || 3) * 1000 + 200);
      continue;
    }
    const d = String(j?.description ?? "");
    if (/message to edit not found|message_id_invalid/i.test(d)) return false;
    return true; // ok, "message is not modified", "can't be edited": the message exists in that chat
  }
  throw new Error("telegram probe rate-limited");
}
/** Message ids present in a chat within [from, to]. */
async function tgScan(chat: string, from: number, to: number): Promise<number[]> {
  const out: number[] = [];
  for (let i = from; i <= to; i++) {
    if (await tgExists(chat, i)) out.push(i);
    await sleep(60);
  }
  return out;
}
/** Snapshot: scan upward from 1 until `gap` consecutive misses after the last hit. */
async function tgSnapshot(chat: string, gap = 6): Promise<Set<number>> {
  const found = new Set<number>();
  let miss = 0;
  for (let i = 1; miss < gap && i < 400; i++) {
    if (await tgExists(chat, i)) {
      found.add(i);
      miss = 0;
    } else miss++;
    await sleep(60);
  }
  return found;
}

// ---------- Worker calls ----------
async function tool(name: string, body: unknown, key: string | null = TOOL_KEY): Promise<{ status: number; ms: number; json: any }> {
  const t0 = performance.now();
  const res = await fetch(`${WORKER}/tools/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { "x-scg-key": key } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ms: Math.round(performance.now() - t0), json };
}
const admin = async (path: string, method = "GET") => {
  const res = await fetch(`${WORKER}${path}`, { method, headers: { "x-admin-key": ADMIN_KEY } });
  return { status: res.status, json: (await res.json().catch(() => null)) as any };
};

// ---------- wrangler tail (CPU time). Raw events are NOT kept: they can carry request headers. ----------
interface TailRow { path: string; method: string; outcome: string; cpuTime: number | null; wallTime: number | null; toolMs: number | null; keys: string[] }
const tailRows: TailRow[] = [];
let tailProc: ReturnType<typeof spawn> | null = null;
let tailKeys: string[] = [];
const tgFails: string[] = [];
async function startTail(): Promise<boolean> {
  const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
  tailProc = spawn(process.execPath, [wrangler, "tail", "scg-voice-demo", "--format", "json"], { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  let ready = false;
  // `wrangler tail --format json` prints each event PRETTY-PRINTED over many lines: a top-level object opens with "{" and
  // closes with "}" at column 0. Collect those lines, parse, keep only the numbers (the raw event holds request headers).
  let acc: string[] | null = null;
  const onLine = (raw: string) => {
    const line = raw.replace(/\r$/, "");
    if (/Connected to/i.test(line)) ready = true;
    if (line === "{") {
      acc = [line];
      return;
    }
    if (!acc) return;
    acc.push(line);
    if (line !== "}") return;
    const text = acc.join("\n");
    acc = null;
    try {
      ready = true;
      const e = JSON.parse(text);
      const url = e?.event?.request?.url ? new URL(e.event.request.url) : null;
      const logs = (e.logs ?? []).map((l: any) => String(l?.message?.[0] ?? ""));
      let toolMs: number | null = null;
      for (const l of logs) {
        if (l.includes('"evt":"telegram_fail"')) tgFails.push(l.replace(/[^ -~]/g, "").slice(0, 120));
        const m = /"evt":"tool".*?"ms":(\d+)/.exec(l);
        if (m) toolMs = Number(m[1]);
      }
      tailRows.push({
        path: url ? url.pathname : e?.event?.cron ? `cron:${e.event.cron}` : "?",
        method: e?.event?.request?.method ?? "",
        outcome: String(e.outcome ?? ""),
        cpuTime: typeof e.cpuTime === "number" ? e.cpuTime : null,
        wallTime: typeof e.wallTime === "number" ? e.wallTime : null,
        toolMs,
        keys: Object.keys(e).filter((k) => k !== "logs" && k !== "event" && k !== "exceptions"),
      });
    } catch (e) {
      console.error("tail: could not parse one event:", e instanceof Error ? e.message.slice(0, 80) : "error");
    }
  };
  for (const s of [tailProc.stdout!, tailProc.stderr!]) {
    let buf = "";
    s.on("data", (d: Buffer) => {
      buf += d.toString("utf8");
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        onLine(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    });
  }
  // JSON mode prints nothing until the first event, so prove the tail is attached with a harmless authenticated ping.
  await sleep(6000);
  for (let i = 0; i < 20 && !ready; i++) {
    await admin("/admin/health");
    await sleep(2000);
  }
  return ready;
}

// ---------- main ----------
const runId = Date.now().toString(36);
const out: Record<string, unknown> = { worker: WORKER, run: runId };
const failures: string[] = [];
const must = (cond: boolean, msg: string) => {
  if (!cond) failures.push(msg);
  return cond;
};

// 0. preflight + auth
const noKey = await tool("get_slots", { conversation_id: `[TEST]-auth-${runId}`, language: "ru" }, null);
const badKey = await tool("get_slots", { conversation_id: `[TEST]-auth-${runId}`, language: "ru" }, "wrong-key");
out.auth = { no_key_status: noKey.status, wrong_key_status: badKey.status, admin_without_key: (await fetch(`${WORKER}/admin/health`)).status };
must(noKey.status === 401 && badKey.status === 401, "tool call without/with wrong key must be 401");
const health = await admin("/admin/health?deep=1");
out.health = { status: health.status, deep: health.json?.deep ? Object.fromEntries(Object.entries(health.json.deep).map(([k, v]: [string, any]) => [k, v?.ok ?? v])) : null };

// 0b. start from a clean slate (stale [TEST] data would blur the final proof)
const pre = await admin("/admin/test/cleanup", "POST");
out.pre_cleanup = { rows: pre.json?.rows_deleted, events: pre.json?.events_deleted };

// 1. Telegram baselines (the real group and the test chat)
let known: Record<string, Set<number>> = {};
let maxKnown = 0;
interface Row { n: number; conv: string; slot: string; ms: number; ok: boolean; replayed: boolean; calendar: boolean; leads: boolean; leads_is_test: boolean; tg_test_new: number; tg_group_new: number; getslots_ms: number }
const rows: Row[] = [];
try {
known = { [GROUP]: await tgSnapshot(GROUP), [TESTCHAT]: await tgSnapshot(TESTCHAT) } as Record<string, Set<number>>;
maxKnown = Math.max(0, ...known[GROUP]!, ...known[TESTCHAT]!);
out.telegram_baseline = { group_ids: known[GROUP]!.size, test_chat_ids: known[TESTCHAT]!.size };

// 2. tail
let tailReady = false;
if (USE_TAIL) tailReady = await startTail();
out.tail = { requested: USE_TAIL, connected: tailReady };

// 3. bookings
const used = new Set<string>();
for (let n = 1; n <= N; n++) {
  const conv = `[TEST]-integ-${runId}-${n}`;
  const gs = await tool("get_slots", { conversation_id: conv, language: "ru" });
  const slot = (gs.json?.slots ?? []).find((s: any) => !used.has(s.start));
  if (!must(Boolean(slot), `booking ${n}: no free slot from get_slots`)) continue;
  used.add(slot.start);
  const r = await tool("book_inspection", {
    conversation_id: conv,
    language: "ru",
    slot_start: slot.start,
    address_spoken: "[TEST] Илукстес 16",
    floors: 9,
    stairwells: 4,
    apartments: 141,
    caller_role: "board_member",
    name: "[TEST] Интеграция",
    phone: "+371 20000000",
    consent: true,
    notes: "[TEST] автоматическая проверка WP7",
  });
  const row: Row = { n, conv, slot: slot.start, ms: r.ms, ok: r.json?.ok === true, replayed: r.json?.replayed === true, calendar: false, leads: false, leads_is_test: false, tg_test_new: 0, tg_group_new: 0, getslots_ms: gs.ms };
  must(row.ok && !row.replayed, `booking ${n}: book_inspection did not return ok/new (${r.json?.error?.code ?? r.status})`);

  const ev = await getEvent(eventIdOf(conv));
  row.calendar = ev.status === 200 && ev.json?.status !== "cancelled" && String(ev.json?.summary ?? "").startsWith("[TEST]") && ev.json?.extendedProperties?.private?.is_test === "true";
  must(row.calendar, `booking ${n}: Calendar event missing or not flagged [TEST]`);

  for (let i = 0; i < 12 && !row.leads; i++) {
    const found = (await readTab("Leads")).find((x) => x.conversation_id === conv);
    if (found) {
      row.leads = true;
      row.leads_is_test = String(found.is_test).toUpperCase() === "TRUE";
    } else await sleep(1000);
  }
  must(row.leads && row.leads_is_test, `booking ${n}: Leads row missing or is_test not TRUE`);

  // Telegram: new ids since the last known id, in the test chat and in the group
  await sleep(800);
  let hi = maxKnown;
  for (let k = 0; k < 4; k++) {
    const t = await tgScan(TESTCHAT, hi + 1, hi + 6);
    const grp = await tgScan(GROUP, hi + 1, hi + 6);
    row.tg_test_new += t.length;
    row.tg_group_new += grp.length;
    for (const id of t) (known[TESTCHAT]!.add(id), (hi = Math.max(hi, id)));
    for (const id of grp) (known[GROUP]!.add(id), (hi = Math.max(hi, id)));
    if (row.tg_test_new >= 1) break;
    await sleep(1500);
  }
  maxKnown = hi;
  must(row.tg_test_new === 1 && row.tg_group_new === 0, `booking ${n}: Telegram expected 1 message in the test chat and 0 in the group, got ${row.tg_test_new}/${row.tg_group_new}`);
  rows.push(row);
  console.error(`booking ${n}/${N}: ${row.ms} ms ok=${row.ok} cal=${row.calendar} leads=${row.leads} tg_test=${row.tg_test_new} tg_group=${row.tg_group_new}`);
}

// 3b. idempotent replay of booking 1 (same conversation, same slot): no second event/row/message
if (rows[0]) {
  const first = rows[0];
  const before = (await readTab("Leads")).filter((x) => x.conversation_id === first.conv).length;
  const rp = await tool("book_inspection", {
    conversation_id: first.conv, language: "ru", slot_start: first.slot, address_spoken: "[TEST] Илукстес 16", floors: 9, stairwells: 4, apartments: 141,
    caller_role: "board_member", name: "[TEST] Интеграция", phone: "+371 20000000", consent: true,
  });
  await sleep(2500);
  const after = (await readTab("Leads")).filter((x) => x.conversation_id === first.conv).length;
  const tNew = await tgScan(TESTCHAT, maxKnown + 1, maxKnown + 3);
  const gNew = await tgScan(GROUP, maxKnown + 1, maxKnown + 3);
  out.replay = { ok: rp.json?.ok === true, replayed: rp.json?.replayed === true, ms: rp.ms, leads_rows_before: before, leads_rows_after: after, tg_new_test: tNew.length, tg_new_group: gNew.length };
  must(rp.json?.replayed === true && before === after && tNew.length === 0 && gNew.length === 0, "replay must not create a second row or message");
}
} catch (e) {
  failures.push(`run aborted: ${e instanceof Error ? e.message.slice(0, 120) : "error"} (cleanup still runs)`);
}

// 4. tail results
await sleep(3000);
if (tailProc) tailProc.kill();
const toolRows = tailRows.filter((r) => r.path.startsWith("/tools/") && r.path !== "");
const cpu = toolRows.map((r) => r.cpuTime).filter((x): x is number => x !== null);
out.cpu = {
  tail_events: tailRows.length,
  tool_events: toolRows.length,
  cpu_exposed: cpu.length > 0,
  cpu_ms_max: cpu.length ? Math.max(...cpu) : null,
  cpu_ms_p50: cpu.length ? pct(cpu, 0.5) : null,
  cpu_ms_p90: cpu.length ? pct(cpu, 0.9) : null,
  by_path: Object.fromEntries(
    [...new Set(toolRows.map((r) => r.path))].map((p) => {
      const c = toolRows.filter((r) => r.path === p && r.cpuTime !== null).map((r) => r.cpuTime as number);
      return [p, { n: toolRows.filter((r) => r.path === p).length, cpu_max: c.length ? Math.max(...c) : null, cpu_p50: c.length ? pct(c, 0.5) : null, cpu_p90: c.length ? pct(c, 0.9) : null, cpu_in_order: c }];
    }),
  ),
  outcomes: [...new Set(tailRows.map((r) => r.outcome))],
  telegram_fail_logs: tgFails,
  event_keys_seen: [...new Set(tailRows.flatMap((r) => r.keys))],
  server_tool_ms: toolRows.filter((r) => r.path === "/tools/book_inspection" && r.toolMs !== null).map((r) => r.toolMs),
};

// 5. cleanup + proof
const cl = await admin("/admin/test/cleanup", "POST");
let more = cl.json?.more_events === true;
const cl2 = { rows: cl.json?.rows_deleted, events: cl.json?.events_deleted, status: cl.status };
for (let i = 0; more && i < 5; i++) more = (await admin("/admin/test/cleanup", "POST")).json?.more_events === true;
const leftEvents = await listTestEvents();
const left: Record<string, number> = {};
for (const t of TABS) left[t] = (await readTab(t)).filter((r) => String(r.is_test).toUpperCase() === "TRUE" || Object.values(r).some((v) => v.includes("[TEST]"))).length;
const exact = (await Promise.all(rows.map((r) => getEvent(eventIdOf(r.conv))))).filter((e) => e.status === 200 && e.json?.status !== "cancelled").length;
out.cleanup = { admin: cl2, test_events_left: leftEvents.length, booked_events_still_present: exact, test_rows_left: left };
must(leftEvents.length === 0 && exact === 0 && Object.values(left).every((v) => v === 0), "[TEST] data left behind after cleanup");

// 6. latency
const ms = rows.map((r) => r.ms);
out.latency_ms = { n: ms.length, p50: pct(ms, 0.5), p90: pct(ms, 0.9), max: ms.length ? Math.max(...ms) : null, all: ms, first_is_cold_isolate_possible: true, get_slots_p50: pct(rows.map((r) => r.getslots_ms), 0.5) };
must(ms.length === N, `only ${ms.length}/${N} bookings completed`);
must(pct(ms, 0.9) < 5000, `p90 ${pct(ms, 0.9)} ms >= 5000 ms`);
must(Math.max(...ms) < 15000, "a booking exceeded the 15 s hard limit");
out.rows = rows.map(({ conv: _c, ...r }) => r);
out.failures = failures;
out.pass = failures.length === 0;
console.log(JSON.stringify(out, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
