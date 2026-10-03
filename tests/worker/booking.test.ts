import { describe, expect, it } from "vitest";
import { parseResponse } from "../../src/contract";
import { resetGoogleTokenCache } from "../../src/google/auth";
import { inspectionEventId } from "../../src/google/calendar";
import { sha256Hex } from "../../src/routes/util";
import { base, bookingBody, harness, SLOT, SLOT2 } from "./helpers";

const busyAt = (start: string, end: string) => ({ extraBusy: [{ start, end }] });

describe("event id", () => {
  it("is the first 32 hex of SHA-256(conversation_id|inspection)", async () => {
    expect(await inspectionEventId("conv-1")).toBe((await sha256Hex("conv-1|inspection")).slice(0, 32));
  });
});

describe("slot_taken", () => {
  it("someone else holds the slot: slot_taken + 2 alternatives + the slot_taken phrase, nothing written", async () => {
    const h = await harness(busyAt("2026-10-06T10:00:00+03:00", "2026-10-06T11:00:00+03:00"));
    const r = await h.call("book_inspection", bookingBody("c-taken"));
    parseResponse("book_inspection", r.body);
    expect(r.body).toMatchObject({ ok: false, error: { code: "slot_taken" } });
    expect(r.body.alternatives).toHaveLength(2);
    for (const a of r.body.alternatives) expect(a.start).not.toBe(SLOT);
    expect(r.body.say_ru).toContain(r.body.alternatives[0].label_ru);
    expect(r.body.say_ru).toContain(r.body.alternatives[1].label_ru);
    expect(h.world.events.size).toBe(0);
    await h.flush();
    expect(h.world.tabs.Leads).toHaveLength(0);
    expect(h.world.telegram).toHaveLength(0);
  });

  it("booking one of the offered alternatives then works", async () => {
    const h = await harness(busyAt("2026-10-06T10:00:00+03:00", "2026-10-06T11:00:00+03:00"));
    const first = await h.call("book_inspection", bookingBody("c-alt"));
    const alt = first.body.alternatives[0];
    const second = await h.call("book_inspection", bookingBody("c-alt", { slot_start: alt.start }));
    expect(second.body).toMatchObject({ ok: true, replayed: false });
    expect(second.body.slot.start).toBe(alt.start);
  });

  it("invalid_slot (not on the grid) returns alternatives to pick from", async () => {
    const h = await harness();
    const r = await h.call("book_inspection", bookingBody("c-bad", { slot_start: "2026-10-06T10:30:00+03:00" }));
    expect(r.body.error.code).toBe("invalid_slot");
    expect(r.body.alternatives.length).toBe(2);
    const sat = await h.call("book_inspection", bookingBody("c-bad", { slot_start: "2026-10-10T10:00:00+03:00" }));
    expect(sat.body.error.code).toBe("invalid_slot");
    expect(h.world.events.size).toBe(0);
  });
});

