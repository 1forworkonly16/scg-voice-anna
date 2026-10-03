# Decisions

Fixed 2026-10-03; change only with the user.

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

- 2026-10-03, user: keys may also live in the git-ignored `.env` (read by `scripts/env.ps1` when the user env var is empty; user vars win).
