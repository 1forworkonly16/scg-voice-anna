# Usage log

Warn the orchestrator at **80 voice min** or **$4 text tests**. No Pay As You Go top-ups.

## Budgets
- ElevenLabs voice **<= 100 min** in total: spike 15, V1 10, H3 25, M2 synth 5, H4 20, contingency 25.
- Automated text tests **<= $5**: spike 0.5, M1 2.5, M2 1.5, reserve 0.5.

## Log
| date | WP | voice min | text $ | cumulative min | cumulative $ | note |
|---|---|---|---|---|---|---|
| 2026-10-03 | WP0 | 0 | 0 | 0 | 0 | setup, no external services |
| 2026-10-03 | WP3 | 0 | 0 | 0 | 0 | copy only |
| 2026-10-03 | WP1 | 0 | 0 | 0 | 0 | dataset; VZD+OSM free downloads |
| 2026-10-03 | WP2 | 0 | 0 | 0 | 0 | core lib, no external services |
| 2026-10-03 | WP6 | 0 | 0 | 0 | 0 | Worker, mocked tests + dry-run only; no deploy, no external calls |
| 2026-10-03 | WP4 | 10.8833 | 0.2932 | 10.8833 | 0.2932 | 13 convs on scg-spike-* agents, since deleted (API shows 0 now); text $ = LLM $ only (voice minutes are plan allowance); detail spike/REPORT.md |
| 2026-10-03 | WP8 | 0 | 2.17 | 10.8833 | 2.46 | EL Tests (not in the conversations API, so $ = sum of per-run charging.llm_price over ~330 test runs on Haiku/Sonnet incl. unsaved probe runs, rough +-0.1; plus 1 text-only websocket conv $0.014, 4 s, no voice). Crossed the $1.8 stop line before I had a running total; stopped. Meter marker api=min:0.0667,usd:0.0142; detail docs/agent_report.md |
| 2026-10-03 | WP8 rework | 0 | 0.08 | 10.8833 | 2.54 | 9 test runs, ALL failed with quota_exceeded (workspace shows 0 credits remaining of 130244; 16 credits needed), so no valid regression result. $ = reported charging.llm_price of those aborted runs. Stopped at once. Cap now 3.50; ~0.96 left for V1 but V1 is blocked until credits are restored |
| 2026-10-03 | WP8 regression | 0 | 0.06 | 10.8833 | 2.60 | 14 EL Test runs x1 on Haiku (4 reworked + 10 critical incl. t22 relay), none skipped; **573 credits** (24,398 -> 23,825; t04 alone 79, reworked ~75/run, critical ~27/run). $ = reported charging.llm_price 0.0632. Tool-execution logs of all 7 tools stayed 0. Detail elevenlabs/test_results/regression_2026-10-03.json. M1 text cap 3.50: ~0.90 left |

Note (2026-10-03): ElevenLabs credits are now measured via the subscription API (`GET /v1/user/subscription`, remaining = character_limit - character_count; the key has user_read). The balance lags the test run by ~1 min; it matched the per-run `credits_used` sum exactly.
