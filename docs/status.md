# Status

Updated by the verifier on ACCEPT. Plan: `docs/plan.md`.

| WP | owner model | status | commit | notes |
|---|---|---|---|---|
| H0 | user | done (2026-10-03) | - | VS Code opened in `Dima voice/`, edit-automatically mode |
| WP0 Setup | Sonnet | accepted 2026-10-03 | initial commit | scaffold archived, git init, 2 rework rounds (setup_keys.md) |
| H1 Keys | user | done 2026-10-03 | - | 4 keys present (.env); Telegram group invite https://t.me/+J8zbZSu3PqhhYTQ6 |
| WP1 Dataset | Sonnet | accepted 2026-10-03 | see git log | 30 records (6 SCG, 23 typical, 1 ДЕМО); per-field provenance VZD 2026-09-26 + OSM 2026-10-02 + INFO; prices only Ilūkstes 16 + ДЕМО |
| WP2 Core lib | Sonnet | accepted 2026-10-03 | see git log | 269 tests; parity 449 cases incl. 5742/6542 + all 6 tie sites; 2 rework rounds; holidays need online check before pilot |
| WP3 Prompt + copy | Opus | accepted 2026-10-03 | see git log | 27 test specs (9 critical, 2 sims); LV advisory list for H3 |
| WP4 Spike | Sonnet | accepted 2026-10-03 | see git log | Gate S GO-with-conditions; 10.88 min, $0.29; LV ok on eleven_v4_turbo |
| WP5 Provision | Sonnet | accepted 2026-10-03 | ab35c60 | Google Calendar/Sheet + Telegram provisioned (SA-only) |
| WP6 Worker | Sonnet | accepted 2026-10-03 | see git log | 269 + 62 worker tests (mocked fetch); dry-run OK (972 KiB); holidays verified online (2027-05-03/12-27 removed); advisory: holiday note wording (law DOES shift 4 May / 18 Nov / song-festival day off a weekend), true insert-409 same-slot branch only covered by verifier probe |
| Gate S + H2 | user | done 2026-10-03 | - | GO-with-conditions; TTS eleven_v4_turbo; LLM Sonnet vs Haiku decided in WP8; voice Marina |
| WP7 Deploy + live backend | Sonnet | accepted 2026-10-03 | d833cdc | p90 0.66 s; cold-start CPU exception plus a warm-up preflight |
| WP8 Agent as code | Sonnet | accepted 2026-10-03 (critical 10/10; t04/t13/t18 fixed; t21 RU→LV known issue → H3) | see git log | Round 2 (Haiku, 1,274 credits): tool descriptions + 5 prompt lines (mirrored to prompt_m2), lookup mocks apartments null; t21 0/4 left for the live test. Detail elevenlabs/test_results/regression2_2026-10-03.json. el:check 67/67, 7 M1 tools, only the ru preset live, agent locked |
| WP9 Demo kit | Opus | accepted 2026-10-03 | see git log | run sheet 2 pages, QR verified |
| V1 M1 verification | Opus | done 2026-10-03 (all non-voice gates PASS; voice/ear items → H3); scg-judge M1 verdict **ACCEPT 2026-10-05** (after the REWORK round in the next row) | see git log | report docs/test_report_M1.md, checklist docs/live_checklist_M1.md; integration p90 608 ms; t26/t27 not run (est. 1,510 credits > 300 cap); 0 credits used (22,551 left); Works tab was empty → reset-works run, make it unconditional in preflight; t21 known issue |
| M1 rework (scg-judge REWORK, 7 fixes) | Opus | accepted 2026-10-05 (gates PASS, el:check 67/67, link LOCKED, 22,394 credits; 1 rework round: checklist talk 4 → apt 13, talk 10 reset-works, get_slots warm-up; talks 3→4→10 re-derived from code, no same_as_current/Friday) | see git log | fix 6 prompt rule (no own claim after a fixed line) pushed via el:build, t23/t24 pass (157 credits); scenario 3 scripts aligned to code (apt 12 = Wednesday, options Mon/Tue/Thu); checklist: lv_review step, LV scenario 9, 2 ear checks, measured-credits rule (stop < 8,000), backup video required; run sheet: el:credits, unconditional reset-works + health + get_slots warm-up, group «заявки(демо)», LV→RU only; scripts/cleanup-live.ts (dry run default, non-test rows/events only) + unit test; el:credits |
| H3 Live tests (RU-only; LV deferred) | user | in progress (RU-only) | - | Call 1 done 2026-10-05 (`conv_3001m45t5tpger38ksrky7yh6rvt`, 4:04, 1,076 credits): booking OK, Telegram OK. The feedback (sounds like AI, slow, long greeting, phone misheard, 141 vs 144) led to a rework of the greeting, voice, turn-taking, prompt style and numbers (`docs/decisions.md` 2026-10-05). LV deferred until Dima agrees. **M1 config changed after the judge's ACCEPT; H3 re-validates it** (re-test of call 1, then the RU talks in `docs/live_checklist_M1.md`). **Re-test of call 1 done 2026-10-06** (`conv_2801m471k2pse81ahr5nbhgwz1yj`, 3.02 min, 883 credits): median wait to her voice 1.70 s (target ≤ 1.8), 2 interrupted turns (target ≤ 1), talk share 53% (target ≤ 45%), 293 credits/min. Grammar, re-greeting and voice issues → **rework round 2 in progress**: Kodukliima voice on `eleven_v3_conversational`, tone, one greeting + silence rule (`skip_turn`, `turn_timeout` 5), fixed fillers, +371 check, a price on any price question, Worker numbers in words (`docs/decisions.md` 2026-10-06). H3 is now the re-test plus talks 3, 5 and 10, target ≤ 600 credits/min |
| WP10 Handoff | Sonnet | todo | - | after H3 + rework |
| WP11 M2 copy | Opus | accepted 2026-10-03 (staged in elevenlabs/prompt_m2; wiring in WP13) | see git log | copy-lint 0 (default targets); specs t28-t39, 5 critical; EL tests pending credits |
| WP12 M2 backend | Sonnet | accepted 2026-10-03 (not deployed; Tickets/Requests tabs live; deploy in WP13) | see git log | unit 326 + worker 94; allowlist keeps M1 7 tools; el:check 67/67; WP13: «пятно после протечки» still escalates |
| WP13 M2 agent update | Sonnet | todo | - | |
| V2 M2 verification | Opus | todo | - | |
| H4 Live tests 2, 4-7 | user | todo | - | end of M2 |
