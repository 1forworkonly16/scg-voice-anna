# Handoff: Demo C voice assistant «Anna» for SCG, WP0-WP9, WP11, WP12 accepted; next V1 then H3 (credits topped up)

> **READ FIRST. The resuming session is the ORCHESTRATOR AND JUDGE ONLY. By the user's explicit instruction, ALL work (code, copy, data, prompts, verification, handoffs) is done by subagents.**

## Session Metadata
- Created: 2026-10-03 21:40 · Project: C:\Users\Banknote\Desktop\Dima smartcomfort\Dima voice (git repo, branch main) · Interim handoff, not a final WP10.
- **Continues from:** [2026-10-03-093010-voice-demo-wp0-3-accepted.md](./2026-10-03-093010-voice-demo-wp0-3-accepted.md). Plan: [docs/plan.md](../../docs/plan.md); status: [docs/status.md](../../docs/status.md). `../info/` is the workspace `info/` (read-only, hash-checked).

## Current State Summary
M1 is built, deployed and accepted except the live-voice checks; credits were topped up (see Blockers). All accepted 2026-10-03, one fresh Opus verifier each:
- **WP4 + Gate S/H2:** LV and RU verified on `eleven_v4_turbo`; voice Marina (`ymDCYd8puC7gYjxIamPt`) for both languages.
- **WP3 polish 800b4e6:** the 7 LV fixes applied, phrases moved to copy.
- **WP5 ab35c60:** service-account-only Google: calendar «SCG — Бесплатный осмотр», Sheet «SCG — Заявки (демо)», Telegram group plus test chat.
- **WP6:** Cloudflare Worker (tools, post-call webhook, crons, admin).
- **WP7 d833cdc:** Worker live at https://scg-voice-demo.scg-voice-demo.workers.dev; p90 0.66 s. Exception: cold-start CPU 9-14 ms, so **warm up with `GET /admin/health?deep=1` before the meeting**.
- **WP8 bb619b7, accepted after round 2 (2026-10-03):** critical 10/10; t04/t13/t18 fixed; t21 RU→LV still fails → H3 ear check; agent `scg-anna` (`agent_4801m41cmf0ge7er75wzv5nj3pn1`), LLM `claude-haiku-4-5`, **locked by default**; `npm run link:unlock|link:lock|link:status`; `el:check` 67/67. Round-1 critical text tests: Haiku 50/50 vs Sonnet 33/50. Report: [docs/agent_report.md](../../docs/agent_report.md).
- **WP9 883ae74:** demo kit in [demo/](../../demo/) (run sheet, QR, digest trigger, pilot backlog, widget snippet, backup-video shot list).
- **Usage:** text tests $2.76 cumulative; voice 10.88 min. Log: [docs/usage_log.md](../../docs/usage_log.md).
- **WP11 + WP12 accepted and committed as 9422504.** WP11 is staged in `elevenlabs/prompt_m2/` and `test_specs_m2/`. WP12 is **not deployed** as a Worker; the Tickets and Requests tabs are live, and an allowlist in `elevenlabs/agent_config.json` keeps the live agent on the 7 M1 tools. WP13, V2 and H4 follow M1.

## Immediate Next Steps
The meeting is **before 2026-10-24**; spend credits only on this list and keep most of them for the user's live tests:
1. **V1:** fresh Opus verifier, **no synthetic calls**; then the `scg-judge` M1 verdict.
2. **H3:** the user's live RU + LV test on a phone. Ear checks: scenario 10 RU→LV (t21: does ASR/TTS follow the switch?), «asistenti Annu»/«asistentu», «Kurš jums ērtāk?», number and phone read-backs, the `invalid_reschedule` re-read.
3. Rework, then the final WP10 handoff and the M1 report. Then M2: WP13, V2, H4.
Keep every gate green (`info-hash.py --check`, copy-lint, secret-scan via `env.ps1`).

### WP13 items (runs after M1 is done)
- Extend the allowlist, deploy the Worker, merge `prompt_m2` into the prompt, add the `en` preset.
- «пятно после протечки, сейчас не течёт» still escalates.
- Hyphenated local phone numbers (228-481-44) are not redacted.
- The EN confirmation line promises a callback even when no phone was taken.
- Fix the `ticket_alert_failed` wording.
- Callback reason names differ: hints use `ticket_followup`/`urgent_ticket`, the prompt uses `leak_ticket`/`ticket`.
- The zod `phone` description still says +371.
- `docs/tool_contract.md` claims `el:tools` attaches the M2 tools; false until the allowlist is extended.
- `npm run el:tools` PATCHes the live tools: it is **not** read-only.

