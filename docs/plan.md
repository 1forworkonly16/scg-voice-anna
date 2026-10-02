# Plan: SCG voice AI demo (Brief C) in `Dima voice/`, built by subagents

## Context
The SCG knowledge base (`info/`) is complete, and nothing is built yet (handoff `.claude/handoffs/2026-10-02-130452-scg-ready-to-build-demos.md`). The user wants **Demo C, the AI phone assistant**, built in `C:\Users\Banknote\Desktop\Dima smartcomfort\Dima voice\`, with **all work done by subagents**. The main session only orchestrates and judges. It must be meeting-ready before building managers send their 2027 repair plans (mid-October → early November).

The agent's real job is answering SCG's phone, with a widget on the website later. Until a +371 number exists (pilot, in SCG's name), it is demoed through the **ElevenLabs public talk-to link** on a phone on speaker.

## Decisions (Q&A of 2026-10-02/03, fixed)
| Topic | Decision |
|---|---|
| Scope | **M1** (meeting-ready): scenarios 1, 3, 8, 9, 10 + live Calendar/Sheet/Telegram + daily digest + talk-to link. **M2**: scenarios 2, 4, 5, 6, 7 |
| Accounts | User has Telegram and ElevenLabs Creator; gcloud + `gws` are logged in as 1forworkonly16@gmail.com. **No Cloudflare account, no Anthropic key** (not needed: Claude is native in ElevenLabs) |
| Secrets | Windows **user env vars**, set with `[Environment]::SetEnvironmentVariable(…,'User')` from the clipboard (never typed; not `setx`, which truncates at 1024 chars). Agents load them by name via `scripts/env.ps1` and pipe them into `wrangler secret put` over stdin. Values never go into files |
| Subagent models | **Sonnet 5.5** for code, data and infrastructure. **Opus 5.5** for the agent prompt, RU/LV copy, the demo kit and every verification |
| Folder and session | **Everything is built inside `Dima voice/`**: code, agent config, data, docs, handoffs, settings and the archive. The build runs in a **new Claude Code session opened in `Dima voice/`**. `Dima voice/.claude/settings.local.json` already grants `additionalDirectories` (`info/`, read-only by rule), created before the session because the VS Code extension has no `/add-dir`. WP0 adds the narrow Bash allowlist to it. The only touches outside the folder: the root CLAUDE.md pointer line (workspace rule) and deleting the stray `info/data/__pycache__` |
| Check-ins | Stop at Gate S (+H2), at the end of M1 and of M2, and at the other human-only gates |
| Voice tests | The user, live, in RU and LV |
| Git | Local `git init` in `Dima voice/`, one commit per accepted work package, no remote |
| Dataset | 30-building fallback in `Dima voice/data/buildings/` (brief 00 schema). The Worker imports it directly; demos A/B copy it from there later |
| Google SA | A subagent creates GCP project `scg-voice-demo` (with a suffix if taken), the APIs and the SA. The key goes from stdout into the user env var and the wrangler secret. Calendar and Sheet are owned by 1forworkonly16@gmail.com and shared with the SA |
| E-mail / SMS | None in the voice demo. Anna reads the booking back; the consultant tells Dima «в пилоте придёт SMS» |
| Web page | None: talk-to link only. The widget snippet is documented for demo A |
| Budgets | ElevenLabs voice ≤ **100 min** in total, automated text tests ≤ **$5**. Warn the main session at 80 min / $4. No Pay As You Go top-up |
| Telegram | Group «SCG — Заявки (демо)» with history hidden for new members, plus a join QR for Dima. [TEST] traffic goes only to the user's private chat with the bot |
| Persona | **Anna / Анна**, female voice. AI disclosure + recording notice in the first sentence |
| Voice LLM | Native in ElevenLabs. Start with `claude-opus-5-5`. If the synthetic-voice end-to-end p50 exceeds 1.5 s, switch to `claude-sonnet-5-5`, then `claude-haiku-4-5`. Measured in the spike together with cost/min |
| Latvian risk | Spike first. If LV fails, stop and show the evidence; the user decides |
| Old scaffold | Partial scaffold from another, now-closed session (2026-10-02 13:41–13:52): WP0 moves it to `Dima voice/_archive/2026-10-02/` (git-ignored) and deletes its node_modules. WP2 may harvest `pyround.ts`, `quote.ts`, `address.ts` + tests, `time.ts` and `works.ts` only after they pass our tests. WP0 deletes the stray `info/data/__pycache__/` it created |

## Facts builders must respect (from the info/ digest)
- **Rounding:** Python `round()` rounds exact halves to the even number. 91880/16 → **5742**; 104680/16 → **6542**. The TS port needs `roundHalfEven`, and parity must cover these cases.
- **The price function:** `parametric_quote(floors, apartments, stairwells, scope="risers_complete", horizontals=True, sewer_outlet=False, pump_station=False, options=())`; scopes in `info/data/price_model_reference.py` L18. The copy's wording differs from the code (horizontals default on; heating is a separate scope), so the agent's wording follows the code. Monthly instalments and working-day estimates are **never spoken**.
- **Ilūkstes iela 16:** sourced 9 floors and 4 stairwells (`info/copy/site_text_lv.md` L318–320). 144 apartments is an assumption, and the year is null. Brief 00's formula (5 stairwells) loses to the source. Tirzes 3 k-2 stairwells are null.
- **Copy:**
  - RU script: `info/copy/ru_key_messages.md` L58–77; FAQ L51–57.
  - Co-financing answer L56, with the wording «2001 года или раньше» (04 L30).
  - Banned (L91–93): «за полцены», «вдвойне сэкономить», «гарантированно дешевле управляющего», «управляющий завышает цены», RNP named as a client or partner, any price without «ориентировочно».
- **Opening:** use brief C §3's structure: disclosure + recording notice in sentence 1, feminine Latvian («…mākslīgā intelekta asistente…»), ending «Kā varu palīdzēt? Можно по-русски.» L62 is masculine and discloses too late. The Opus copy builder writes the LV lines after the opening, and the user reviews them at H3.
- **Unknowns** (warranty, instalments, on-call, emergency numbers, engineer names, inspection lead time, works schedules, retention, 90% doc-support terms): spoken as «это уточнит наш инженер/менеджер», with the question logged to `unknown_questions` and Telegram.
- **Demo flows:** the works and warranty flows use a **fictional address** labelled ДЕМО (e.g. «Parauga iela 7»; "parauga" means "sample"). Never invent works at a real building.
- **Data minimisation:** data-collection fields hold no names or phone numbers. The Calls tab stores summary + criteria only, no transcript. `record_voice` is on, retention is 90 days.
- **Brief A alignment:** `request_callback` replaces A's `handoff(summary)`. The Leads `channel` gains `voice`. There is one shared contract (`docs/tool_contract.md`); `info/` stays unchanged.

## Verified platform facts (research of 2026-10-02/03; WP0 copies them into `Dima voice/docs/platform_facts.md` with URLs)
**ElevenLabs Agents**
- **Latvian TTS in agents:** only `eleven_v3_conversational` and `eleven_v4_turbo` (v4 Turbo arrived in agents on 2026-09-28); Flash v2.5 and Multilingual v2 have no Latvian. One docs page claims extra languages fall back to Multilingual v2.5, so **the spike decides**. ASR is `scribe_realtime` (LV and RU).
- **Languages:** `conversation_config.agent.language` (default `lv`), `language_presets.<code>.overrides` (first_message, prompt, tts.voice_id), and the `language_detection` system tool (any turn) for mid-call switching. The greeting plays before the language is known, hence the bilingual greeting.
- **Claude available natively:** `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5`. LLM usage is billed on top of minutes (≈ $0.003–0.04/min by third-party estimates; Opus costs more). The spike measures the real figure.
- **Talk-to link:** `https://elevenlabs.io/app/talk-to?agent_id=<id>`; it needs auth off. Agent settings: `conversation.max_duration_seconds` = 300, `daily_limit`, `agent_concurrency_limit`. For demo A later: `<elevenlabs-convai agent-id>` + `unpkg.com/@elevenlabs/convai-widget-embed`, with a `terms_text` consent modal.
- **Webhook tools:**
  - Created with `POST /v1/convai/tools`, `api_schema` {url, method, request_body_schema, request_headers}. The header value is `{secret_id}` (a workspace secret).
  - Body properties can bind a `dynamic_variable`, e.g. `system__conversation_id`.
  - Timing: `response_timeout_secs` (default 20). `pre_tool_speech` is an enum (`auto|force|off`), so the filler wording lives in the prompt.
  - ElevenLabs doesn't sign tool calls, so the secret header (`crypto.subtle.timingSafeEqual`) is the only protection.
  - System tools: `end_call`, `language_detection`, `skip_turn`. `transfer_to_number` is phone-only.
