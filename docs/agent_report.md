# WP8 report: agent as code (scg-anna)

Date 2026-10-03. Agent `agent_4801m41cmf0ge7er75wzv5nj3pn1`, LLM **claude-haiku-4-5**, TTS eleven_v4_turbo, voice Marina (one voice for LV and RU), **auth ON (locked)**.

## What exists
- `elevenlabs/agent_config.json` (declarative settings), `elevenlabs/tools.json` (GENERATED from the zod contract, ids only), `elevenlabs/agents.json` (ids), `elevenlabs/tests.json` (28 tests: 27 specs + 1 derived relay test for t22), `elevenlabs/test_results/*.json` (saved runs).
- Scripts: `scripts/gen-tools.ts` (secret + 7 webhook tools), `scripts/build-agent.ts` (idempotent create/PATCH, `--llm <model>` is the single model switch, webhook + Worker secret), `scripts/check-agent.ts` (67 assertions), `scripts/link.ts`, `scripts/el/tests.ts` (sync/run/rescore), `scripts/el/{api,common,run.ps1}`. npm: `el:tools`, `el:build`, `el:check`, `el:tests`, `link:unlock|lock|status`.
- Workspace secret `scg_tool_key` (value = SCG_TOOL_KEY from env, never printed); tool header `x-scg-key` = `{secret_id}`; `conversation_id` bound to `system__conversation_id`; timeouts 8 s (10 s book_inspection) from the contract.
- Post-call webhook: workspace webhook `scg-anna post-call` (HMAC), attached to this agent only through `workspace_overrides.webhooks` (events transcript, `exclude_transcript: true`). The workspace-wide setting is untouched (null; there were no existing webhooks). Its secret went to the Worker as `ELEVENLABS_WEBHOOK_SECRET` via stdin and to the Windows user env (so `secrets.mjs` re-runs keep it). Worker redeployed with `ELEVENLABS_AGENT_ID` filled.
- End-to-end proof: one text-only conversation (is_test dynamic variable) produced a Calls row (summary + 14 criteria + data fields, no transcript, is_test TRUE); the row was deleted. Calendar, all Sheet tabs: 0 rows at the end.

