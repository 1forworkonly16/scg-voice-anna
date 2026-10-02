# Platform facts

Copied verbatim from the plan (research of 2026-10-02/03). Re-verify anything doubtful in the spike (WP4) before relying on it.

## Verified platform facts (research of 2026-10-02/03; WP0 copies them into `Dima voice/docs/platform_facts.md` with URLs)
**ElevenLabs Agents**
- **Latvian TTS in agents:** only `eleven_v3_conversational` and `eleven_v4_turbo` (v4 Turbo arrived in agents on 2026-09-28); Flash v2.5 and Multilingual v2 have no Latvian. One docs page claims extra languages fall back to Multilingual v2.5, so **the spike decides**. ASR is `scribe_realtime` (LV and RU).
- **Languages:** `conversation_config.agent.language` (default `lv`), `language_presets.<code>.overrides` (first_message, prompt, tts.voice_id), and the `language_detection` system tool (any turn) for mid-call switching. The greeting plays before the language is known, hence the bilingual greeting.
- **Claude available natively:** `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5`. LLM usage is billed on top of minutes (≈ $0.003–0.04/min by third-party estimates; Opus costs more). The spike measures the real figure.
- **Talk-to link:** `https://elevenlabs.io/app/talk-to?agent_id=<id>`; it needs auth off. Agent settings: `conversation.max_duration_seconds` = 300, `daily_limit`, `agent_concurrency_limit`. For demo A later: `<elevenlabs-convai agent-id>` + `unpkg.com/@elevenlabs/convai-widget-embed`, with a `terms_text` consent modal.
- **Webhook tools:**
  - Created with `POST /v1/convai/tools`, `api_schema` {url, method, request_body_schema, request_headers}. The header value is `{secret_id}` (a workspace secret).
  - Body properties can bind a `dynamic_variable`, e.g. `system__conversation_id`.
  - Timing: `response_timeout_secs` (default 20). `pre_tool_speech` is an enum (`auto|force|off`), so the filler wording lives in the prompt.
  - ElevenLabs doesn't sign tool calls, so the secret header (`crypto.subtle.timingSafeEqual`) is the only protection.
  - System tools: `end_call`, `language_detection`, `skip_turn`. `transfer_to_number` is phone-only.
- **Time:** `system__time_utc` exists; `system__timezone` is user-provided (the spike tests it). `get_slots` returns slot labels and "today" in Riga time anyway.
- **Post-call webhook:**
  - **Workspace-wide**, so filter by agent id or use the per-agent override (`platform_settings.workspace_overrides.webhooks.post_call_webhook_id`). Ask before replacing an existing workspace webhook.
  - `post_call_transcription` carries the transcript, `metadata` (duration, cost) and `analysis` (data_collection_results, evaluation_criteria_results, transcript_summary).
  - Signature: `ElevenLabs-Signature: t=<unix>,v0=<hex>`, where v0 = HMAC-SHA256(secret, `${t}.${rawBody}`). Several v0 values may appear; reject anything older than 30 min. Always return 200, because the webhook is auto-disabled after 10+ failures.
  - Up to 25 data fields and 30 evaluation criteria per agent.
- **Testing:** simulate-conversation is deprecated. Use **Tests** (Simulation / Next-reply / Tool-call, with tool mocking and repeats) via `POST /v1/convai/agent-testing/create`, `…/agents/{id}/run-tests` or `elevenlabs agents test`. Tests are charged at unpublished rates. Text-only conversations cost $0.003/message + LLM, no minutes.
- **Agent as code:** `@elevenlabs/cli` 1.4.0 (`elevenlabs agents init|add|pull|push --dry-run|status|test`, `tools add`), reading `ELEVENLABS_API_KEY`. **All agents are now versioned** (PATCH's `enable_versioning_if_not_enabled` is ignored). The spike checks whether a push goes live on the talk-to link without a separate publish step.
- **Privacy:** EU residency and zero retention are Enterprise-only, so Creator processes in the US. `privacy.retention_days` = 90 → `pilot_backlog.md` (SCG DPA, EU option).
- **Creator plan:** 275 min, overage $0.08/min only from prepaid Pay As You Go credit (the service pauses at a $0 balance), 10 concurrent calls, silence > 10 s billed at 5%. Keep ≥ 60 min in reserve for rehearsal and the meeting.

**Cloudflare / Google / Telegram**
- **Workers Free:** 10 ms CPU per invocation (requests and cron), 100k requests/day, 50 subrequests per invocation, 5 cron triggers (UTC), secrets up to 5 KB. workers.dev is fine for the demo.
- **Wrangler v4** (4.146.0) as a dev dependency. Auth: `CLOUDFLARE_API_TOKEN` ("Edit Cloudflare Workers" template) + `CLOUDFLARE_ACCOUNT_ID` as user env vars. Never use a plain `wrangler login` (plaintext token file). Secrets: `$v | npx wrangler secret put NAME` after `$OutputEncoding=[Text.UTF8Encoding]::new($false)`; trim CRLF in the Worker. Local dev: `$env:CLOUDFLARE_INCLUDE_PROCESS_ENV='true'`, no `.dev.vars`.
- **Windows:** use `npx.cmd` in the user's own PowerShell window. PSReadLine logs typed lines, so never type a secret. PowerShell 5.1 mangles JSON arguments and Cyrillic, so provision in Python/Node.
- **Google SA from Workers:**
  - Auth: RS256 JWT via WebCrypto or `jose` v6, token exchange, cached ≈ 1 h.
  - Scopes `auth/calendar` + `auth/spreadsheets`.
  - Sharing: calendar ACL `writer`, Sheet as Editor.
  - Limits: no attendees or invites, no Meet links; reminders follow the user's calendar defaults.
  - Sheets writes use `valueInputOption=RAW`.
- **gcloud:** `gcloud iam service-accounts keys create - --iam-account …` prints the key to stdout (verified in the installed SDK). Check that `gcloud projects describe <id> --format="value(parent)"` is empty. Enable `serviceusage` first. Delete any orphan key if piping fails. If enabling the APIs without billing fails, fall back to the existing gws project.
- **Telegram:** `sendMessage` with `parse_mode: "HTML"` (escape `& < >`). The group id comes from `getUpdates` (`my_chat_member`, negative id; -100… for supergroups). About 20 messages/min per group. Call it via `Invoke-RestMethod`, never the browser.

## Sources
Official documentation roots (no deep links; search inside each):
- ElevenLabs: https://elevenlabs.io/docs
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Google Calendar API: https://developers.google.com/calendar/api
- Google Sheets API: https://developers.google.com/sheets/api
- Telegram Bot API: https://core.telegram.org/bots/api
