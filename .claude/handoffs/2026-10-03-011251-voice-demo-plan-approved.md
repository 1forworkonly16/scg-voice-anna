# Handoff: Demo C voice assistant «Anna» for SCG, plan approved, build not started

> **READ FIRST. In the session that resumes from this file you are the ORCHESTRATOR AND JUDGE ONLY. By the user's explicit instruction, ALL work (code, copy, data, prompts, verification, handoffs) is done by subagents. You do none of it yourself.**

## Session Metadata
- Created: 2026-10-03 01:12:51 · Project: C:\Users\Banknote\Desktop\Dima smartcomfort\Dima voice (not a git repo yet; WP0 runs `git init`)
- Session: planning only (Q&A, research, plan approval). No code, copy or accounts; `info/` untouched.
- **Continues from:** [2026-10-02-130452-scg-ready-to-build-demos.md](../../../.claude/handoffs/2026-10-02-130452-scg-ready-to-build-demos.md), linked by hand (the scaffold script cannot link across folders). It still governs demos A, B and the deck; this one governs only Demo C. Paths below are relative to `Dima voice/`, so `../info/` is the workspace `info/`.

## Current State Summary
The plan for **Demo C, the ElevenLabs voice assistant «Anna» for Smart Comfort Group**, was **approved on 2026-10-03**. It is demoed only through the ElevenLabs public talk-to link. **Nothing is built under this plan yet.** The plan is the single source for scope, work packages (WP0-WP13), gates, contracts and budgets: `C:\Users\Banknote\.claude\plans\read-the-latest-session-refactored-bachman.md`.

`Dima voice/` is **not empty**. It holds an unrelated partial scaffold (package.json, src/, data/, tests/, wrangler.jsonc, node_modules/ and more) made on 2026-10-02 13:41-13:52 by another, now-closed session. It conflicts with the plan: do not build on it and do not touch it yourself. **WP0 moves it** to `_archive/2026-10-02/` (git-ignored), deletes its node_modules, and deletes the stray `info/data/__pycache__/` that session left behind.

## Immediate Next Steps
1. Read this handoff, the plan, and `../info/demo-briefs/C_ai_phone_assistant.md` §3-4 (conversation, tools) and §10-12 (scenarios, demo script, acceptance). The plan gives each subagent its own short reading list, so read nothing else yourself. The plan is outside this folder, so reading it may prompt once: approve.
2. **Gate H0 (user only):** the VS Code extension has no `/add-dir`; access to `info/` comes from `.claude/settings.local.json` (`additionalDirectories`, created 2026-10-03). Tell the user to pick mode «Auto» (safety net: `.claude/settings.json`).
3. Launch **WP0 in the foreground** as a Sonnet subagent, using the WP0 row of the plan as its brief. After WP0 the plan copy lives at **Dima voice/docs/plan.md**; use that copy from then on.
4. Launch **WP1, WP2 and WP3 in the background** (disjoint paths, no keys needed) while the user does **H1**, the keys sitting (click steps in **docs/setup_keys.md**). Then follow the plan's order: WP4 + WP5 (WP6 once WP2 is done), Gate S + H2, WP7, WP8, WP9, V1, your judgement, H3, rework, WP10, **STOP with the M1 report**; M2 comes after.

