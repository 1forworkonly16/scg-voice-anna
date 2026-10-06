// WPV3: the name is optional in book_inspection (absent, empty or blank = the caller gave none; «—» is shown instead),
// and the invalid_phone hint of book_inspection and request_callback.
import { describe, expect, it } from "vitest";
import { parseResponse } from "../../src/contract";
import { LEADS_HEADERS } from "../../src/google/sheet_schema";
import { base, bookingBody, harness } from "./helpers";

const NAME = LEADS_HEADERS.indexOf("name");
const PHONE = LEADS_HEADERS.indexOf("phone");

describe("book_inspection without a name", () => {
  const variants: [string, Record<string, unknown>][] = [
    ["omitted", { name: undefined }],
    ["empty", { name: "" }],
    ["blank", { name: "  \t " }],
  ];
  for (const [label, over] of variants) {
    it(`${label}: ok, Leads row «—», Telegram «—», Calendar description «—»; same 5 subrequests`, async () => {
      const h = await harness();
      const r = await h.call("book_inspection", bookingBody(`c-noname-${label}`, over));
      parseResponse("book_inspection", r.body);
      expect(r.body).toMatchObject({ ok: true, replayed: false });
      expect(r.body.slot.start).toBe("2026-10-06T10:00:00+03:00");
      await h.flush();
      expect(h.world.tabs.Leads).toHaveLength(1);
      expect(h.world.tabs.Leads[0]![NAME]).toBe("—");
      expect(h.world.tabs.Leads[0]![PHONE]).toBe("+37122848144");
      expect(h.world.telegram).toHaveLength(1);
      expect(h.world.telegram[0]!.text).toContain("Контакт: —, +37122848144");
      expect(h.world.telegram[0]!.text.startsWith("<b>Новая заявка</b>")).toBe(true);
      const ev = [...h.world.events.values()][0]!;
      expect(ev.description).toContain("Звонил(а): член правления / старший по дому, —, +37122848144");
      expect(JSON.stringify([h.world.tabs.Leads, h.world.telegram, ev])).not.toMatch(/undefined|null/);
      expect(h.world.count).toBe(5); // token, freeBusy, insert, sheets, telegram
    });
  }

  it("a given name is stored as before, trimmed", async () => {
    const h = await harness();
    const r = await h.call("book_inspection", bookingBody("c-name", { name: "  Иван Петров " }));
    expect(r.body.ok).toBe(true);
    await h.flush();
    expect(h.world.tabs.Leads[0]![NAME]).toBe("Иван Петров");
    expect(h.world.telegram[0]!.text).toContain("Контакт: Иван Петров, +37122848144");
    expect([...h.world.events.values()][0]!.description).toContain("Звонил(а): член правления / старший по дому, Иван Петров, +37122848144");
  });

  it("a [TEST] marker in the name still flags the booking, with or without surrounding blanks", async () => {
    const h = await harness();
    const r = await h.call("book_inspection", bookingBody("c-tm", { name: "  [TEST] Иван" }));
    expect(r.body.ok).toBe(true);
    await h.flush();
    expect(h.world.telegram.map((m) => m.chat_id)).toEqual(["555"]);
    expect(h.world.tabs.Leads[0]![24]).toBe("TRUE");
  });

  it("a [TEST] conversation without a name is flagged too", async () => {
    const h = await harness();
    const r = await h.call("book_inspection", bookingBody("[TEST]-noname", { name: undefined }));
    expect(r.body.ok).toBe(true);
    await h.flush();
    expect(h.world.telegram.map((m) => m.chat_id)).toEqual(["555"]);
    expect(h.world.telegram[0]!.text).toContain("Контакт: —");
  });

  it("re-booking in the same conversation without a name moves the event: ok with the new slot, «Перенос осмотра», one event, one Leads row", async () => {
    const h = await harness();
    const a = await h.call("book_inspection", bookingBody("c-rebook", { name: undefined }));
    const b = await h.call("book_inspection", bookingBody("c-rebook", { name: undefined, slot_start: "2026-10-07T14:00:00+03:00" }));
    await h.flush();
    expect(b.body).toMatchObject({ ok: true, replayed: false, booking_id: a.body.booking_id });
    expect(b.body.slot.start).toBe("2026-10-07T14:00:00+03:00");
    expect(h.world.events.size).toBe(1);
    expect([...h.world.events.values()][0]!.start.dateTime).toBe("2026-10-07T14:00:00+03:00");
    expect(h.world.tabs.Leads).toHaveLength(1);
    expect(h.world.telegram).toHaveLength(2);
    expect(h.world.telegram[1]!.text).toContain("Перенос осмотра");
    expect(h.world.telegram[1]!.text).toContain("Контакт: —, +37122848144");
  });
});

describe("invalid_phone hint", () => {
  const HINT = "Ask the caller to repeat the phone number, check the 8 digits, then read it back in the caller's groups.";

  it("book_inspection: asks to repeat, check the 8 digits and read back in the caller's groups (no «digit by digit»); nothing is touched", async () => {
    const h = await harness();
    const r = await h.call("book_inspection", bookingBody("c-ph", { phone: "123456" }));
    expect(r.body).toMatchObject({ ok: false, error: { code: "invalid_phone" }, hint: HINT });
    expect(r.body.hint).not.toMatch(/digit by digit/i);
    parseResponse("book_inspection", r.body);
    expect(h.world.count).toBe(0);
  });

  it("request_callback: the same hint", async () => {
    const h = await harness();
    const r = await h.call("request_callback", { ...base("c-ph"), reason: "human_requested", summary_ru: "Хочет поговорить с человеком.", phone: "123456" });
    expect(r.body).toMatchObject({ ok: false, error: { code: "invalid_phone" }, hint: HINT });
    expect(r.body.hint).not.toMatch(/digit by digit/i);
    parseResponse("request_callback", r.body);
    expect(h.world.count).toBe(0);
  });
});
