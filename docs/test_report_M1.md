# V1 test report: M1 verification of «Anna» (scg-anna)

Date: 2026-10-03 (about 23:00 Riga). The verifier is a fresh Opus instance that built none of this. Agent `agent_4801m41cmf0ge7er75wzv5nj3pn1`; Worker https://scg-voice-demo.scg-voice-demo.workers.dev. No secret value appears here.

**Orchestrator rulings applied:**
- No synthetic voice calls: the user's live H3 talks replace them.
- t26/t27 were allowed under a hard cap of 300 credits. Neither was run (see §4).
- `el:tools` and `el:build` were not run, and the agent was left locked.

**Verdict:** every gate that can be checked without voice is PASS. Every voice or ear item is handed to H3, and one known test failure (t21) is carried over. The live check found two new problems, both fixed by preflight steps: the Works tab was empty (§3.4), and the first tool call can still run on a cold isolate (§3.2).

## 1. Local gates
| Check | Command | Result | Verdict |
|---|---|---|---|
| Unit + worker tests | `npm test` | data sync OK; 326/326 unit, 94/94 worker | PASS |
| Typecheck | `npm run typecheck` | exit 0 | PASS |
| Copy lint | `node scripts/copy-lint.mjs` | 11 files, 0 problems | PASS |
| Secret scan | `. .\scripts\env.ps1; npm run scan:secrets` | 268 files; all 8 env keys checked (names only); 0 problems | PASS |
| `info/` unchanged | `PYTHONUTF8=1 python scripts/info-hash.py --check` | «INFO unchanged (58 files)», exit 0 (run at the start and the end) | PASS |

## 2. Agent configuration (live, read-only)
| Check | Evidence | Verdict |
|---|---|---|
| `npm run el:check` | 67/67 PASS | PASS |
| Values read with an independent GET of the agent | LLM `claude-haiku-4-5`; TTS `eleven_v4_turbo`; voice Marina `ymDCYd8puC7gYjxIamPt`; max 300 s; daily limit 25; concurrency 2; retention 90; auth on; 7 tool ids; default language lv; preset ru | PASS |
| Link locked | `npm run link:status` printed «auth ON (LOCKED…)» | PASS |
| No paid GHL features | `grep -rniE "gohighlevel\|leadconnector\|\bghl\b\|highlevel" src scripts elevenlabs wrangler.jsonc package.json` found 0 hits | PASS |

## 3. Live backend
### 3.1 Warm-up
`GET /admin/health?deep=1` returned 200 in 1,550 ms (a cold call). All 10 config flags were true. The deep check passed on the Google token, Calendar, 5 Sheet headers and Telegram `getMe` (`dimasmartcombot`).

### 3.2 Integration (`node scripts/integration.ts`, run `mustk8no`, one fresh run)
| Check | Result | Verdict |
|---|---|---|
| Auth: no key, wrong key, admin with no key | 401 / 401 / 401 | PASS |
| `[TEST]` leftovers before the run | 0 events, 0 rows | PASS |
| 10 `[TEST]` bookings | 10/10 ok | PASS |
| `book_inspection` latency (client wall time) | **p50 501 ms, p90 608 ms, max 623 ms** (target p90 < 5 s, hard limit 15 s); `get_slots` p50 264 ms | PASS |
| Per booking: Calendar event, Leads row (`is_test=TRUE`), Telegram | Calendar 10/10, Leads 10/10, Telegram 1 new message in the TEST chat for each booking, 0 in the group | PASS |
| Idempotent replay | `replayed=true`; no new row, event or message | PASS |
| `telegram_fail` logs | none; tail outcome `ok` only | PASS |
| CPU (`wrangler tail`, 21 tool events) | p50 4 ms, p90 5 ms. **The first `get_slots` took 11 ms** and the first `book_inspection` 8 ms. The 11 ms call happened even though `/admin/health?deep=1` had run about 2 minutes earlier | PASS warm. Cold start is a known issue (§6) |
| Cleanup | admin cleanup removed 10 rows and 10 events; 0 `[TEST]` left anywhere | PASS |

### 3.3 Independent re-query (own script; token from `scripts/provision/sa_token.mjs`, never printed)
- Calendar: `q=[TEST]` returned 0; `privateExtendedProperty is_test=true` returned 0; total events in 2020–2030: 0.
- All 7 tabs had 0 `[TEST]` rows and 0 `is_test=TRUE` rows: Leads, Calls, Works, Access, Callbacks, Tickets, Requests.
- Verdict: PASS. The re-query was repeated after the §3.4 probes with the same result. Works now holds 3 demo rows (not test rows).

### 3.4 Scenario 3 data path (new finding)
- Before V1 touched anything, the **Works tab was empty**. A `find_works_schedule` probe for Parauga iela 7, apartment 12, returned `found:false` («…не нашла график работ…»). **Scenario 3 would have failed live.**
- The daily cron (`0 4 * * *`) would only have filled the tab at 04:00 UTC.
- V1 ran the documented preflight action `POST /admin/demo/reset-works`. It returned 200 with `stairwells:3, first_start:2026-10-05`.
- The same probe afterwards (273 ms) returned `found:true`, apartment 12 in stairwell 1, works on 2026-10-07 from 09:00 to 17:00, and 3 options. Both `say_ru` and `say_lv` were correct.
- Verdict: PASS after reset. Recommendation: make `reset-works` an **unconditional** preflight step in the run sheet, which currently runs it only after a rehearsal reschedule.

