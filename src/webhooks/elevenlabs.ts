// POST /webhooks/elevenlabs: post-call webhook. Signature `ElevenLabs-Signature: t=<unix>,v0=<hex>[,v0=<hex>...]`,
// v0 = HMAC-SHA256(secret, `${t}.${rawBody}`). ALWAYS answers 200 (ElevenLabs auto-disables a webhook after repeated failures);
// anything that is not trustworthy or not ours is ignored. The Calls row holds summary + criteria + data fields, NEVER the transcript.
import { appendRow, rowOf } from "../google/sheets";
import type { Deps } from "../routes/types";
import { cleanSecret, hmacSha256Hex, isTestMarker, json, safeEqual } from "../routes/util";

export const SIGNATURE_TOLERANCE_SEC = 30 * 60;

export type SignatureVerdict = "ok" | "missing" | "malformed" | "stale" | "mismatch";

export async function verifySignature(header: string | null, rawBody: string, secret: string, nowSec: number, toleranceSec = SIGNATURE_TOLERANCE_SEC): Promise<SignatureVerdict> {
  const s = cleanSecret(secret);
  if (!header || !s) return "missing";
  let t = "";
  const v0: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") t = v;
    else if (k === "v0" && v) v0.push(v.toLowerCase());
  }
  const ts = Number(t);
  if (!/^\d+$/.test(t) || !Number.isFinite(ts) || !v0.length) return "malformed";
  if (Math.abs(nowSec - ts) > toleranceSec) return "stale";
  const expected = await hmacSha256Hex(s, `${t}.${rawBody}`);
  let match = false;
  for (const cand of v0) if (await safeEqual(cand, expected)) match = true; // check every candidate (rotated secrets send several)
  return match ? "ok" : "mismatch";
}

interface PostCallPayload {
  type?: string;
  data?: {
    agent_id?: string;
    conversation_id?: string;
    status?: string;
    metadata?: { start_time_unix_secs?: number; call_duration_secs?: number; main_language?: string };
    analysis?: {
      call_successful?: string;
      transcript_summary?: string;
      evaluation_criteria_results?: Record<string, { result?: string } | undefined>;
      data_collection_results?: Record<string, { value?: unknown } | undefined>;
    };
    conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> };
  };
}

/** Removes anything that looks like a phone number from free text (data minimisation). */
export function scrubSummary(text: string): string {
  return text.replace(/\+?\d[\d\s().-]{5,}\d/g, "[номер]").slice(0, 1500);
}

const MAX_JSON = 2500;

function compactJson(o: unknown): string {
  const s = JSON.stringify(o);
  return s.length > MAX_JSON ? `${s.slice(0, MAX_JSON - 12)}...[cut]` : s;
}

function agentAllowed(deps: Deps, agentId: string | undefined): boolean {
  const allowed = (deps.env.ELEVENLABS_AGENT_ID ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return Boolean(agentId) && allowed.includes(agentId!);
}

export async function handleElevenLabsWebhook(req: Request, deps: Deps): Promise<Response> {
  const reply = (processed: boolean, reason?: string) => json({ received: true, processed, ...(reason ? { reason } : {}) });
  try {
    const raw = await req.text();
    const verdict = await verifySignature(req.headers.get("elevenlabs-signature"), raw, deps.env.ELEVENLABS_WEBHOOK_SECRET, Math.floor(deps.now().getTime() / 1000));
    if (verdict !== "ok") {
      console.log(JSON.stringify({ evt: "webhook", processed: false, reason: `signature_${verdict}` }));
      return reply(false, `signature_${verdict}`);
    }
    let payload: PostCallPayload;
    try {
      payload = JSON.parse(raw) as PostCallPayload;
    } catch {
      return reply(false, "bad_json");
    }
    if (payload.type !== "post_call_transcription") return reply(false, "ignored_type");
    const d = payload.data ?? {};
    if (!agentAllowed(deps, d.agent_id)) {
      console.log(JSON.stringify({ evt: "webhook", processed: false, reason: "other_agent" }));
      return reply(false, "other_agent");
    }
    const conv = d.conversation_id ?? "";
    const a = d.analysis ?? {};
    const criteria = Object.fromEntries(Object.entries(a.evaluation_criteria_results ?? {}).map(([k, v]) => [k, v?.result ?? ""]));
    const data = Object.fromEntries(Object.entries(a.data_collection_results ?? {}).map(([k, v]) => [k, v?.value ?? null]));
    const started = d.metadata?.start_time_unix_secs ? new Date(d.metadata.start_time_unix_secs * 1000) : deps.now();
    const dv = d.conversation_initiation_client_data?.dynamic_variables ?? {};
    const isTest = isTestMarker(conv) || dv.is_test === true || dv.is_test === "true";
    const row = rowOf("Calls", {
      timestamp: started.toISOString(), conversation_id: conv, agent_id: d.agent_id ?? "", language: d.metadata?.main_language ?? "",
      duration_s: d.metadata?.call_duration_secs ?? "", status: d.status ?? "", call_successful: a.call_successful ?? "",
      summary: scrubSummary(a.transcript_summary ?? ""), criteria_json: compactJson(criteria), data_json: compactJson(data), is_test: isTest ? "TRUE" : "",
    });
    deps.waitUntil(appendRow(deps, "Calls", row).catch(() => console.log(JSON.stringify({ evt: "webhook", processed: false, reason: "sheet_write_failed" }))));
    return reply(true);
  } catch {
    return reply(false, "error");
  }
}
