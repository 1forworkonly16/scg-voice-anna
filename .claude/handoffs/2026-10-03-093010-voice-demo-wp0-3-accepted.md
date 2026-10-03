# Handoff: Demo C voice assistant «Anna» for SCG, WP0-WP3 accepted, next H1 keys then WP4/5/6

> **READ FIRST. In the session that resumes from this file you are the ORCHESTRATOR AND JUDGE ONLY. By the user's explicit instruction, ALL work (code, copy, data, prompts, verification, handoffs) is done by subagents. You do none of it yourself.**

## Session Metadata
- Created: 2026-10-03 09:30:10 · Project: C:\Users\Banknote\Desktop\Dima smartcomfort\Dima voice (git repo, branch main)
- Session: orchestration of WP0-WP3 (build, fresh Opus verification, commit per accepted WP).
- **Continues from:** [2026-10-03-011251-voice-demo-plan-approved.md](./2026-10-03-011251-voice-demo-plan-approved.md). Plan: [docs/plan.md](../../docs/plan.md), an identical copy of `C:\Users\Banknote\.claude\plans\read-the-latest-session-refactored-bachman.md`; use the copy. Paths are relative to `Dima voice/`; `../info/` is the workspace `info/`. Workspace chain: [2026-10-02-130452-scg-ready-to-build-demos.md](../../../.claude/handoffs/2026-10-02-130452-scg-ready-to-build-demos.md).

## Current State Summary
H0 done. WP0-WP3 are **accepted and committed**, each by a fresh Opus verifier (status table: [docs/status.md](../../docs/status.md)).
- **WP0 setup, 60df8a5:** old scaffold archived to `_archive/2026-10-02`, git init, docs, `scripts/env.ps1`, `scripts/info-hash.py`, settings allowlist.
- **WP1 dataset, 69b6977:** 30 buildings with per-field provenance (VZD 2026-09-26, OSM, INFO); Parauga iela 7 ДЕМО record.
- **WP2 core lib, 1d4f296:** 269 tests; quote parity 449 cases incl. 5742/6542; address matcher; slots/DST/holidays; works; zod contract + `toElevenLabsTool`; copy-lint; secret-scan; [docs/tool_contract.md](../../docs/tool_contract.md).
- **WP3 prompt + copy, 33c814c:** 8-section prompt 1,416 words; bilingual first messages; `src/copy/phrases.ts` 17 keys; 16 data fields; 14 criteria; 27 test specs; docs/scenarios, lv_review, prompt_sources.
- **Usage:** 0 voice minutes, $0. Nothing is deployed; no keys exist yet.

