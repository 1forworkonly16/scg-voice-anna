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
| WP8 Agent as code | Sonnet | conditionally accepted 2026-10-03 | see git log | EL regression (critical ×2 + t04/t13/t18/t21 ×2, Haiku) pending: workspace out of credits. el:check 67/67; Haiku critical 50/50 (round 1); text spend 2.54 > M1 cap 2.5 |
| WP9 Demo kit | Opus | accepted 2026-10-03 | see git log | run sheet 2 pages, QR verified |
| V1 M1 verification | Opus | todo | - | needs WP9 |
| H3 Live RU + LV tests | user | todo | - | end of M1 |
| WP10 Handoff | Sonnet | todo | - | after H3 + rework |
| WP11 M2 copy | Opus | accepted 2026-10-03 (staged in elevenlabs/prompt_m2; wiring in WP13) | see git log | copy-lint 0 (default targets); specs t28-t39, 5 critical; EL tests pending credits |
| WP12 M2 backend | Sonnet | accepted 2026-10-03 (not deployed; Tickets/Requests tabs live; deploy in WP13) | see git log | unit 326 + worker 94; allowlist keeps M1 7 tools; el:check 67/67; WP13: «пятно после протечки» still escalates |
| WP13 M2 agent update | Sonnet | todo | - | |
| V2 M2 verification | Opus | todo | - | |
| H4 Live tests 2, 4-7 | user | todo | - | end of M2 |
