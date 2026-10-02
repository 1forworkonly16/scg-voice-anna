# H1: set up your keys (one sitting, about 30 minutes)

Open Windows PowerShell in `C:\Users\Banknote\Desktop\Dima smartcomfort\Dima voice`. Do ElevenLabs first so the spike can start.

**How to open PowerShell in this folder:** File Explorer -> open the `Dima voice` folder -> click the address bar -> type `powershell` -> Enter. Do not change any PowerShell execution policy; the commands below do not need it.

## How to store any secret WITHOUT typing it
1. Copy the value from the website (Ctrl+C).
2. In PowerShell run (replace NAME with the variable name from the table below):
   `[Environment]::SetEnvironmentVariable('NAME', (Get-Clipboard -Raw).Trim(), 'User')`
3. Clear the clipboard: `Set-Clipboard -Value ' '`
4. Repeat for the next secret.

Warnings:
- Never paste the secret value into the terminal or into chat. Only the command above, which reads the clipboard.
- Never use `setx` (truncates long values).
- New values are invisible to shells that are already running. That is fine: our scripts read the User scope directly.

Verify (prints names and present/missing only):
`powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\env.ps1 -Check`

## 1. ElevenLabs API key -> `ELEVENLABS_API_KEY`
1. Sign in at elevenlabs.io (Creator plan).
2. Click your profile (bottom left) -> **API keys** -> **Create API key**.
3. Name it `scg-voice-demo`. Restrict scopes to: **convai_read, convai_write, voices_read, voices_write, webhooks_write, conversation_privacy_manage, text_to_speech, user_read**.
   The dashboard may show friendly permission names instead of the API ones. Generic mapping: for Agents / Conversational AI, Voices and Webhooks choose **Write** (it includes read); for Text to Speech choose **Access**; for User choose **Read**; give conversation privacy settings access if it is listed. If one of these permissions is not listed, stop and tell Claude; do not create an unrestricted key.
4. Copy the key and store it with the clipboard command (NAME = `ELEVENLABS_API_KEY`).
5. Do NOT add Pay As You Go credit.

## 2. Cloudflare -> `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
1. Sign up free at dash.cloudflare.com (no card needed for Workers Free).
2. In the dashboard open **Workers & Pages** and follow the onboarding to **claim your workers.dev subdomain** (pick a short name, e.g. `scg-demo`).
3. **Account id:** copy it from the dashboard sidebar (Account home -> the three-dot menu next to the account -> Copy account ID), or from the URL `dash.cloudflare.com/<ACCOUNT_ID>/...`. Store as `CLOUDFLARE_ACCOUNT_ID` (not secret, but same method).
4. **API token:** top-right profile -> **My Profile** -> **API Tokens** -> **Create Token** -> template **Edit Cloudflare Workers** -> Use template. Leave the defaults (account resources: your account; zone resources: All zones is fine) -> **Continue to summary** -> **Create Token**. Copy it and store as `CLOUDFLARE_API_TOKEN`.
5. Do NOT run a plain `wrangler login`.

## 3. Telegram -> `TELEGRAM_BOT_TOKEN`
1. In Telegram open **@BotFather** -> send `/newbot`. Give it a name (e.g. `SCG Заявки Демо`) and a username ending in `bot`.
2. BotFather replies with a token. Copy it and store as `TELEGRAM_BOT_TOKEN`. Then delete that BotFather message.
3. Create a **group** named `SCG — Заявки (демо)`. Group settings -> **Chat history for new members** = **Hidden**.
4. Add your bot to the group (as a member; admin is not needed) and post one message in the group.
5. Open a **private chat with the bot** and send `/start` (test traffic goes only there).
6. In the group create an **invite link** (group settings -> Invite links). Paste that link into the chat with Claude. It is not secret.

## 4. Google
Nothing to do now. If WP5 reports an expired token, run `gws auth login` when asked.

## All environment variables
| Variable | Set by | When |
|---|---|---|
| `ELEVENLABS_API_KEY` | You | H1 |
| `CLOUDFLARE_API_TOKEN` | You | H1 |
| `CLOUDFLARE_ACCOUNT_ID` | You | H1 |
| `TELEGRAM_BOT_TOKEN` | You | H1 |
| `GOOGLE_SA_KEY_JSON` | Subagent (WP5, from gcloud stdout, never a file) | after H1 |
| `SCG_TOOL_KEY` | Subagent (WP7/WP8, generated random) | later |
| `SCG_ADMIN_KEY` | Subagent (WP7/WP8, generated random) | later |
| `ELEVENLABS_WEBHOOK_SECRET` | Subagent (WP7/WP8, from the webhook setup) | later |

After H1, tell Claude "H1 done" and paste only the invite link.
