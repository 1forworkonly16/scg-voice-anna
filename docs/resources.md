# Provisioned resources (WP5). IDs only, no secrets.

Status 2026-10-03: WP5 DONE (GCP, SA key, Calendar, Sheet, Telegram). Telegram caveat: the group is a basic group (id -5579985990); if it is later converted to a supergroup the id changes and 04 must be re-run.
IDs are also kept in `scripts/provision/state.json` (read by the other scripts).

| Resource | Value |
|---|---|
| GCP project | `scg-voice-demo-694465` (no parent org; APIs enabled: serviceusage, iam, calendar, sheets, drive) |
| Service account | `scg-voice-worker@scg-voice-demo-694465.iam.gserviceaccount.com` |
| SA key | exactly 1 user-managed key; JSON lives only in Windows USER env var `GOOGLE_SA_KEY_JSON` (no file) |
| Calendar «SCG — Бесплатный осмотр» | `8b868c3728630911dcf1e56659548c03498d351b5315ce1b07c4264dc0f294e5@group.calendar.google.com`; created and owned by the SA; timeZone Europe/Riga; shared as writer with the owner's Google account (notification e-mail sent once) |
| Sheet «SCG Leads» | `1-BkNS8pby3NQf3CKKw-9O79u8MXtamYpNuN3xHXreGI` , https://docs.google.com/spreadsheets/d/1-BkNS8pby3NQf3CKKw-9O79u8MXtamYpNuN3xHXreGI/edit ; created by the owner, SA = Editor; tabs Leads(25 cols), Calls(11), Works(12), Access(8), Callbacks(11), Tickets(14), Requests(8) (the last two added 2026-10-03 for M2 via `03_calendar_sheet.py --sheet-only --new-tabs-only`); headers = `src/google/sheet_schema.ts`, row 1 frozen, read-back MATCH |
| Telegram group (title in Telegram: «заявки(демо)») | `-5579985990` (basic group, not -100…; getChat ok; test message_id 5) |
| Telegram test chat (private) | `1010766038` (getChat ok; test message_id 6) |
| Telegram invite link | https://t.me/+J8zbZSu3PqhhYTQ6 |
| Bot | @dimasmartcombot |

## Sheet headers
Parsed by `03_calendar_sheet.py` straight from `src/google/sheet_schema.ts` (`*_HEADERS`, `SHEET_TABS`); nothing is hand-copied. Re-running rewrites row 1 of each tab; on the LIVE Sheet use `--sheet-only --new-tabs-only` (additive: existing tabs are only read back and compared).

## Re-running (all idempotent). From `Dima voice/`, with `PYTHONUTF8=1`
1. `python scripts/provision/01_gcp.py` : project, parent check, APIs, SA.
2. `python scripts/provision/02_sa_key.py` : one key into user env `GOOGLE_SA_KEY_JSON` (rotates only if missing/stale).
3. `python scripts/provision/03_calendar_sheet.py [--calendar-only] [--sheet-url URL]` : service-account only (no gws, no user OAuth; token minted by `sa_token.mjs` from the user env var). Calendar part is idempotent (reuses the id, no second ACL e-mail). Sheet part adds missing tabs, writes headers from `sheet_schema.ts` (RAW), reads them back, drops an empty default Sheet1/Лист1.
4. `powershell -NoProfile -ExecutionPolicy Bypass -Command ". .\scripts\env.ps1; python scripts\provision\04_telegram.py"` : getUpdates + getChat; sends one test message per chat the first time (ids recorded in state.json). Needs a fresh message in the group and `/start` in the private chat (Telegram keeps updates 24 h; getUpdates is currently empty).