## Settings applied (Gate S carry-forward)
max 300 s, daily_limit 25, concurrency 2 (bursting off), retention 90 d, record_voice on, expressive_mode off (no audio tags; prompt line #5 too), ASR keywords (31: street names incl. Ilūkstes, Tirzes, Tirzas, Parauga, districts), turn_eagerness normal, turn_timeout 7, silence_end_call 30 s, spelling_patience auto, speculative_turn off, first message uninterruptible (disclosure must be heard), soft-timeout filler LV/RU, max-duration goodbye LV/RU, 16 data fields + 14 criteria.

## Findings the orchestrator must know
1. **A language preset's prompt override is NOT applied at runtime.** Probe (scratch agent, text mode): after `language_detection` the base prompt kept answering. So `presets.json` `prompt_addendum` is deliberately not used (the LV addendum would stay for the whole call); the ru preset carries first_message, language, max-duration message and soft-timeout message only. The base prompt is language-neutral.
2. **text_normalisation_type = `elevenlabs`** (was system_prompt): with system_prompt Haiku wrote «80 000 евро» as words (t06 0/5). Digits now reach TTS; v4_turbo read LV/RU digits correctly in the spike, but numbers inside the agent still need an ear check at V1/H3.
3. EL Tests never execute tools ("Skipping tool call in test mode"); simulations use `mocking_strategy: all`, fallback raise_error. Tool-execution logs of all 7 tools are empty; no calendar/sheet/Telegram effect.
4. Spec drift: t14 expects `new_window` «13-17»; the contract enum is «13:00-17:00» (builder maps it). Specs write «Нашла: Ilūkstes iela 16» without the tool call; the builder injects the call into the history. Judge sometimes hallucinated forbidden Latvian phrases, so `reply_must_not`/`reply_must` are checked deterministically (whitespace-free: the platform inserts stray spaces in streamed text, «Н ДС»).

## Model choice (critical tests, 10 incl. derived t22 relay, x5 repeats = 50 runs each)
| Model | Critical pass | Notes |
|---|---|---|
| claude-haiku-4-5 | **50/50** (after normalisation fix; 41/50 before) | chosen |
| claude-sonnet-5-5 | 33/50 | calls `language_detection(ru)` on every Russian turn, even when already in Russian (t22 0/5 = counted as false switch, t01/t15/t19 produce no text) |

Non-critical on Haiku (x2): 14/18 specs pass; sims t26, t27 pass. Failing (0/2), all prompt-side, not fixable inside my 4-line remit:
- **t04**: Haiku takes `apartments` (144) from `lookup_building` even though it is not in `sourced`, and calls `quote_range` without asking. Real invention risk. Fix options: Worker returns `apartments: null` when not sourced (WP6), or a prompt line "never take the apartment count from the tool; ask and read it back".
- **t13**: for a resident it calls `lookup_building` instead of `find_works_schedule`.
- **t18**: after phone + consent it asks for a name instead of calling `request_callback`.
- **t21**: RU→LV: it answers in Latvian without calling `language_detection` (ASR/voice stay in RU mode).
Also seen in t26: the phone read-back was wrong once («двадцать два» for «двадцать»), the judge passed it; V1 should listen to phone read-backs.
Attempted a what-if (extra prompt lines via `agent_config_override`): no effect and one run raised an exception, so the override route is unreliable; removed.

## Cost
No voice minutes. EL Tests are not in the conversations API; summing per-run `charging.llm_price` gives about **$2.17** (rough, incl. unsaved probe runs and one run aborted by ECONNRESET), plus $0.014 for the text conversation. I crossed the $1.8 stop line before I had a running total and stopped immediately after. Cumulative M1 text spend is therefore about $2.46 of the $2.5 cap; M1 has ~$0.04 left, so any V1 text runs need the orchestrator's decision. Per 10 critical tests: Haiku ~$0.02, Sonnet ~$0.09.

## Open items
- The first Worker test suite run after the link calls showed 1 failing test in the worker suite once; 3 reruns were green (flake, not investigated).
- `elevenlabs agents status` (CLI) not used: the config lives in our own JSON + scripts; `npm run el:check` is the in-sync check (prompt, first message, tools, settings vs live).
- Before the meeting: `npm run link:unlock`, test call, `npm run link:lock`. System-timezone on the real link and LV numbers/dates inside the agent are still V1/H3 checks.

## WP8 rework round 1 (2026-10-03)
Changes (all pushed: Worker redeployed, `el:build` done, `el:check` 67/67 PASS, agent still locked):
- **src (flagged):** `src/lib/buildings.ts` `toBuilding()` now returns floors / stairwells / apartments as `null` unless the field is in `sourced` (t04 fixed at the source; only `lookup_building` uses it, not the booking route, so no integration re-run). Tests: unit `tests/unit/buildings.test.ts`, worker `tests/worker/tools.test.ts` (Parauga iela 7 has unsourced apartments).
- **Prompt (4 short lines in `system_prompt.md`):** use only building facts listed in `sourced`; resident asking when works happen -> `find_works_schedule`, not `lookup_building`; after phone + consent call `request_callback` straight away, never ask for the name; RU->LV switches like LV->RU (tool first). Copy lint passes.
- **Flaky worker test: test-side, fixed.** Reproduced 1 in ~30 under 6x parallel load: `get_slots ... 2 subrequests on a cold token` saw 1. Cause: tests that do not `flush()` (lookup_building prewarm) leave a pending token fetch that finishes after the next `harness()` reset the module-level token cache and re-fills it. Fix in `tests/worker/helpers.ts`: `harness()` first settles the pending promises of earlier worlds, then resets the cache. 48 loaded runs + 12 plain runs green afterwards. Nothing wrong in src/.
- **Regression NOT run: the workspace is out of ElevenLabs credits.** Every EL Test run fails with `quota_exceeded: This request exceeds your quota of 130244. You have 0 credits remaining`. The API key lacks `user_read`, so the plan state cannot be read from here. This probably also blocks voice calls and V1. (The 'what-if' run at the end of round 1 hit the same error: "Test execution exception".) The new prompt lines and the Worker fix are therefore unverified by EL Tests; t04/t13/t18/t21 and the 10 critical tests need a re-run once credits are restored. No Pay As You Go top-up was made.