## 4. ElevenLabs tests t26 / t27: NOT RUN
| Item | Evidence |
|---|---|
| Cost estimate | Earlier Haiku runs of these tests (`elevenlabs/test_results/haiku_sims.json`) used **1,068 credits (t26) and 442 credits (t27)**. The simulated user and the evaluator run on the platform default model, not Haiku. Either test alone exceeds the 300-credit hard cap, so neither was started. |
| Earlier result | Both passed in WP8 (1 repeat each). That was before the round-1 and round-2 prompt and tool-description changes, so the scenario 1 and 3 flows are re-validated live at H3. |
| Credits | Balance from `GET /v1/user/subscription`: **22,551 remaining** (limit 157,744; used 135,193) both before and after V1. **V1 used 0 credits, 0 voice minutes and $0.** Tool executions from simulations: none (none were run). |

## 5. Digest and demo kit
| Check | Evidence | Verdict |
|---|---|---|
| Digest preview | `GET /admin/digest?dry=1` returned 200, `dry:true`, nothing sent. Stats for 2026-10-03 were all 0, as expected because there were no real calls. The text was «Итоги дня 2026-10-03 / Звонков: 0 / … / ДЕМО · D-2026-10-03». | PASS |
| Digest to the test chat | One `POST /admin/digest?test=1` returned 200 with `sent.ok:true`, `message_id 99`. That id is consistent with the test chat's sequence (85 ids before the run, then 10 integration messages). No POST was made without `?test=1`. | PASS |
| QR code | `demo/join_qr.png`, decoded with zxing-cpp, gives `https://t.me/+J8zbZSu3PqhhYTQ6`, the H1 invite in `docs/status.md`. | PASS |
| Run-sheet commands | `link:unlock`, `link:lock` and `link:status` exist in `package.json`; the routes `/admin/health?deep=1` and `/admin/demo/reset-works` exist and responded live; `scripts/env.ps1` exists. | PASS |
| Run-sheet content | Step 0 («на 2026-10-03 кредитов 0») is out of date: 22,551 credits are available. Step 6 should run `reset-works` every time (see §3.4). This is an advisory for the WP9 owner or WP10; V1 does not edit `demo/`. | Advisory |
| Pilot-only items | `demo/pilot_backlog.md` is present. | N/A (pilot) |

## 6. Brief C §12 acceptance (plan §12 table)
| §12 item | How it was checked in V1 | Verdict |
|---|---|---|
| Scenarios 1, 3, 8, 9, 10 pass (RU, and LV where relevant), with recordings | WP8 round 2: critical 10/10, t04/t13/t18 2/2, **t21 0/4**. t26/t27 passed in WP8 but were not re-run (§4). The scenario 3 data path was verified live (§3.4). Recordings come from H3 talks. | **→ H3** (t21 known FAIL) |
| Latency < ~1.5 s, no talking over the caller | No synthetic call (ruling). Baseline from the WP4 spike for Haiku: server p50 1.22 s / p90 1.49 s; client p50 1.37 s / p90 2.25 s; LV turns about 1.5 s. The first turn after the greeting is slower (about 2–4 s). | **→ H3** (speaker, stopwatch) |
| Calendar + Sheet + Telegram within 15 s | Backend p90 608 ms; 10/10 on all three sinks (§3.2) | PASS (backend). **→ H3** stopwatch end to end |
| No paid GHL features | grep found 0 hits (§2) | PASS |
| AI disclosure first | `el:check`: both first messages contain the AI and recording notices; the first message cannot be interrupted; copy lint 0; the `ai_disclosed_first` criterion is in `elevenlabs/analysis/evaluation_criteria.json` | PASS (text). **→ H3** ear check |
| Human handover works | t17 and t18 pass (t18 2/2 in round 2); the `request_callback` tool is live in `el:check` | PASS (tests). **→ H3** «хочу с человеком» |
| Talk-to link works on a phone over mobile data; max duration set | max 300 s, daily limit 25, concurrency 2 (§2) | max duration PASS. **→ H3** phone over mobile data |
| Pilot-only items | `demo/pilot_backlog.md` | N/A |

## 7. Open issues (carried to H3 or rework)
1. **t21: the RU→LV switch fails in tests (0/4).** Anna answers in Latvian without calling `language_detection(lv)`, so speech recognition and the voice may stay in RU mode. → H3 talk 8.
2. **Cold-start CPU.** The first `get_slots` took 11 ms (the Workers Free limit is 10 ms), and it still succeeded. A warm-up via `/admin/health?deep=1` did **not** prevent this, so the health route probably does not warm the tool path. Keep the preflight test call through Anna, which warms the tool routes, plus the health warm-up.
3. **The Works tab can be empty**, and scenario 3 then fails. Run `reset-works` in every preflight (§3.4).
4. **Unverified LV lines** (`docs/lv_review.md`):
   - Does «asistenti Annu» sound like «asistentu» (27/27 spike samples)?
   - «Kurš jums ērtāk?» (the `slot_taken` phrase).
   - The stairwell ordinal «1. kāpņu telpa» should be read as «pirmā».
   - LV dates.
   - Accent on street names.
5. **Phone read-back ear check.** In WP8, t26 once read «двадцать два» for «двадцать», and the judge passed it anyway. At H3, listen to every number, phone, apartment count and price read-back, and to the `invalid_reschedule` re-read of the options.
6. Advisory: the run sheet's step 0 (credits) is out of date and its step 6 should be unconditional. `/admin/health` checks only 5 tab headers, not Tickets or Requests (those belong to M2).

## 8. Usage
V1 used 0 voice minutes, $0 in text tests and 0 credits. The ElevenLabs balance is 22,551. Telegram TEST chat: 11 new messages (10 integration, 1 digest); the real group got 0. Calendar: 0 events. The Sheet holds only the 3 demo Works rows.