## Important Context
- **Your role: orchestrator and judge only.** You remember nothing of the planning session: this handoff and the plan are everything. Per work package: write the brief (task, owned paths, narrow reading list with line ranges, outputs, acceptance, forbidden actions, budget), launch it, read the builder's report (max 300 words) and a fresh verifier's report, check `git diff --stat`, spot-check key artefacts, then ACCEPT or REWORK (SendMessage to the same builder with numbered fixes; after 2 failed reworks, escalate to the user). Plan: «Orchestration model», «Work packages».
- **Models:** Sonnet 5.5 for code, data and infrastructure; Opus 5.5 for the agent prompt, RU/LV copy, demo kit and every verification (a fresh verifier per gate, which never fixes). Set the Agent tool's `model` parameter explicitly.
- **Budgets:** ElevenLabs voice max 100 min in total, automated text tests max $5; subagents warn you at 80 min / $4; never exceed without asking the user; no Pay As You Go top-up.
- **Check-ins:** stop and report at Gate S + H2 (after WP4), at the end of M1 and of M2, and at the human-only gates H0, H1, H3, H4. **Judge:** the session runs at high effort; at Gate S (WP4 report) and the M1/M2 verdicts (V1/V2 report) dispatch the `scg-judge` subagent (Opus, max effort, read-only) with the evidence paths, review its verdict, then report. The user never switches effort.
- **Scope:** the user tests RU and LV live. Everything is built inside `Dima voice/`; `info/` is read-only and hash-checked at every gate. Persona **Anna** (female); talk-to link only, no web page, no SMS or e-mail. M1 = scenarios 1, 3, 8, 9, 10; M2 = 2, 4-7.
- The workspace rules in `../CLAUDE.md` bind every subagent (RU by default, facts only from `info/`, prices from code, AI disclosure in the first sentence, banned phrases). Put the plan's «Facts builders must respect» into each brief.

## Blockers
- **No keys yet.** Gate H1 (user, one sitting, after WP0): ElevenLabs API key first (the spike can then start), Cloudflare API token + account id, Telegram bot token + group + test chat, and `gws auth login` only if WP5's probe finds the token expired. Values go into Windows user env vars from the clipboard; names only in **docs/setup_keys.md**.
- **Latvian TTS in ElevenLabs agents is unproven** (its docs contradict each other). The spike WP4 decides. If LV fails, stop, show the evidence and let the user decide the fallback.

## Potential Gotchas
- User env vars set at H1 are **invisible to already-running shells**. Load them from User scope per command with `[Environment]::GetEnvironmentVariable(name,'User')` (the plan's **scripts/env.ps1**).
- **PowerShell 5.1 mangles JSON arguments and Cyrillic:** provision and call APIs from Python or Node; use `npx.cmd`.
- **Never type a secret** (PSReadLine history keeps it) and never run a plain `wrangler login` (plaintext token file). Secrets go to `wrangler secret put` over stdin.
- **Background subagents auto-deny any permission that is not pre-approved,** hence WP0 (foreground, user approving) persists a narrow allowlist before anything runs in the background.
- Python `round()` rounds exact halves to even (91880/16 gives 5742), so the TypeScript price port needs `roundHalfEven`.

## Decisions Made
All fixed in the plan's «Decisions» table (Q&A 2026-10-02/03); do not reopen them without the user. In short: M1 then M2; secrets as user env vars; Claude native in ElevenLabs (start with `claude-opus-5-5`, step down to sonnet, then haiku, if p50 > 1.5 s); free stack (Cloudflare Workers, Google Calendar and Sheet through a service account, Telegram); local `git init`, one commit per accepted WP; 30-building fallback dataset.

## Architecture Overview
One Cloudflare Worker (tool routes `POST /tools/<name>`, ElevenLabs post-call webhook, crons) serves the ElevenLabs agent, which is managed as code and locked by default. It writes Google Calendar and Sheet and sends Telegram alerts. Details: plan «Architecture and contracts».

## Critical Files
- Plan: `C:\Users\Banknote\.claude\plans\read-the-latest-session-refactored-bachman.md`. Brief C: `../info/demo-briefs/C_ai_phone_assistant.md`. RU copy and banned phrases (L91-93): `../info/copy/ru_key_messages.md`. Only price source: `../info/data/price_model_reference.py`. Rules: `../CLAUDE.md`.
- Created by WP0, not there yet: a folder CLAUDE.md, docs/status.md, docs/usage_log.md, scripts/info-hash.py.

## Assumptions Made
- Facts and assumptions come from `info/` (A01-A25, S01-S61); unknowns are spoken as «это уточнит наш инженер» and logged, never invented. Demo flows use a fictional address labelled ДЕМО; 144 apartments at Ilūkstes iela 16 is an assumption.
- Timing: finish and rehearse before building managers send their 2027 repair plans (mid-October to early November).

## Files Modified
- **This session (2026-10-03):** only the plan file, this handoff, and one pointer line in `../CLAUDE.md` ("Where things are").
- Nothing in `info/` and nothing of the old scaffold was touched.
