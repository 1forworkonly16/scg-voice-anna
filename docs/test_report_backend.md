# WP7 test report: live backend (Cloudflare Worker `scg-voice-demo`)

Date: 2026-10-03. Worker: https://scg-voice-demo.scg-voice-demo.workers.dev (Workers Free, workers.dev). No ElevenLabs call was made. No secret value appears in this report.

## Result in one table

| Check | Target | Measured | Verdict |
|---|---|---|---|
| Leftover `[TEST]` data before the run | 0 | 0 events, 0 rows (Calendar + Leads/Calls/Works/Access/Callbacks) | PASS |
| `npm test` (269 unit + 67 worker, incl. insert-409 file) and `tsc --noEmit` | green | green | PASS |
| Crons registered | `0 15 * * 1-5`, `0 4 * * *` | both listed by `wrangler deploy` | PASS |
| `/admin/health?deep=1` | 200, all deps ok | 200; Google token, Calendar, 5 Sheet headers, Telegram `getMe` all true | PASS |
| Tool endpoints without / with wrong key | 401 | 401 / 401; `/admin/*` without key 401 | PASS |
| Web key path records `channel=web` | `web` | Leads row `channel = web` (temporary key, then deleted) | PASS |
| 10 `[TEST]` bookings, latency | p90 < 5 s (hard 15 s) | p50 489 ms, p90 598 ms, max 717 ms (final run) | PASS |
| Calendar / Leads / Telegram per booking | 10/10 each | 10/10 events (deterministic id, `[TEST]` summary, `is_test=true`), 10/10 Leads rows (`is_test=TRUE`), 10/10 Telegram messages in the TEST chat, 0 in the group | PASS |
| Idempotent replay of booking 1 | no second row/event/message | `replayed=true`, Leads rows 1 -> 1, 0 new Telegram messages | PASS |
| Max CPU per request (`wrangler tail`) | < 8 ms | warm: p50 3, p90 5, max 5 (final run; 7 in one earlier run). First request on a fresh isolate: 9-14 ms | PASS warm; documented exception for the cold first request (orchestrator ruling, see Open points) |
| `[TEST]` left behind after cleanup | 0 | 0 events, 0 rows in all 5 tabs (independent re-query) | PASS |
| `npm run scan:secrets` / `info-hash.py --check` | clean / exit 0 | 0 problems / exit 0 | PASS |

## Method

- Run with `node scripts/integration.ts` (env from `scripts/env.ps1`). Per booking: `get_slots`, then `book_inspection` with `conversation_id` `[TEST]-integ-<run>-<n>`, name/address/notes prefixed `[TEST]`. Latency is client-side wall time of `book_inspection` (Riga -> Cloudflare -> Google + Telegram).
- Calendar: event read by its deterministic id (sha256 of `conversation|inspection`), checked not cancelled, summary starts with `[TEST]`, `extendedProperties.private.is_test=true`.
- Sheet: Leads row found by `conversation_id`, `is_test=TRUE`.
- Telegram: the bot cannot read chats, so new message ids are found by probing `editMessageReplyMarkup` (non-mutating existence check) in the TEST chat and in the real group before and after each booking. Result per booking: exactly 1 new id in the test chat, 0 in the group. The group id is never a send target of the tests: `[TEST]` traffic is routed by `chatFor()` to `TELEGRAM_TEST_CHAT_ID` only.
- CPU: `wrangler tail --format json` captured while the bookings ran. `cpuTime` (integer ms as reported by Cloudflare) is kept per request; raw events are discarded (they contain request headers). 21 tool requests per run (10 `get_slots`, 10 `book_inspection`, 1 replay).
- Cleanup: `POST /admin/test/cleanup`, then an independent Calendar query (`q=[TEST]` and `is_test=true`, 2020-2030 window) and a scan of every Sheet tab for `is_test=TRUE` or the text `[TEST]`.

## Findings and fixes made during WP7