- **Time:** `system__time_utc` exists; `system__timezone` is user-provided (the spike tests it). `get_slots` returns slot labels and "today" in Riga time anyway.
- **Post-call webhook:**
  - **Workspace-wide**, so filter by agent id or use the per-agent override (`platform_settings.workspace_overrides.webhooks.post_call_webhook_id`). Ask before replacing an existing workspace webhook.
  - `post_call_transcription` carries the transcript, `metadata` (duration, cost) and `analysis` (data_collection_results, evaluation_criteria_results, transcript_summary).
  - Signature: `ElevenLabs-Signature: t=<unix>,v0=<hex>`, where v0 = HMAC-SHA256(secret, `${t}.${rawBody}`). Several v0 values may appear; reject anything older than 30 min. Always return 200, because the webhook is auto-disabled after 10+ failures.
  - Up to 25 data fields and 30 evaluation criteria per agent.
- **Testing:** simulate-conversation is deprecated. Use **Tests** (Simulation / Next-reply / Tool-call, with tool mocking and repeats) via `POST /v1/convai/agent-testing/create`, `…/agents/{id}/run-tests` or `elevenlabs agents test`. Tests are charged at unpublished rates. Text-only conversations cost $0.003/message + LLM, no minutes.
- **Agent as code:** `@elevenlabs/cli` 1.4.0 (`elevenlabs agents init|add|pull|push --dry-run|status|test`, `tools add`), reading `ELEVENLABS_API_KEY`. **All agents are now versioned** (PATCH's `enable_versioning_if_not_enabled` is ignored). The spike checks whether a push goes live on the talk-to link without a separate publish step.
- **Privacy:** EU residency and zero retention are Enterprise-only, so Creator processes in the US. `privacy.retention_days` = 90 → `pilot_backlog.md` (SCG DPA, EU option).
- **Creator plan:** 275 min, overage $0.08/min only from prepaid Pay As You Go credit (the service pauses at a $0 balance), 10 concurrent calls, silence > 10 s billed at 5%. Keep ≥ 60 min in reserve for rehearsal and the meeting.

**Cloudflare / Google / Telegram**
- **Workers Free:** 10 ms CPU per invocation (requests and cron), 100k requests/day, 50 subrequests per invocation, 5 cron triggers (UTC), secrets up to 5 KB. workers.dev is fine for the demo.
- **Wrangler v4** (4.146.0) as a dev dependency. Auth: `CLOUDFLARE_API_TOKEN` ("Edit Cloudflare Workers" template) + `CLOUDFLARE_ACCOUNT_ID` as user env vars. Never use a plain `wrangler login` (plaintext token file). Secrets: `$v | npx wrangler secret put NAME` after `$OutputEncoding=[Text.UTF8Encoding]::new($false)`; trim CRLF in the Worker. Local dev: `$env:CLOUDFLARE_INCLUDE_PROCESS_ENV='true'`, no `.dev.vars`.
- **Windows:** use `npx.cmd` in the user's own PowerShell window. PSReadLine logs typed lines, so never type a secret. PowerShell 5.1 mangles JSON arguments and Cyrillic, so provision in Python/Node.
- **Google SA from Workers:**
  - Auth: RS256 JWT via WebCrypto or `jose` v6, token exchange, cached ≈ 1 h.
  - Scopes `auth/calendar` + `auth/spreadsheets`.
  - Sharing: calendar ACL `writer`, Sheet as Editor.
  - Limits: no attendees or invites, no Meet links; reminders follow the user's calendar defaults.
  - Sheets writes use `valueInputOption=RAW`.
- **gcloud:** `gcloud iam service-accounts keys create - --iam-account …` prints the key to stdout (verified in the installed SDK). Check that `gcloud projects describe <id> --format="value(parent)"` is empty. Enable `serviceusage` first. Delete any orphan key if piping fails. If enabling the APIs without billing fails, fall back to the existing gws project.
- **Telegram:** `sendMessage` with `parse_mode: "HTML"` (escape `& < >`). The group id comes from `getUpdates` (`my_chat_member`, negative id; -100… for supergroups). About 20 messages/min per group. Call it via `Invoke-RestMethod`, never the browser.

## Orchestration model
- **Main session (Opus 5.5): orchestrator and judge only.** I write each subagent brief (task, owned paths, narrow reading list with line ranges, outputs, acceptance criteria, forbidden actions, budget), launch it, and judge. I write no code, prompts or copy.
- **Builders:** `general-purpose` subagents in the background (WP0 in the foreground). They run in parallel only when they own disjoint paths. Forbidden for all: editing `info/`, writing secret values to files, GHL paid features, Pay As You Go top-ups, exceeding budgets without asking.
- **Verifier:** a fresh Opus `general-purpose` subagent per gate. It never fixes anything. It re-runs the tests, probes edge cases and checks the CLAUDE.md rules, the copy lint, the secret scan, the `info/` hash and the budgets. It reports pass/fail per acceptance item with commands and outputs. On ACCEPT it updates `docs/status.md` + `docs/usage_log.md` and commits only that WP's owned paths (`git add -- <paths>`).
- **My judging per WP:**
  1. Read the builder report (≤ 300 words) and the verifier report.
  2. Check `git diff --stat`.
  3. Spot-check the key artefacts myself (prompt text, price port, booking flow).
  4. **ACCEPT**, or **REWORK** via `SendMessage` to the same builder with numbered fixes. After 2 failed reworks I escalate to the user.
- **Judge at max effort, automatically:** the session runs on Opus 5.5 at high effort (subagents without an `effort` key inherit it). At Gate S (WP4's report) and at the M1/M2 verdicts (V1/V2 reports) I dispatch the read-only `scg-judge` subagent (`Dima voice/.claude/agents/scg-judge.md`: Opus, `effort: max`) with the evidence paths, review its verdict and report to the user. The user never switches effort. WP0 must not move or delete `.claude/agents/`.

## Human gates (only the user can do these)
- **H0, before WP0:**
  - Open VS Code at `C:\Users\Banknote\Desktop\Dima smartcomfort\Dima voice\`, start Claude Code there and say «Resume from the latest handoff».
  - Set the permission mode to **«Auto»** (never Bypass permissions). Safety net: `Dima voice/.claude/settings.json` deny rules (no edits in `info/`, no `git push`, `npm publish`, `wrangler delete` or `gcloud projects delete`), enforced in every mode and hot-reloaded.
- **H1, after WP0, one sitting** (exact click steps in `Dima voice/docs/setup_keys.md`; values set from the clipboard):
  1. **ElevenLabs API key** first, so the spike can start. Scopes: convai_read/write, voices_read/write, webhooks_write, conversation_privacy_manage, text_to_speech, user_read.
  2. **Cloudflare:** free account, claim the workers.dev subdomain, token from the "Edit Cloudflare Workers" template, plus the account id.
  3. **Telegram:**
     - @BotFather → `TELEGRAM_BOT_TOKEN`.
     - Create the group «SCG — Заявки (демо)», set "history hidden for new members", add the bot and post one message.
     - Send /start in a private chat with the bot.
     - Create an invite link.
  4. **Google:** `gws auth login` only if WP5's probe reports an expired token.
- **Gate S + H2, after WP4, one sitting:**
  - I show the evidence: the LV verdict, latency and cost/min per LLM, and voice samples.
  - The user picks the voice; one bilingual female voice is preferred, so Anna never sounds like two people.
  - If LV fails, the user decides the fallback.
- **H3, end of M1:**
  - Check that the calendar «SCG — Бесплатный осмотр» (account 1forworkonly16@gmail.com) shows in the Google Calendar app on your phone and that Telegram notifications are on. That is the wow moment.
  - Live RU + LV tests through the talk-to link on the phone over mobile data, on speaker, in the real meeting setup. Time the bookings with a stopwatch.
  - Review `docs/lv_review.md`.
  - One clean rehearsal.
  - Record the backup video of scenario 1.
- **H4, end of M2:** live tests of scenarios 2 and 4–7.

## Work packages
**Order:**
1. H0 → WP0.
2. WP1 ∥ WP2 ∥ WP3 (no keys needed), while the user does H1.
3. After H1: WP4 ∥ WP5. WP6 starts once WP2 is done.
4. Gate S + H2.
5. WP7 → WP8 → WP9 → V1 → my judgement → H3 → rework → WP10 → **STOP (M1 report)**.
6. M2: WP11 ∥ WP12 → WP13 → V2 → H4 → handoff → **STOP**.

**Budget split:**
- Voice minutes: spike 15, V1 synthetic 10, H3 25, M2 synthetic 5, H4 20, contingency 25.
- Text tests: spike $0.5, M1 $2.5, M2 $1.5, reserve $0.5.

| WP | Owner | Owns → delivers | Acceptance (the verifier runs it) | After |
|---|---|---|---|---|
| **WP0** Setup (foreground) | Sonnet | **Owns:** DV skeleton; `.gitignore` (including `_archive/`); folder `CLAUDE.md` (rules + the token-lean working style, because info/'s memory doesn't load here); `.claude/settings.local.json` (adds the allowlist plus a deny rule for Edit/Write under `info/`, keeps `additionalDirectories`; the file is git-ignored); `docs/{plan,decisions,platform_facts,setup_keys,status,usage_log}.md` (`plan.md` is a copy of this plan); `docs/info_manifest.sha256`; `scripts/{env.ps1,info-hash.py}`. **Also:** moves the old scaffold to `_archive/2026-10-02/` (never touching `.claude/`), deletes `info/data/__pycache__`, adds the root CLAUDE.md pointer line | 1 commit; `info-hash.py --check` returns 0 (excluding `__pycache__`, `.claude`); setup_keys names every env var; secret scan clean; archive present without node_modules; nothing from `_archive/` tracked by git | H0 |
| **WP1** Dataset | Sonnet | **Owns:** DV `data/buildings/**`. **Delivers:** seed with per-field provenance, `build.py` (runs the selftest first), `out/riga_buildings.json`, `out/riga_buildings_search.json`, MANIFEST, tests | `python build.py` returns 0; 30 records with brief-00 keys; Ilūkstes 9 floors / 4 stairwells sourced, year null; every non-null field has a source (VZD extract time-boxed to 2 h → OSM `building:levels` with element id → null); fictional ДЕМО works address present | WP0 |
| **WP2** Core lib | Sonnet | **Owns:** DV `package*.json`, tsconfig, vitest config, `src/{lib,contract,data}`, `scripts/{gen-parity.py,sync-data.mjs,copy-lint.mjs,secret-scan.mjs}`, `tests/{unit,lint,fixtures}`. **Delivers:** quote port, address matcher, slots/holidays/DST, works logic, speech phrases, zod contract → EL tool JSON + `docs/tool_contract.md` | `npm test` green: parity 100% including 5742, 6542 and every tie kind; ≥ 40 RU/LV spoken addresses; DST 2026-10-25 and 2027-03-28; holiday list cites its source; `sync-data --check` returns 0; typecheck clean | WP0 (data sync after WP1) |
| **WP3** Prompt + copy | **Opus** | **Owns:** DV `elevenlabs/{prompt,analysis,test_specs}`, `src/copy`, `docs/{scenarios,lv_review,prompt_sources}.md`. **Delivers:** 8-section system prompt, first message, lv/ru presets, phrase templates, M1 scenario scripts, ~24 test specs, 16 data fields, 14 evaluation criteria | copy lint green; 10 sampled facts trace to an `info/` file:line; disclosure in sentence 1; no SMS/e-mail promises | WP0 |
| **WP4** Spike | Sonnet | **Owns:** DV `spike/**`, `scripts/el/{usage,voice-caller}.ts`, throwaway agents `scg-spike-*`. **Delivers a report answering:** is `lv` accepted and is the TTS model kept; does mid-call LV↔RU switching work; are LV numbers and dates spoken correctly; how do versioning and publishing behave; what are latency and cost/min for each of the 3 LLMs. **Plus:** 3 LV + 3 RU + bilingual female samples of Anna's opening | every question answered with evidence (redacted JSON, audio); ≤ 15 min, ≤ $0.5; spike agents deleted | H1 |
| **WP5** Provision | Sonnet | **Owns:** DV `scripts/provision/**`, `docs/resources.md`. **Delivers:** GCP project/APIs/SA (key → user env var), calendar (Europe/Riga) + ACL, Sheet tabs + headers + Drive share, Telegram chat ids | no parent org; exactly 1 SA key; env JSON parses (only the email is printed); ACL is writer; headers read back; `getChat` works for group + test chat; no key file on disk | H1 |
| **WP6** Worker | Sonnet | **Owns:** DV `src/{index.ts,routes,google,notify,webhooks,admin}`, `tests/worker`, `wrangler.jsonc`. **Delivers:** routes, auth, JWT client, Calendar/Sheets/Telegram, post-call webhook, digest + crons | mocked-fetch tests: success, timeout → fallback phrase, slot_taken, 409 replay, 401, HMAC valid/stale/rotated; ≤ 6 subrequests per tool; `wrangler deploy --dry-run` passes | WP2 |
| **WP7** Deploy + live backend | Sonnet | **Owns:** DV `scripts/{secrets.mjs,integration.ts}`, `docs/test_report_backend.md`. **Delivers:** live Worker, secrets set via stdin | 10 [TEST] bookings: p90 < 5 s (hard limit 15 s) with Calendar, Sheet and Telegram verified; max CPU < 8 ms (`wrangler tail`); nothing [TEST] left behind; tests only post to the test chat | WP5, WP6 |
| **WP8** Agent as code | Sonnet (content from WP3) | **Owns:** DV `elevenlabs/{agents,tools,tests}.json`, configs, `scripts/{gen-tools,build-agent,check-agent,link}.ts`. **Delivers:** workspace secret, per-agent webhook, tools generated from zod, agent locked by default, EL Tests | `check-agent` all PASS (300 s, daily_limit 25, concurrency 2, retention 90, auth on); `elevenlabs agents status` in sync; critical tests 100%, others ≥ 1 of 2 repeats; ≤ $2.5 cumulative for M1 | WP3, WP7, Gate S + H2 |
| **WP9** Demo kit | **Opus** | **Owns:** DV `demo/**`. **Delivers:** `run_sheet_ru.md` (4-minute script for the talk-to link; preflight `npm run link:unlock` + a test call; fallback; pilot lines; costs from 08 §0/§0b), join QR, digest trigger, backup-video shot list, widget snippet for demo A, `pilot_backlog.md` (number, SMS, transfer, EU/DPA) | QR decodes; copy lint passes; ≤ 2 pages | WP8 |
| **V1** M1 verification | **Opus** (fresh) | **Owns:** DV `docs/{test_report_M1,live_checklist_M1}.md`. **Delivers:** full re-run + 2 synthetic voice calls | every §12 item PASS or handed to H3; ≤ 10 min | WP9 |
| **WP10** Handoff | Sonnet | **Owns:** DV `.claude/handoffs/` + root CLAUDE.md line | ≤ 80 lines, same headings as before; validator ≥ 70, no secrets | H3 + rework |
| **M2** WP11 copy ∥ WP12 backend → WP13 agent update → V2 | Opus / Sonnet / Sonnet / Opus | `create_ticket`, `log_request`, Tickets/Requests tabs, leak escalation, the en preset (scenario 6), co-financing in LV (scenario 2), non-client emergency referral (scenario 5) | as WP3/WP6/WP7/WP8; ≤ 5 min, ≤ $1.5 | V1 accepted |

## Architecture and contracts
- **Layout:**
  - DV: `src/` (index.ts, routes/, contract/ as the single zod source, lib/, google/, notify/, webhooks/, admin/, copy/, data/), `elevenlabs/` (CLI project + prompt/analysis/test_specs), `scripts/`, `tests/{unit,worker,lint,fixtures}`, `spike/`, `demo/`, `docs/`, `recordings/` (ignored).
  - `.gitignore`: node_modules, .wrangler, dist, recordings, spike/samples, audio, `_archive/`, `.dev.vars*`, `.env*`, `*.pem`, `*key*.json`.
  - `data/buildings/`: `seed/`, `build.py`, `sources/`, `out/`, `tests/`, README. `_archive/2026-10-02/` holds the old scaffold.
- **Responses:** always HTTP 200 `{ok, v, say_ru, say_lv, hint, …}`, with 401 only for a bad key. Every request carries `conversation_id` (bound to `system__conversation_id`) and `language`. `channel` comes from which key was used (voice key now; a web key for demo A later).
- **Tools:**

| Tool | Required input | Output (besides `say_*`) | Side effects |
|---|---|---|---|
| `lookup_building` | address | status found/confirm/need_house/not_found, confidence, building {floors, stairwells, apartments, `sourced[]`}, ≤ 3 candidates | none |
| `quote_range` | floors, stairwells, apartments (+ scope, horizontals, sewer_outlet, pump_station, options) | low/base/high × net/gross, per_apartment_gross, model_version | none |
| `get_slots` | (weekday, date range, part_of_day) | today label, office_open_now, ≤ 3 slots {ISO start, label_ru, label_lv} | freeBusy read |
| `book_inspection` | slot_start, address_spoken, floors, stairwells, apartments, caller_role, name, phone, consent (+ qualification fields, unknown_questions) | booking_id; errors slot_taken (+2 alternatives), invalid_slot, invalid_phone, calendar_down | Calendar written synchronously; Leads row + Telegram in `waitUntil` |
| `find_works_schedule` | apartment + address/building_id | stairwell, current date/window, ≤ 3 options | read Works/Access |
| `reschedule_access` | building_id, apartment, new_date, new_window | access_id | Access row + Telegram |
| `request_callback` | reason, summary_ru, phone, consent | callback_id | Callbacks row + Telegram |
| `create_ticket` (M2) | type, urgency, description, address | ticket_id, scg_site, escalated | Tickets row + «СРОЧНО» alert |
| `log_request` (M2) | kind (b2b, job_candidate, emergency_referral, admin_message, …), summary_ru | request_id | Requests row + Telegram |

- **Price speech, built by code:**
  - Starts with «Ориентировочно» / «Orientējoši» and gives the amount net and «с НДС 21%».
  - Amounts ≥ €10,000 are rounded outward to thousands; smaller ones to the nearest 100; the per-apartment figure to the nearest 10.
  - Ends with «точную цену даст инженер после бесплатного осмотра».
- **Quote port:** `gen-parity.py` (sets `sys.dont_write_bytecode`, runs `selftest()` first) produces a fixture of ≤ 300 KB holding the model version + the SHA-256 of `price_model.json`. `sync-data.mjs` copies `price_model.json` from `info/` into `src/data/`; its `--check` runs before the tests and fails on any drift.
- **Address matching:**
  1. Normalise: lowercase → Cyrillic to Latvian-style transliteration → strip diacritics → spoken numbers to digits → drop city, postcode and street-type words → parse house number, korpuss and apartment.
  2. Match with Jaro-Winkler ≥ 0.88 on street names + aliases; the house number must match exactly.
  3. If not found, ask for floors, stairwells and apartments.
  4. Anna states only the `sourced[]` fields.
- **Slots:**
  - Mon–Fri, 1-hour slots starting 09:00–16:00, Europe/Riga via `Intl`, Latvian holidays 2026–27.
  - Earliest slot is the next working day (a demo assumption); horizon 14 days.
  - At most 3 offers, spread across days and mornings/afternoons; the slot is re-checked at booking.
- **Google:**
  - **Sheet «SCG Leads»:** tabs Leads (brief A's 20 columns in order + voice extras), Calls, Works (ДЕМО rows), Access, Callbacks (+ Tickets, Requests). RAW writes; `is_test` is the last column.
  - **Calendar «SCG — Бесплатный осмотр»:**
    - Title `Осмотр: <адрес> · <N> эт., <N> под. [ДЕМО]`.
    - The description holds booking, caller, building, price range and questions, and ends «Записала ИИ-ассистент Анна».
    - `extendedProperties.private` {conversation_id, lead_id, is_test}.
  - **Idempotency:** event id = first 32 hex characters of SHA-256(`conversation_id|inspection`). On a 409 with the same slot, return the existing event; with a different slot, re-check it, PATCH the event and send «перенос».
- **Telegram (HTML, RU, every message ends `ДЕМО · <ID>`):**
  - booking (the brief C §1 line + systems / price / contact / access / questions)
  - reschedule (`Прорабу: в пилоте — SMS`)
  - callback
  - digest, built from real Sheet rows only
  - M2 ticket «СРОЧНО»
- **Worker:**
  - **Routes:** `POST /tools/<name>` (`x-scg-key`); `POST /webhooks/elevenlabs` (HMAC, agent-id filter, always 200, Calls row without the transcript).
  - **Admin** (`x-admin-key`): health, digest, demo/reset-works, test/cleanup.
  - **Crons:** `0 15 * * 1-5` digest, `0 4 * * *` rolls the demo Works dates forward.
  - **Timeouts:** Google 3.5 s, Telegram 3 s, whole tool ≤ 6 s (ElevenLabs timeout 8 s, 10 s for booking).
  - **Efficiency:** Google token cached per isolate and pre-warmed during the lookup; ≤ 6 subrequests per tool.
- **Agent:**
  - **Prompt sections:**
    1. Identity and disclosure.
    2. Languages: switch only on a full sentence in another language; Latvian street names in Russian speech don't count.
    3. Style: ≤ 2 sentences per turn, read numbers back, formal «вы».
    4. Flows: minimum qualification set, resident during works, handover = `request_callback`, unknowns.
    5. Tool rules: filler line before slow tools; relay `say_<lang>`; never compute prices or dates; confirm only after `ok:true`.
    6. Facts.
    7. Never-list.
    8. Demo-mode lines.
  - **Tools:** `language_detection` (custom description), `end_call`; `pre_tool_speech: force` on the slow tools; no interruptions during booking; temperature ≈ 0.3.
  - **Locked by default** (`enable_auth: true`): `npm run link:unlock|lock|status`, and every push re-locks.

## Verification
| Layer | What it covers |
|---|---|
| Unit (vitest) | price parity and rounding, address matcher, slots/DST/holidays, works, speech rules, zod ↔ EL JSON, HMAC/auth, handlers with a fetch counter, data drift |
| Integration (deployed Worker) | every success and error path, idempotent replay, 10 timed bookings (event GET, row read, Telegram `message_id`), CPU from `wrangler tail`, cleanup via `is_test` |
| ElevenLabs Tests | ≈ 22 Next-reply/Tool-call tests with mocked tools + 2 Simulations (scenarios 1 and 3), ×2 repeats; cost calibrated on the first 3 runs |
| Synthetic voice | `voice-caller.ts` streams TTS caller audio: latency from end of caller audio to the agent's first audio, plus the ASR transcript |
| Transcript lint | every euro amount Anna says appears in an earlier tool result; banned phrases; «ориентировочно» next to every price |
| Copy lint / secret scan / `info/` hash | ru_key_messages L91–93 + LV equivalents, disclosure in sentence 1, no SMS/e-mail promises, no `[уточнить]` spoken; key patterns + an exact-value scan of user env vars (names printed only); `info-hash.py --check` at every gate |
| Usage meter | `el/usage.ts` sums voice minutes and $ since 2026-10-03 and adds a row per WP to `usage_log.md` |

| Brief C §12 item | How it is checked |
|---|---|
| Scenarios pass (RU, LV where relevant), with recordings | EL Tests + synthetic run + H3 (scenarios 1, 3, 8, 9, 10) / H4 (2, 4–7); audio fetched by conversation id |
| Latency < ~1.5 s, no talking over the caller | synthetic p50/p90 + EL turn metrics; H3 on speaker |
| Calendar + Sheet + Telegram in < 15 s | integration p90 + H3 stopwatch |
| No paid GHL features | grep shows no GHL code or keys; noted in the report |
| Disclosure first; human handover works | copy lint + the `ai_disclosed_first` criterion on every call; a `request_callback` test + «хочу с человеком» at H3 |
| Talk-to link works on a phone over mobile data; max duration set | H3 on mobile data; `check-agent` (the widget belongs to demo A) |
| Pilot-only items | N/A → `pilot_backlog.md` |

## Risks and mitigations
1. **Latvian maturity / contradictory docs:** the spike decides. Fallback: code spells numbers out as words. If LV fails, the user decides.
2. **False LV switch on Latvian street names:** detection-tool description + a Next-reply test.
3. **The 300 s cap vs. a full qualification:** use the minimum flow and give the caller information-dense lines. Raise the cap to 420 s only if rehearsal shows calls being cut off.
4. **Speakerphone echo:** run H3 in the real setup and tune turn eagerness and volume.
5. **Locked link forgotten before the meeting:** preflight step in the run-sheet.
6. **User env vars invisible to running shells:** `env.ps1` loads them from User scope in every command.
7. **gws token expiry:** probe first, then re-login.
8. **PowerShell 5.1 quoting/encoding:** Python/Node provisioning, trimmed secrets.
9. **Double booking race:** acceptable for the demo; re-check after insert in the pilot.
10. **US processing on Creator:** pilot backlog item.
11. **LLM cost per voice minute is billed on top:** measured in the spike; `usage_log` reports $ at every gate.

## Execution start (after approval)
1. From this session, a Sonnet subagent writes the handoff into **`Dima voice/.claude/handoffs/2026-10-03-<time>-voice-demo-plan-approved.md`**. It is ≤ 80 lines, uses the same headings as the last handoff, links to this plan and lists H0. The subagent adds the folder's pointer line to the root CLAUDE.md ("Where things are") and validates with the skill's script (`PYTHONUTF8=1`, run from `Dima voice/`).
2. The user closes this session and opens a new one in `Dima voice/` (H0).
3. The fresh orchestrator reads the handoff, this plan (after WP0, its copy `docs/plan.md`) and brief C §3–4 + §10–12. Then H0 → WP0 → the rest as above.