## Important Context
- Roles, models and budgets are unchanged ([docs/plan.md](../../docs/plan.md), `../CLAUDE.md`). Sonnet for code/data/infra; Opus for prompt, copy, demo kit and every verifier.
- **Budgets:** the M1 text-test cap was raised to **$3.50** by the user's decision (the total cap of $5 is unchanged); voice 100 min total, warn at 80 min / $4.
- **Timing:** the meeting is before 2026-10-24 (2027 repair-plan season); do not spend credits on anything outside the list above.
- Fixed decisions: [docs/decisions.md](../../docs/decisions.md); platform facts: [docs/platform_facts.md](../../docs/platform_facts.md).

## Blockers
- None blocking. Correction: the earlier 0-credit state was **not** caused by ~330 EL Test runs (measured ~27-79 credits per run); most usage came from another, non-project agent in the workspace (66 conversations, ~70 min since 2026-09-24). See [docs/decisions.md](../../docs/decisions.md).
- The user topped up **≈27.5k credits on 2026-10-03**; 22,551 left after WP8 round 2. **Pay As You Go is forbidden** (CLAUDE.md rule 6).

## Potential Gotchas
- **Never batch many EL tests again:** estimate credits per run, cap repeats, run critical ones first, log each run in the usage log.
- The agent is **locked by default**; unlock only for a test or the meeting (`npm run link:unlock`), lock again after (`link:lock`, check with `link:status`).
- Warm the Worker before any demo (`/admin/health?deep=1`); otherwise the first tool call may hit the cold-start CPU limit.
- `scripts/*.ts` are outside the tsconfig `include`, so they are not type-checked.
- Still valid: env vars are invisible to running shells (use `scripts/env.ps1`); PowerShell 5.1 mangles JSON and Cyrillic (use Python/Node, `npx.cmd`); never type a secret or run plain `wrangler login`; never commit as a builder (the verifier commits after acceptance).

## Decisions Made
- The plan's «Decisions» table stands. New: voice Marina for LV and RU; TTS `eleven_v4_turbo`; LLM Haiku 4.5 (critical text tests 50/50 vs Sonnet 33/50); agent locked by default; M1 text cap $3.50 (user); no Pay As You Go (credit top-ups are the user's call); WP8 accepted after round 2 (t21 known issue).

## Architecture Overview
Unchanged: one Cloudflare Worker serves the ElevenLabs agent (`POST /tools/<name>`, post-call webhook, crons) and writes Google Calendar and Sheet and Telegram alerts, with the daily digest. Details: [docs/tool_contract.md](../../docs/tool_contract.md), [docs/test_report_backend.md](../../docs/test_report_backend.md).

## Critical Files
- Demo kit: [demo/run_sheet_ru.md](../../demo/run_sheet_ru.md), [demo/pilot_backlog.md](../../demo/pilot_backlog.md), [demo/digest_trigger.md](../../demo/digest_trigger.md), [demo/widget_snippet.md](../../demo/widget_snippet.md).
- Agent as code: `elevenlabs/agent_config.json`, `elevenlabs/tests.json`, `elevenlabs/test_results/`, `scripts/link.ts`, `scripts/check-agent.ts`; reports [docs/agent_report.md](../../docs/agent_report.md), [docs/lv_review.md](../../docs/lv_review.md).
- Brief C: `../info/demo-briefs/C_ai_phone_assistant.md`. Only price source: `../info/data/price_model_reference.py`.

## Assumptions Made
- Facts come from `info/` (A01-A25, S01-S61); unknowns are spoken as «это уточнит наш инженер» and logged. Demo flows use the fictional ДЕМО address Parauga iela 7.
- Open advisories: the WP6 list now lives in [demo/pilot_backlog.md](../../demo/pilot_backlog.md); widget privacy-policy URL is a visible placeholder `[уточнить]`.

## Files Modified
- **This session:** WP4-WP9 deliverables, committed in 623d0dc, ef4a15d, 800b4e6, 82f8b58, ab35c60, d833cdc, bb619b7, 883ae74 (see `git log`); this handoff; one status line in `../CLAUDE.md`. WP11/WP12 work is committed (9422504).
- Nothing in `info/` was touched (`scripts/info-hash.py --check`).
