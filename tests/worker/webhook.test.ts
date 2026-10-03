import { describe, expect, it } from "vitest";
import { hmacSha256Hex } from "../../src/routes/util";
import { scrubSummary, verifySignature } from "../../src/webhooks/elevenlabs";
import { AGENT_ID, harness, NOW, WH_SECRET } from "./helpers";

const nowSec = Math.floor(NOW.getTime() / 1000);

const payload = (over: Record<string, unknown> = {}, agent = AGENT_ID) =>
  JSON.stringify({
    type: "post_call_transcription",
    event_timestamp: nowSec,
    data: {
      agent_id: agent,
      conversation_id: "conv_abc",
      status: "done",
      transcript: [{ role: "user", message: "SECRET TRANSCRIPT TEXT" }],
      metadata: { start_time_unix_secs: nowSec - 120, call_duration_secs: 95, main_language: "ru" },
      analysis: {
        call_successful: "success",
        transcript_summary: "Старший по дому звонил про Ilūkstes 16, оставил номер +371 22848144.",
        evaluation_criteria_results: { ai_disclosed_first: { criteria_id: "ai_disclosed_first", result: "success", rationale: "..." } },
        data_collection_results: { caller_role: { data_collection_id: "caller_role", value: "board_member" } },
      },
      ...over,
    },
  });

async function sign(body: string, t = nowSec, secrets = [WH_SECRET]): Promise<string> {
  const v0s = await Promise.all(secrets.map((s) => hmacSha256Hex(s, `${t}.${body}`)));
  return `t=${t},${v0s.map((v) => `v0=${v}`).join(",")}`;
}

describe("verifySignature", () => {
  it("valid", async () => {
    const b = payload();
    expect(await verifySignature(await sign(b), b, WH_SECRET, nowSec)).toBe("ok");
  });
  it("stale (older than 30 min) and far-future timestamps are rejected", async () => {
    const b = payload();
    expect(await verifySignature(await sign(b, nowSec - 31 * 60), b, WH_SECRET, nowSec)).toBe("stale");
    expect(await verifySignature(await sign(b, nowSec - 29 * 60), b, WH_SECRET, nowSec)).toBe("ok");
    expect(await verifySignature(await sign(b, nowSec + 31 * 60), b, WH_SECRET, nowSec)).toBe("stale");
  });
  it("rotated secret: several v0 values, any one may match", async () => {
    const b = payload();
    expect(await verifySignature(await sign(b, nowSec, ["old-secret", WH_SECRET]), b, WH_SECRET, nowSec)).toBe("ok");
    expect(await verifySignature(await sign(b, nowSec, [WH_SECRET, "old-secret"]), b, WH_SECRET, nowSec)).toBe("ok");
    expect(await verifySignature(await sign(b, nowSec, ["old-secret", "older"]), b, WH_SECRET, nowSec)).toBe("mismatch");
  });
  it("missing / malformed / tampered body", async () => {
    const b = payload();
    expect(await verifySignature(null, b, WH_SECRET, nowSec)).toBe("missing");
    expect(await verifySignature("garbage", b, WH_SECRET, nowSec)).toBe("malformed");
    expect(await verifySignature(await sign(b), `${b} `, WH_SECRET, nowSec)).toBe("mismatch");
    expect(await verifySignature(await sign(b), b, "", nowSec)).toBe("missing");
  });
  it("a secret with CRLF still verifies", async () => {
    const b = payload();
    expect(await verifySignature(await sign(b), b, `${WH_SECRET}\r\n`, nowSec)).toBe("ok");
  });
});

describe("POST /webhooks/elevenlabs", () => {
  const post = async (h: Awaited<ReturnType<typeof harness>>, body: string, sig: string | null) => {
    const res = await h.request("/webhooks/elevenlabs", { method: "POST", headers: { ...(sig ? { "ElevenLabs-Signature": sig } : {}) }, body });
    await h.flush();
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  it("valid: 200, one Calls row with summary + criteria and NO transcript, phone scrubbed", async () => {
    const h = await harness();
    const b = payload();
    const r = await post(h, b, await sign(b));
    expect(r).toMatchObject({ status: 200, body: { received: true, processed: true } });
    expect(h.world.tabs.Calls).toHaveLength(1);
    const row = h.world.tabs.Calls[0]!;
    expect(row[1]).toBe("conv_abc");
    expect(row[4]).toBe(95);
    expect(row[7]).toContain("[номер]");
    expect(String(row[7])).not.toContain("22848144");
    expect(JSON.parse(String(row[8]))).toEqual({ ai_disclosed_first: "success" });
    expect(JSON.parse(String(row[9]))).toEqual({ caller_role: "board_member" });
    expect(JSON.stringify(row)).not.toContain("SECRET TRANSCRIPT");
    expect(row[row.length - 1]).toBe("");
  });

  it("stale, wrong signature and missing signature: still 200, nothing written", async () => {
    const h = await harness();
    const b = payload();
    for (const sig of [await sign(b, nowSec - 40 * 60), `t=${nowSec},v0=${"0".repeat(64)}`, null]) {
      const r = await post(h, b, sig);
      expect(r.status).toBe(200);
      expect(r.body.processed).toBe(false);
    }
    expect(h.world.tabs.Calls).toHaveLength(0);
    expect(h.world.count).toBe(0);
  });

  it("rotated secret (2 v0s): processed", async () => {
    const h = await harness();
    const b = payload();
    const r = await post(h, b, await sign(b, nowSec, ["old", WH_SECRET]));
    expect(r.body.processed).toBe(true);
  });

  it("wrong agent id: 200 ignored (the webhook is workspace-wide)", async () => {
    const h = await harness();
    const b = payload({}, "agent_someone_else");
    const r = await post(h, b, await sign(b));
    expect(r).toMatchObject({ status: 200, body: { processed: false, reason: "other_agent" } });
    expect(h.world.tabs.Calls).toHaveLength(0);
    expect(h.world.count).toBe(0);
  });

  it("other event types are ignored with 200; bad JSON too", async () => {
    const h = await harness();
    const audio = JSON.stringify({ type: "post_call_audio", data: { agent_id: AGENT_ID } });
    expect((await post(h, audio, await sign(audio))).body.reason).toBe("ignored_type");
    const junk = "not json";
    expect((await post(h, junk, await sign(junk))).body.reason).toBe("bad_json");
  });

  it("a test conversation id marks the row is_test", async () => {
    const h = await harness();
    const b = payload().replace("conv_abc", "test-conv-1");
    await post(h, b, await sign(b));
    expect(h.world.tabs.Calls[0]![10]).toBe("TRUE");
  });

  it("Sheets failing still answers 200", async () => {
    const h = await harness({ status: (u) => (u.includes("sheets.googleapis") ? 500 : null) });
    const b = payload();
    const r = await post(h, b, await sign(b));
    expect(r.status).toBe(200);
  });
});

describe("scrubSummary", () => {
  it("removes phone-like digit runs only", () => {
    expect(scrubSummary("дом 9 этажей, тел 29 32 72 75 и +371 22848144")).toBe("дом 9 этажей, тел [номер] и [номер]");
  });
});
