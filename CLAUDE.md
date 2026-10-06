# Dima voice/ : Demo C, ElevenLabs voice assistant «Anna» for Smart Comfort Group (SCG), Riga

The workspace-root `CLAUDE.md` does not load automatically here, so the rules below are binding. Source of truth for the build: `docs/plan.md`.

## What this folder is
- Demo C: AI phone assistant, persona **Anna / Анна** (female voice), built on ElevenLabs Agents (Claude native) plus a Cloudflare Worker, Google Calendar + Sheets and a Telegram bot.
- Demoed only through the ElevenLabs **talk-to link** (no +371 number yet, no web page).
- **M1** (meeting-ready) = scenarios 1, 3, 8, 9, 10 + live Calendar/Sheet/Telegram + daily digest. **M2** = scenarios 2, 4, 5, 6, 7.
- **Current goal (2026-10-06):** a private video for SCG (no meeting with Dima): the user calls Anna twice as a real caller (interrupting, off-script). **A:** house elder, Ilūkstes iela 16: risers, price, free inspection. **B:** resident of ДЕМО Parauga iela 7, flat 12, moves the Wednesday access time. `docs/status.md`, Video track.
- Brief: `../info/demo-briefs/C_ai_phone_assistant.md`.

## Rules (condensed from the workspace root)
1. **Language:** anything Dima or callers see/hear is **Russian by default**; Latvian complete wherever the public hears it; English optional. Terms: `../info/data/glossary_lv_ru_en.json`; copy: `../info/copy/ru_key_messages.md`.
2. **Facts only from `../info/`** (cite `[Sxx]` sources, `[Axx]` assumptions). Unknowns are never invented: Anna says «это уточнит наш инженер/менеджер» and the question is logged (`unknown_questions` + Telegram). Never invent testimonials, warranty, instalments, client names, works at real buildings.
3. **Prices only from code:** `../info/data/price_model_reference.py` (run `--selftest`), ported and parity-tested. Never let an LLM compute a price. Every price: «ориентировочно», net AND incl. VAT 21%, ends with «точную цену даст инженер после бесплатного осмотра». Never speak instalments or working-day estimates.
4. **Banned phrases** (ru_key_messages L91-93 and LV equivalents): «за полцены», «вдвойне сэкономить», «гарантированно дешевле управляющего», «управляющий завышает цены», RNP named as client/partner, any price without «ориентировочно». Don't attack house managers.
5. **AI disclosure in the first message** of every call, before any question; if the caller talks over the greeting before the disclosure, Anna's first reply starts with «Это Анна, ИИ-ассистент.» (LV «Esmu Anna, mākslīgā intelekta asistente.»). **Audio recording is off** (`record_voice=false`, transcripts kept 90 days, so no recording notice; decision 2026-10-05). GDPR: **no consent question** since 2026-10-06: the basis for storing name and phone is the caller's own request (Art. 6(1)(b)), Anna says what the phone is for («И ваш телефон — для связи по этой заявке?»), and SCG's lawyer/DPO confirms before go-live. Data minimisation: no names/phones in data-collection fields; Calls tab = summary + criteria, no transcript.
6. **No paid GHL features** (AI Employee, Voice/Conversation AI, LC Phone). **No Pay As You Go top-ups.**
7. **Budgets** (see `docs/usage_log.md`): ElevenLabs voice <= 100 min total, automated text tests <= $5. Warn the orchestrator at 80 min / $4. Ask the user before any batch over ~3,000 ElevenLabs credits (2026-10-06). Log usage per WP.
8. AI-generated technical/legal documents are labelled drafts; a human signs.

## INFO is read-only
`../info/` must never be edited. Check with `PYTHONUTF8=1 python scripts/info-hash.py --check` (exit 0 = unchanged; manifest `docs/info_manifest.sha256`). Run it at every gate.

## Secrets and shell
- Secrets live in Windows **user env vars** or in the user's git-ignored `DV/.env` (user vars win). Never open, print, copy or edit `.env`; `env.ps1` is its only reader. Load by dot-sourcing `. .\scripts\env.ps1` after `Set-ExecutionPolicy -Scope Process Bypass -Force` (or run `powershell -NoProfile -ExecutionPolicy Bypass -Command ". .\scripts\env.ps1; <cmd>"`). `-Check` prints names + present/missing, never values. Guide: `docs/setup_keys.md`.
- Never write a secret value to any file, log or report. Never type a secret in a terminal. Never plain `wrangler login`; never `setx`.
- PowerShell 5.1 mangles JSON arguments and Cyrillic: do provisioning/JSON in Python or Node. Use `npx.cmd`. No `&&`, `??`, `?.` in PowerShell.
- Set `PYTHONUTF8=1` for Python. Never commit; the verifier commits after acceptance (`git add -- <owned paths>`).

## Cloud session (Linux)
- Secrets are the cloud environment's env vars: `ELEVENLABS_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SCG_TOOL_KEY`, `SCG_ADMIN_KEY`, `GOOGLE_SA_KEY_JSON`; optional `TELEGRAM_BOT_TOKEN`, `ELEVENLABS_WEBHOOK_SECRET`. Never print or write their values.
- `npm run el:*` / `link:*` go through `scripts/el/run.mjs` (`run.ps1` on Windows, plain node elsewhere). `npm run test:cloud` runs the tests without `../info/`.
- `../info/` is absent here, so `info-hash.py --check` and `sync-data --check` run on the Windows PC only. Facts come only from what is already ported (prompt §6, `src/data`, `docs/prompt_sources.md`); anything new waits for `../info/`.
- Push only to the session's `claude/` branch (`claude/stoic-rubin-fpy6pz`): never `main`, never force.

## Token-lean working style
- Read only the files your brief names, with line ranges. No broad repo sweeps.
- Link to `../info/` instead of copying from it.
- Reports to the orchestrator: <= 300 words, paths + results + doubts only.
- Stay inside your owned paths; never touch `.claude/agents/` or `.claude/handoffs/` unless the brief says so.

## Pointers
- `docs/plan.md` source of truth; `docs/decisions.md` fixed decisions; `docs/platform_facts.md` verified platform facts
- `docs/status.md` WP status; `docs/usage_log.md` budgets and usage; `docs/setup_keys.md` user key setup (H1)
- Handoffs: `.claude/handoffs/` (read the latest first when resuming)
- Old scaffold (reference only, git-ignored): `_archive/2026-10-02/`