describe("409: idempotent replay", () => {
  it("same conversation, same slot: returns the existing booking, no second event, no second Telegram, no second Leads row", async () => {
    const h = await harness();
    const a = await h.call("book_inspection", bookingBody("c-replay"));
    await h.flush();
    h.world.reset();
    const b = await h.call("book_inspection", bookingBody("c-replay"));
    await h.flush();
    expect(b.body).toMatchObject({ ok: true, replayed: true, booking_id: a.body.booking_id });
    expect(b.body.slot.start).toBe(SLOT);
    expect(h.world.events.size).toBe(1);
    expect(h.world.tabs.Leads).toHaveLength(1);
    expect(h.world.telegram).toHaveLength(1);
    expect(h.world.count).toBeLessThanOrEqual(6);
  });

  it("insert answers 409 for the same slot (freeBusy lag): the existing event is returned", async () => {
    const h = await harness();
    // pre-create the event so freeBusy shows it, then hide it from freeBusy by simulating lag: use the real 409 path via a second world call order
    const id = await inspectionEventId("c-lag");
    h.world.events.set(id, { id, status: "confirmed", summary: "x", description: "y", start: { dateTime: SLOT }, end: { dateTime: "2026-10-06T11:00:00+03:00" }, extendedProperties: { private: {} } });
    const r = await h.call("book_inspection", bookingBody("c-lag"));
    expect(r.body).toMatchObject({ ok: true, replayed: true });
  });

  it("same conversation, DIFFERENT slot: the event is PATCHed and Telegram says «перенос»", async () => {
    const h = await harness();
    const a = await h.call("book_inspection", bookingBody("c-move"));
    await h.flush();
    resetGoogleTokenCache(); // worst case: a cold isolate on the move path (token, freeBusy, insert 409, get, patch, telegram)
    h.world.reset();
    const b = await h.call("book_inspection", bookingBody("c-move", { slot_start: "2026-10-07T14:00:00+03:00" }));
    await h.flush();
    expect(b.body).toMatchObject({ ok: true, replayed: false, booking_id: a.body.booking_id });
    expect(b.body.slot.start).toBe("2026-10-07T14:00:00+03:00");
    expect(h.world.events.size).toBe(1);
    expect([...h.world.events.values()][0]!.start.dateTime).toBe("2026-10-07T14:00:00+03:00");
    expect(h.world.urls.some((u) => u.startsWith("PATCH"))).toBe(true);
    expect(h.world.telegram).toHaveLength(2);
    expect(h.world.telegram[1]!.text).toContain("Перенос осмотра");
    expect(h.world.telegram[1]!.text).toContain("Было: вторник, 6 октября, 10:00");
    expect(h.world.telegram[1]!.text.endsWith(`ДЕМО · ${a.body.booking_id}`)).toBe(true);
    expect(h.world.count).toBeLessThanOrEqual(6);
  });

  it("moving onto a slot someone else holds is slot_taken (the event stays where it was)", async () => {
    const h = await harness();
    await h.call("book_inspection", bookingBody("c-move2"));
    h.world.opts.extraBusy = [{ start: "2026-10-07T14:00:00+03:00", end: "2026-10-07T15:00:00+03:00" }];
    const b = await h.call("book_inspection", bookingBody("c-move2", { slot_start: "2026-10-07T14:00:00+03:00" }));
    expect(b.body.error.code).toBe("slot_taken");
    expect([...h.world.events.values()][0]!.start.dateTime).toBe(SLOT);
  });

  it("a cancelled event of the same conversation is revived by PATCH", async () => {
    const h = await harness();
    await h.call("book_inspection", bookingBody("c-rev"));
    [...h.world.events.values()][0]!.status = "cancelled";
    const r = await h.call("book_inspection", bookingBody("c-rev"));
    expect(r.body.ok).toBe(true);
    expect([...h.world.events.values()][0]!.status).toBe("confirmed");
  });
});

describe("token cache", () => {
  it("the Google token is fetched once per isolate and reused (pre-warm during lookup)", async () => {
    const h = await harness();
    await h.call("lookup_building", { ...base("t1"), address: "Илукстес 16" });
    await h.flush();
    await h.call("get_slots", base("t1"));
    await h.call("book_inspection", bookingBody("t1"));
    await h.flush();
    expect(h.world.urls.filter((u) => u.includes("oauth2.googleapis.com")).length).toBe(1);
  });

  it("the JWT is RS256 and carries the Calendar + Sheets scopes", async () => {
    const h = await harness();
    let assertion = "";
    const orig = h.world.fetch;
    h.world.fetch = async (url, init) => {
      if (url.includes("oauth2")) assertion = new URLSearchParams(String(init!.body)).get("assertion")!;
      return orig(url, init);
    };
    // handleRequest was bound to the original fetch; call the token code through a fresh request using the wrapper
    const { handleRequest } = await import("../../src/index");
    const { resetGoogleTokenCache } = await import("../../src/google/auth");
    resetGoogleTokenCache();
    await handleRequest(
      new Request("https://w.example/tools/get_slots", { method: "POST", headers: { "x-scg-key": "tool-key-123" }, body: JSON.stringify(base("jwt")) }),
      h.env,
      { waitUntil: () => undefined },
      { fetch: h.world.fetch, now: () => new Date("2026-10-05T08:00:00Z") },
    );
    const [hdr, claim] = assertion.split(".").slice(0, 2).map((p) => JSON.parse(Buffer.from(p, "base64url").toString()));
    expect(hdr).toEqual({ alg: "RS256", typ: "JWT" });
    expect(claim.scope).toContain("auth/calendar");
    expect(claim.scope).toContain("auth/spreadsheets");
    expect(claim.aud).toBe("https://oauth2.googleapis.com/token");
    expect(claim.exp - claim.iat).toBe(3600);
  });
});

void SLOT2;
