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
| WP5 Provision | Sonnet | todo | - | needs H1 |
| WP6 Worker | Sonnet | accepted 2026-10-03 | see git log | 269 + 62 worker tests (mocked fetch); dry-run OK (972 KiB); holidays verified online (2027-05-03/12-27 removed); advisory: holiday note wording (law DOES shift 4 May / 18 Nov / song-festival day off a weekend), true insert-409 same-slot branch only covered by verifier probe |
| Gate S + H2 | user | in progress | - | Gate S done; LLM decided (Sonnet vs Haiku in WP8); voice pick pending |
| WP7 Deploy + live backend | Sonnet | todo | - | needs WP5, WP6 |
| WP8 Agent as code | Sonnet | todo | - | needs WP3, WP7, Gate S |
| WP9 Demo kit | Opus | todo | - | needs WP8 |
| V1 M1 verification | Opus | todo | - | needs WP9 |
| H3 Live RU + LV tests | user | todo | - | end of M1 |
| WP10 Handoff | Sonnet | todo | - | after H3 + rework |
| WP11 M2 copy | Opus | todo | - | |
| WP12 M2 backend | Sonnet | todo | - | |
| WP13 M2 agent update | Sonnet | todo | - | |
| V2 M2 verification | Opus | todo | - | |
| H4 Live tests 2, 4-7 | user | todo | - | end of M2 |
