// Cloudflare Worker entry: routes + crons. Demo C «Anna» backend for Smart Comfort Group.
import { handleAdminRequest } from "./admin/routes";
import { sendDigest } from "./admin/digest";
import { rollWorksForward } from "./admin/works";
import { handleToolRequest } from "./routes/tools";
import { DEFAULT_LIMITS, type Deps, type Env } from "./routes/types";
import { json } from "./routes/util";
import { handleElevenLabsWebhook } from "./webhooks/elevenlabs";

export const CRON_DIGEST = "0 15 * * 1-5";
export const CRON_WORKS = "0 4 * * *";

function makeDeps(env: Env, ctx: Pick<ExecutionContext, "waitUntil">, overrides: Partial<Deps> = {}): Deps {
  return {
    env,
    // late-bound so a stubbed globalThis.fetch (tests) is honoured
    fetch: (url, init) => globalThis.fetch(url, init),
    now: () => new Date(),
    limits: DEFAULT_LIMITS,
    waitUntil: (p) => ctx.waitUntil(p),
    ...overrides,
  };
}

/** Request handler (exported for tests: `overrides` injects fetch, clock, limits and waitUntil). */
export async function handleRequest(req: Request, env: Env, ctx: Pick<ExecutionContext, "waitUntil">, overrides: Partial<Deps> = {}): Promise<Response> {
  const deps = makeDeps(env, ctx, overrides);
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (path.startsWith("/tools/")) {
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    return handleToolRequest(req, path.slice("/tools/".length), deps);
  }
  if (path === "/webhooks/elevenlabs") {
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    return handleElevenLabsWebhook(req, deps);
  }
  if (path.startsWith("/admin/")) return handleAdminRequest(req, url, deps);
  if (path === "" || path === "/") return json({ ok: true, service: "scg-voice-demo" });
  return json({ ok: false, error: "not_found" }, 404);
}

/** Cron handler (exported for tests). */
export async function handleScheduled(cron: string, env: Env, ctx: Pick<ExecutionContext, "waitUntil">, overrides: Partial<Deps> = {}): Promise<unknown> {
  const deps = makeDeps(env, ctx, overrides);
  if (cron === CRON_DIGEST) return sendDigest(deps);
  if (cron === CRON_WORKS) return rollWorksForward(deps);
  console.log(JSON.stringify({ evt: "cron", ignored: cron }));
  return null;
}

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(req, env, ctx);
  },
  scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(
      handleScheduled(event.cron, env, ctx).catch((e) => console.log(JSON.stringify({ evt: "cron", cron: event.cron, error: e instanceof Error ? e.message.slice(0, 120) : "error" }))),
    );
  },
};
