// The branch of book_inspection where freeBusy shows the slot as FREE (replication lag) but events.insert answers 409
// because this conversation's event already exists. The other 409 tests pre-fill freeBusy; here freeBusy is blind.
import { describe, expect, it } from "vitest";
import { inspectionEventId } from "../../src/google/calendar";
import { bookingBody, harness, SLOT, type Harness } from "./helpers";

/** freeBusy always answers "no busy intervals" (the calendar has not caught up yet). */
function blindFreeBusy(h: Harness): void {
  const orig = h.world.fetch;
  h.world.fetch = async (url, init) => {
    if (url.includes("/freeBusy")) {
      const body = JSON.parse(String(init!.body)) as { items: { id: string }[] };
      return new Response(JSON.stringify({ calendars: { [body.items[0]!.id]: { busy: [] } } }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return orig(url, init);
  };
}

async function seed(h: Harness, conv: string, over: { status?: string; start?: string; end?: string } = {}) {
  const id = await inspectionEventId(conv);
  h.world.events.set(id, {
    id,
    status: over.status ?? "confirmed",
    summary: "[TEST] seeded",
    description: "seeded",
    start: { dateTime: over.start ?? SLOT },
    end: { dateTime: over.end ?? "2026-10-06T11:00:00+03:00" },
    extendedProperties: { private: { is_test: "true" } },
  });
  return id;
}

describe("insert 409 while freeBusy is blind", () => {
  it("same slot: returns the existing booking (replayed), writes nothing new", async () => {
    const h = await harness();
    blindFreeBusy(h);
    const id = await seed(h, "c-409-same");
    const r = await h.call("book_inspection", bookingBody("c-409-same"));
    await h.flush();
    expect(r.body).toMatchObject({ ok: true, replayed: true });
    expect(r.body.booking_id).toBe(`B-${id.slice(0, 8).toUpperCase()}`);
    expect(h.world.urls.some((u) => u.startsWith("POST") && u.includes("/events"))).toBe(true); // the insert was really attempted
    expect(h.world.events.size).toBe(1);
    expect(h.world.urls.some((u) => u.startsWith("PATCH"))).toBe(false);
    expect(h.world.tabs.Leads).toHaveLength(0);
    expect(h.world.telegram).toHaveLength(0);
  });

  it("existing event at the same instant but a different UTC offset still counts as the same slot", async () => {
    const h = await harness();
    blindFreeBusy(h);
    await seed(h, "c-409-utc", { start: "2026-10-06T07:00:00Z", end: "2026-10-06T08:00:00Z" });
    const r = await h.call("book_inspection", bookingBody("c-409-utc"));
    expect(r.body).toMatchObject({ ok: true, replayed: true });
    expect(h.world.urls.some((u) => u.startsWith("PATCH"))).toBe(false);
  });

  it("existing event for another time: moved by PATCH, «перенос» alert, no second Leads row", async () => {
    const h = await harness();
    blindFreeBusy(h);
    await seed(h, "c-409-move", { start: "2026-10-07T14:00:00+03:00", end: "2026-10-07T15:00:00+03:00" });
    const r = await h.call("book_inspection", bookingBody("c-409-move"));
    await h.flush();
    expect(r.body).toMatchObject({ ok: true, replayed: false });
    expect(h.world.urls.some((u) => u.startsWith("PATCH"))).toBe(true);
    expect([...h.world.events.values()][0]!.start.dateTime).toBe(SLOT);
    expect(h.world.telegram).toHaveLength(1);
    expect(h.world.telegram[0]!.text).toContain("Перенос осмотра");
    expect(h.world.tabs.Leads).toHaveLength(0);
  });

  it("cancelled event of the same slot is revived by PATCH, not reported as a replay", async () => {
    const h = await harness();
    blindFreeBusy(h);
    await seed(h, "c-409-cancelled", { status: "cancelled" });
    const r = await h.call("book_inspection", bookingBody("c-409-cancelled"));
    expect(r.body).toMatchObject({ ok: true, replayed: false });
    expect([...h.world.events.values()][0]!.status).toBe("confirmed");
  });

  it("409 but the follow-up GET finds nothing: calendar_down, no booking is confirmed", async () => {
    const h = await harness();
    blindFreeBusy(h);
    await seed(h, "c-409-gone");
    const orig = h.world.fetch;
    h.world.fetch = async (url, init) => {
      if ((init?.method ?? "GET") === "GET" && /\/events\/[^/?]+$/.test(new URL(url).pathname)) return new Response("{}", { status: 404 });
      return orig(url, init);
    };
    const r = await h.call("book_inspection", bookingBody("c-409-gone"));
    await h.flush();
    expect(r.body.ok).toBe(false);
    expect(r.body.error.code).toBe("calendar_down");
    expect(h.world.telegram).toHaveLength(0);
    expect(h.world.tabs.Leads).toHaveLength(0);
  });
});