1. **get_slots CPU was 6-11 ms warm** (over the 8 ms target and near the Workers Free 10 ms limit). Cause: `Intl.DateTimeFormat.formatToParts` called for every slot candidate in `src/lib/time.ts`. Fix (src change, flagged for the verifier): the Riga UTC offset is memoised per UTC hour (EU clock changes happen at exactly 01:00 UTC, so it is constant inside an hour) and `rigaParts` derives the fields from it. Checked against Intl on 3 years of instants (every ~7 min, 0 differences); the DST tests (2026-10-25, 2027-03-28) and all 269 + 67 tests still pass. Warm get_slots CPU is now 2-5 ms.
2. **Telegram send failures were silent.** `sendTelegram` now logs `{"evt":"telegram_fail","reason","status","test"}` (no token, no text). In the final run: 0 failures. One earlier run showed 9/10 Telegram messages for the test chat with no error visible; the probe window was widened (ids hi+1..hi+6, 4 attempts) and the next run was 10/10. Root cause of that single miss is not proven (probe timing or a lost send); watch the `telegram_fail` log in the M1 verification.
3. `wrangler tail --format json` prints pretty-printed multi-line JSON, not NDJSON; the parser in `scripts/integration.ts` was fixed accordingly.

## Open points

- **Cold isolate CPU.** The first request after a deploy or an idle period costs 9-14 ms CPU (token mint, first JSON parse); all later requests 2-5 ms. Workers Free allows 10 ms; the 14 ms request still succeeded. Mitigation for the demo: the preflight test call in the run sheet warms the isolate. Not a defect of the code path; a Paid plan removes the limit.
  - **Documented exception (accepted by the orchestrator, 2026-10-03):** the cold first request is 9-14 ms CPU, above the 8 ms target but below the 10 ms Workers Free limit in practice; the request succeeded in every observed case. **Carry-forward for WP9/WP10 preflight:** make a warm-up call to `/admin/health?deep=1` (header `x-admin-key`) shortly before the meeting so the demo's first real tool call hits a warm isolate.

## Independent verification (WP7 verifier, 2026-10-03)

Fresh run (`node scripts/integration.ts`): 10/10 bookings ok, latency p50 507 / p90 658 / max 874 ms; Calendar 10/10, Leads 10/10 `is_test=TRUE`, Telegram 10/10 in the TEST chat and 0 in the group; replay created nothing; 0 `telegram_fail` logs. CPU from `wrangler tail` (the health ping used to attach the tail had already warmed the isolate): get_slots 2-4 ms, book_inspection 3-6 ms, max 6 ms. Independent re-query afterwards: 0 `[TEST]` events, 0 `[TEST]`/`TRUE` rows in all 5 tabs. The verifier also added to `scripts/integration.ts`: a hard guard that the test chat is `1010766038` and differs from the group, and an abort handler so cleanup runs even if the run throws mid-way. `rigaParts` memo checked against `Intl` on 2024-2031 (every ~7 min) plus every second around the 2026-10-25 and 2027-03-28 clock changes: 0 differences.
- `ELEVENLABS_WEBHOOK_SECRET` is **not** set on the Worker: ElevenLabs issues it when the workspace webhook is created in WP8, then `node scripts/secrets.mjs --missing-only`. Until then the post-call webhook cannot be authenticated. `ELEVENLABS_AGENT_ID` is empty in `wrangler.jsonc` (WP8).
- Worker secrets present: `GOOGLE_SA_KEY_JSON`, `SCG_TOOL_KEY`, `SCG_ADMIN_KEY`, `TELEGRAM_BOT_TOKEN`. `SCG_TOOL_KEY_WEB` is not set (it was set temporarily for the channel test and deleted).
- The TEST Telegram chat keeps the test notifications from these runs (about 75 messages); the real group received none. Calendar and Sheet are clean.
- `/health` does not exist as a public route (404 by design); health is `/admin/health` behind `x-admin-key`.
