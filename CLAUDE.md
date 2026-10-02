# Dima voice/ : Demo C, ElevenLabs voice assistant «Anna» for Smart Comfort Group (SCG), Riga

The workspace-root `CLAUDE.md` does not load automatically here, so the rules below are binding. Source of truth for the build: `docs/plan.md`.

## What this folder is
- Demo C: AI phone assistant, persona **Anna / Анна** (female voice), built on ElevenLabs Agents (Claude native) plus a Cloudflare Worker, Google Calendar + Sheets and a Telegram bot.
- Demoed only through the ElevenLabs **talk-to link** (no +371 number yet, no web page).
- **M1** (meeting-ready) = scenarios 1, 3, 8, 9, 10 + live Calendar/Sheet/Telegram + daily digest. **M2** = scenarios 2, 4, 5, 6, 7.
- Brief: `../info/demo-briefs/C_ai_phone_assistant.md`.

## Rules (condensed from the workspace root)
1. **Language:** anything Dima or callers see/hear is **Russian by default**; Latvian complete wherever the public hears it; English optional. Terms: `../info/data/glossary_lv_ru_en.json`; copy: `../info/copy/ru_key_messages.md`.
2. **Facts only from `../info/`** (cite `[Sxx]` sources, `[Axx]` assumptions). Unknowns are never invented: Anna says «это уточнит наш инженер/менеджер» and the question is logged (`unknown_questions` + Telegram). Never invent testimonials, warranty, instalments, client names, works at real buildings.
3. **Prices only from code:** `../info/data/price_model_reference.py` (run `--selftest`), ported and parity-tested. Never let an LLM compute a price. Every price: «ориентировочно», net AND incl. VAT 21%, ends with «точную цену даст инженер после бесплатного осмотра». Never speak instalments or working-day estimates.
4. **Banned phrases** (ru_key_messages L91-93 and LV equivalents): «за полцены», «вдвойне сэкономить», «гарантированно дешевле управляющего», «управляющий завышает цены», RNP named as client/partner, any price without «ориентировочно». Don't attack house managers.
5. **AI disclosure + recording notice in sentence 1** of every call. GDPR: consent before storing contact data; data minimisation (no names/phones in data-collection fields; Calls tab = summary + criteria, no transcript).
6. **No paid GHL features** (AI Employee, Voice/Conversation AI, LC Phone). **No Pay As You Go top-ups.**
7. **Budgets** (see `docs/usage_log.md`): ElevenLabs voice <= 100 min total, automated text tests <= $5. Warn the orchestrator at 80 min / $4. Log usage per WP.
8. AI-generated technical/legal documents are labelled drafts; a human signs.

## INFO is read-only
`../info/` must never be edited. Check with `PYTHONUTF8=1 python scripts/info-hash.py --check` (exit 0 = unchanged; manifest `docs/info_manifest.sha256`). Run it at every gate.

## Secrets and shell
- Secrets live only in Windows **user env vars**. Load by dot-sourcing `. .\scripts\env.ps1` after `Set-ExecutionPolicy -Scope Process Bypass -Force` (or run `powershell -NoProfile -ExecutionPolicy Bypass -Command ". .\scripts\env.ps1; <cmd>"`). `-Check` prints names + present/missing, never values. Guide: `docs/setup_keys.md`.
- Never write a secret value to any file, log or report. Never type a secret in a terminal. Never plain `wrangler login`; never `setx`.
- PowerShell 5.1 mangles JSON arguments and Cyrillic: do provisioning/JSON in Python or Node. Use `npx.cmd`. No `&&`, `??`, `?.` in PowerShell.
- Set `PYTHONUTF8=1` for Python. Never commit; the verifier commits after acceptance (`git add -- <owned paths>`).

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
