# Daily digest: how to fire it on demand

Route: `/admin/digest` on the Worker (`src/admin/routes.ts` L61-64, `src/admin/digest.ts`), header `x-admin-key`. It exists, so no new code is needed.

| Call | Effect | When to use |
|---|---|---|
| `GET /admin/digest` | **Dry run.** Returns `{ text, stats }`; nothing is sent | any time, to preview |
| `POST /admin/digest?dry=1` | same as GET | any time |
| `POST /admin/digest?test=1` | sends to the **TEST** chat (`TELEGRAM_TEST_CHAT_ID`), message marked as test | rehearsal |
| `POST /admin/digest` | sends to the **real group** «заявки(демо)» that Dima has joined | **only at the meeting**, never as a test |
| `&date=YYYY-MM-DD` / `?date=YYYY-MM-DD` | digest for another Riga day (default: today in Riga) | optional |

What it counts: REAL rows only (rows with `is_test=TRUE` are excluded) for the Riga day: calls (and how many were outside office hours), inspections booked, callback requests, access reschedules, questions for the engineer, buildings in the requests. Demo calls through the talk-to link are real rows, so the preflight test call and the meeting calls all show up.

The cron fires it automatically Mon-Fri at 15:00 UTC (`wrangler.jsonc`): 18:00 Riga until 25 Oct 2026, 17:00 after the clock change. A manual POST does not cancel the cron, so the group then gets two digests that day.

## Commands (PowerShell 5.1, folder `Dima voice`; the key is never typed or printed)
```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
. .\scripts\env.ps1
$h = @{ 'x-admin-key' = $env:SCG_ADMIN_KEY }
$base = 'https://scg-voice-demo.scg-voice-demo.workers.dev'

# Preview (safe): only the counters, so PowerShell 5.1 does not mangle the Cyrillic text
(Invoke-RestMethod "$base/admin/digest" -Headers $h).stats | ConvertTo-Json

# Rehearsal: to the TEST chat
Invoke-RestMethod "$base/admin/digest?test=1" -Method Post -Headers $h | Select-Object ok, sent

# At the meeting only: to the real group
Invoke-RestMethod "$base/admin/digest" -Method Post -Headers $h | Select-Object ok, sent
```

Not fired during WP9 (it would post to the real group).