## Immediate Next Steps
1. **User does H1** with [docs/setup_keys.md](../../docs/setup_keys.md). ElevenLabs key first. Verify line: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\env.ps1 -Check`. The user then sends the check output plus the Telegram invite link.
2. **WP6 Worker can start now** (needs only WP2, no keys): Sonnet, background. Verify the holiday transfers online there.
3. After H1: **WP4 spike ∥ WP5 provision**. Then Gate S + H2 (dispatch `scg-judge` on the WP4 report), WP7, WP8, WP9, V1, H3, WP10, then STOP with the M1 report.
4. Before H3: the WP3 polish below (Opus, small).

## Important Context
- Role, models, budgets, check-ins, scope: unchanged from the previous handoff and the plan («Orchestration model», «Work packages»). Sonnet for code/data/infra; Opus for prompt, copy, demo kit and every verifier. Voice max 100 min, text tests max $5. Rules in `../CLAUDE.md` bind every subagent.
- **Orchestrator rulings this session (supersede the plan's facts list):** Ilūkstes iela 16 = floors 9 (SCG's own source; VZD's 10 only in data_notes), stairwells 4 (INFO), apartments 141 + year 1981 (VZD, sourced). So «144 = assumption, year null» is superseded; base price ≈ €90,320 net (riser sets 16). Jūrmalas gatve 59 floors null (OSM 12 vs VZD 13). Register spelling «Tirzas iela», «Tirzes» as alias. Unsourced stairwells stay null, so Anna asks the caller.
- **WP3 polish before H3 (Opus):** apply the verifier's 7 LV fixes: co-financing list in the genitive; «Šai adresei un dzīvoklim darbu grafiku neatradu»; «vēl ir pieejami … Kurš jums ērtāk?»; «{stairwell}. kāpņu telpa»; «saglabāsim jūsu vārdu un tālruņa numuru»; female «mājas vecākā» alternative; «Esmu jūs pierakstījusi bezmaksas apsekošanai». Also fix the prompt_sources company.json L57 to L58 citation.
- **Holidays:** `src/data/holidays_lv.json` was written offline. Statutory dates verified. 2027-05-03 and 2027-12-27 are non-statutory assumption days, treated as non-working (safe). Cabinet working-day transfers are unchecked: verify online in WP6/V1.
- **WP8:** confirm ElevenLabs accepts `description` + `dynamic_variable` together on `conversation_id`. WP3 test specs use an extra `tool_calls` field on agent turns in `chat_history`; the converter must handle it. `presets.json` `prompt_addendum` is APPENDED to the system prompt.
- **WP2 `findSlots`** tops up to 3 slots from the unfiltered set and sets `filter_relaxed` when a filter leaves fewer; Anna should say the preferred time was not available.
- **copy-lint advisory:** any heading containing "never" exempts its section; only «# 7. Never» matches today.

## Blockers
- **Keys (H1)** gate WP4, WP5 and everything after. Values go into Windows user env vars from the clipboard; names only in docs.
- **Latvian TTS in ElevenLabs agents is still unproven;** WP4 decides. If LV fails, stop, show the evidence, let the user decide.

## Potential Gotchas
- The plan's session limit was hit mid-run. Background agents die with a 429; after the reset, resume each with SendMessage («check what exists, finish»).
- The VZD ZIPs (~350 MB) lived in a scratchpad and are gone. Re-fetch via `data/buildings/sources/` scripts only if a rebuild needs them; the committed `vzd_extract.json` suffices for `build.py`.
- `.claude/settings.json` (from the planning session, not WP0) has broad allows (`npm *`, `git *`, `npx wrangler *`) and denies (git push, wrangler delete, gcloud projects delete). Left as is; the user was told.
- The user's PowerShell execution policy is Restricted: user-facing scripts run via `-ExecutionPolicy Bypass -File`.
- Several verifier commits ran in parallel without trouble when each staged only its own paths.
- Still valid: env vars are invisible to running shells (use `scripts/env.ps1`); PowerShell 5.1 mangles JSON and Cyrillic (use Python/Node, `npx.cmd`); never type a secret or run plain `wrangler login`; Python `round()` is half-even (TS port uses `roundHalfEven`).

## Decisions Made
The plan's «Decisions» table stands; do not reopen it. New this session: the orchestrator rulings under Important Context; one commit per accepted WP; the settings.json allow/deny set kept as is.

## Architecture Overview
Unchanged: one Cloudflare Worker (`POST /tools/<name>`, post-call webhook, crons) serves the ElevenLabs agent, managed as code; it writes Google Calendar and Sheet and sends Telegram alerts. Details: plan «Architecture and contracts» and [docs/tool_contract.md](../../docs/tool_contract.md).

## Critical Files
- Plan [docs/plan.md](../../docs/plan.md); status [docs/status.md](../../docs/status.md); keys [docs/setup_keys.md](../../docs/setup_keys.md); contract [docs/tool_contract.md](../../docs/tool_contract.md); LV review [docs/lv_review.md](../../docs/lv_review.md); scenarios [docs/scenarios.md](../../docs/scenarios.md).
- Code and data: `src/copy/phrases.ts`, `src/data/holidays_lv.json`, `src/data/price_model.json`, `scripts/env.ps1`, `scripts/info-hash.py`, `scripts/copy-lint.mjs`, `scripts/secret-scan.mjs`.
- Brief C: `../info/demo-briefs/C_ai_phone_assistant.md`. Only price source: `../info/data/price_model_reference.py`.

## Assumptions Made
- Facts and assumptions come from `info/` (A01-A25, S01-S61); unknowns are spoken as «это уточнит наш инженер» and logged. Demo flows use the fictional ДЕМО address Parauga iela 7.
- Timing: finish and rehearse before building managers send 2027 repair plans (mid-October to early November).

## Files Modified
- **This session:** everything under `Dima voice/` committed in 60df8a5, 69b6977, 1d4f296, 33c814c; this handoff; one status line in `../CLAUDE.md`.
- Nothing in `info/` was touched (hash-checked by `scripts/info-hash.py`).
