// Telegram Bot API: sendMessage (HTML), 3 s timeout. The bot token is part of the URL, so errors never echo it.
import type { Deps } from "../routes/types";
import { withTimeout } from "../routes/util";

export interface SendResult {
  ok: boolean;
  /** Why nothing was sent or why it failed (never contains the token). */
  reason?: "no_token" | "no_chat" | "timeout" | "network" | "http" | "skipped_test_without_test_chat";
  status?: number;
  message_id?: number;
}

/** Chat for a message: [TEST] traffic only ever goes to the test chat (and is dropped when there is none). */
export function chatFor(deps: Deps, isTest: boolean): string | null {
  const chat = (isTest ? deps.env.TELEGRAM_TEST_CHAT_ID : deps.env.TELEGRAM_CHAT_ID)?.trim();
  return chat || null;
}

/** Sends and logs a failure (reason + HTTP status only, never the token or the text) so a lost alert is visible in `wrangler tail`. */
export async function sendTelegram(deps: Deps, text: string, isTest: boolean): Promise<SendResult> {
  const r = await sendTelegramOnce(deps, text, isTest);
  if (!r.ok && r.reason !== "skipped_test_without_test_chat") console.log(JSON.stringify({ evt: "telegram_fail", reason: r.reason, status: r.status ?? null, test: isTest }));
  return r;
}

async function sendTelegramOnce(deps: Deps, text: string, isTest: boolean): Promise<SendResult> {
  const token = deps.env.TELEGRAM_BOT_TOKEN?.replace(/[\r\n]+/g, "").trim();
  if (!token) return { ok: false, reason: "no_token" };
  const chat = chatFor(deps, isTest);
  if (!chat) return { ok: false, reason: isTest ? "skipped_test_without_test_chat" : "no_chat" };
  const ctrl = new AbortController();
  try {
    const res = await withTimeout(
      deps.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true }),
        signal: ctrl.signal,
      }),
      deps.limits.telegramMs,
      "telegram",
      () => ctrl.abort(),
    );
    if (!res.ok) return { ok: false, reason: "http", status: res.status };
    const body = (await res.json().catch(() => null)) as { result?: { message_id?: number } } | null;
    return { ok: true, message_id: body?.result?.message_id };
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network" };
  }
}

/** getMe for the deep health check. Returns the bot username only. */
export async function telegramGetMe(deps: Deps): Promise<{ ok: boolean; username?: string }> {
  const token = deps.env.TELEGRAM_BOT_TOKEN?.replace(/[\r\n]+/g, "").trim();
  if (!token) return { ok: false };
  const ctrl = new AbortController();
  try {
    const res = await withTimeout(deps.fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: ctrl.signal }), deps.limits.telegramMs, "telegram", () => ctrl.abort());
    const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: { username?: string } } | null;
    return { ok: Boolean(res.ok && body?.ok), username: body?.result?.username };
  } catch {
    return { ok: false };
  }
}
