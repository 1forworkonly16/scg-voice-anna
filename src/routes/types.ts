// Shared types of the Worker. `Deps` is what every handler receives, so tests can inject fetch, clock and limits.
export interface Env {
  // ---- secrets (set with `wrangler secret put`, never in files) ----
  GOOGLE_SA_KEY_JSON: string;
  SCG_TOOL_KEY: string;
  SCG_ADMIN_KEY: string;
  ELEVENLABS_WEBHOOK_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  /** Optional: key of a later web channel (demo A). Requests with it get channel = "web". */
  SCG_TOOL_KEY_WEB?: string;
  // ---- plain vars (wrangler.jsonc, filled by WP7) ----
  CALENDAR_ID: string;
  SHEET_ID: string;
  TELEGRAM_CHAT_ID: string;
  TELEGRAM_TEST_CHAT_ID: string;
  /** Comma-separated ElevenLabs agent ids whose post-call webhooks are processed. */
  ELEVENLABS_AGENT_ID: string;
  /** digits (default) | words | grouped: how prices are written into say_*. */
  NUMBER_MODE?: string;
  /** Comma-separated names of the tools that may be called. Unset or empty: every tool. Live keeps the M2 tools (create_ticket, log_request) off until WP13. */
  TOOLS_ENABLED?: string;
  /** latin (default) | cyrillic: with cyrillic, say_ru speaks street addresses as Russian words; say_lv, Sheet, Calendar and Telegram keep the Latin address. */
  RU_STREET_SPOKEN?: string;
}

export interface Limits {
  googleMs: number;
  telegramMs: number;
  toolMs: number;
}

export const DEFAULT_LIMITS: Limits = { googleMs: 3500, telegramMs: 3000, toolMs: 6000 };

export interface Deps {
  env: Env;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  now: () => Date;
  limits: Limits;
  /** Background work after the response (Workers ctx.waitUntil). */
  waitUntil: (p: Promise<unknown>) => void;
}

export type Channel = "voice" | "web";
