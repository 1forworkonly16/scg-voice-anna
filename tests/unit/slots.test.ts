import { readFileSync } from "node:fs";
import { fromRoot } from "../fixtures/paths";
import { describe, expect, it } from "vitest";
import {
  HORIZON_DAYS,
  alternativesFor,
  candidateSlots,
  checkSlot,
  earliestSlotDate,
  findSlots,
  freeSlots,
  horizonDate,
  officeOpenNow,
} from "../../src/lib/slots";
import {
  addDaysYmd,
  easterSunday,
  holidayOn,
  holidaysOfYear,
  isOfficeOpen,
  isWorkingDay,
  nextWorkingDay,
  rigaHm,
  rigaLocalToUtc,
  rigaOffsetMinutes,
  rigaYmd,
  toRigaIso,
  weekdayOfYmd,
} from "../../src/lib/time";

const at = (iso: string) => new Date(iso);

describe("Easter (computed) and holidays", () => {
  it("computes Easter Sunday", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2024)).toBe("2024-03-31");
  });

  it("2026 statutory holidays are not working days", () => {
    for (const d of [
      "2026-01-01", "2026-04-03", "2026-04-05", "2026-04-06", "2026-05-01", "2026-05-04", "2026-06-23", "2026-06-24",
      "2026-11-18", "2026-12-24", "2026-12-25", "2026-12-26", "2026-12-31",
    ]) {
      expect(isWorkingDay(d), d).toBe(false);
    }
    for (const d of ["2026-06-22", "2026-06-25", "2026-11-17", "2026-11-19", "2026-12-23", "2026-12-28", "2026-10-05"]) {
      expect(isWorkingDay(d), d).toBe(true);
    }
  });

  it("2027 statutory holidays and Easter-linked days", () => {
    for (const d of ["2027-01-01", "2027-03-26", "2027-03-28", "2027-03-29", "2027-05-04", "2027-06-23", "2027-06-24", "2027-11-18", "2027-12-24", "2027-12-31"]) {
      expect(isWorkingDay(d), d).toBe(false);
    }
    expect(isWorkingDay("2027-01-04")).toBe(true);
    expect(isWorkingDay("2027-03-30")).toBe(true);
  });

  it("weekend holidays create no extra day off (verified 2026-10-03); only the verified fixed days exist", () => {
    for (const d of ["2027-05-03", "2027-12-27"]) expect(isWorkingDay(d), d).toBe(true);
    expect(holidayOn("2026-11-18")?.assumption).toBe(false);
    expect(holidaysOfYear(2027).size).toBe(13); // 10 fixed days + Good Friday, Easter Sunday, Easter Monday
  });

  it("the holiday file cites the law and the verified Cabinet orders", () => {
    const j = JSON.parse(readFileSync(fromRoot("src/data/holidays_lv.json"), "utf8"));
    expect(j.law.title_lv).toBe("Par svētku, atceres un atzīmējamām dienām");
    expect(j.extra_days).toEqual([]);
    expect(j.working_day_transfers.assumption).toBe(false);
    expect(j.working_day_transfers.known_orders[0].source).toContain("vestnesis.lv");
    expect(holidaysOfYear(2026).size).toBeGreaterThanOrEqual(13);
  });

  it("nextWorkingDay skips weekends and holidays", () => {
    expect(nextWorkingDay("2026-10-02")).toBe("2026-10-05"); // Fri -> Mon
    expect(nextWorkingDay("2026-11-17")).toBe("2026-11-19"); // 18 Nov
    expect(nextWorkingDay("2026-12-23")).toBe("2026-12-28");
    expect(nextWorkingDay("2027-03-25")).toBe("2027-03-30"); // Good Friday + Easter Monday
  });

  it("office open now: Mon-Fri 9-17 Riga, not on holidays", () => {
    expect(isOfficeOpen(at("2026-10-05T06:30:00Z"))).toBe(true); // 09:30 EEST
    expect(isOfficeOpen(at("2026-10-05T05:59:00Z"))).toBe(false); // 08:59
    expect(isOfficeOpen(at("2026-10-05T14:00:00Z"))).toBe(false); // 17:00
    expect(isOfficeOpen(at("2026-10-03T08:00:00Z"))).toBe(false); // Saturday
    expect(isOfficeOpen(at("2026-11-18T09:00:00Z"))).toBe(false); // holiday
    expect(officeOpenNow(at("2026-10-05T09:00:00Z"))).toBe(true);
  });
});

describe("Europe/Riga DST", () => {
  it("offset changes on 2026-10-25 (03:00 EEST -> 04:00 EEST becomes 03:00 EET)", () => {
    expect(rigaOffsetMinutes(at("2026-10-24T12:00:00Z"))).toBe(180);
    expect(rigaOffsetMinutes(at("2026-10-25T12:00:00Z"))).toBe(120);
    expect(rigaOffsetMinutes(at("2026-10-25T00:59:59Z"))).toBe(180); // 03:59:59 EEST
    expect(rigaOffsetMinutes(at("2026-10-25T01:00:00Z"))).toBe(120); // 03:00 EET
  });
  it("offset changes on 2027-03-28 (03:00 EET -> 04:00 EEST)", () => {
    expect(rigaOffsetMinutes(at("2027-03-27T12:00:00Z"))).toBe(120);
    expect(rigaOffsetMinutes(at("2027-03-28T12:00:00Z"))).toBe(180);
    expect(rigaOffsetMinutes(at("2027-03-28T00:59:59Z"))).toBe(120);
    expect(rigaOffsetMinutes(at("2027-03-28T01:00:00Z"))).toBe(180);
  });
  it("local -> UTC is exact on both sides of each change", () => {
    expect(rigaLocalToUtc("2026-10-23", "09:00").toISOString()).toBe("2026-10-23T06:00:00.000Z");
    expect(rigaLocalToUtc("2026-10-26", "09:00").toISOString()).toBe("2026-10-26T07:00:00.000Z");
    expect(rigaLocalToUtc("2027-03-25", "09:00").toISOString()).toBe("2027-03-25T07:00:00.000Z");
    expect(rigaLocalToUtc("2027-03-30", "09:00").toISOString()).toBe("2027-03-30T06:00:00.000Z");
    expect(rigaLocalToUtc("2027-03-28", "04:00").toISOString()).toBe("2027-03-28T01:00:00.000Z");
  });
  it("ISO strings carry the right offset", () => {
    expect(toRigaIso(at("2026-10-23T06:00:00Z"))).toBe("2026-10-23T09:00:00+03:00");
    expect(toRigaIso(at("2026-10-26T07:00:00Z"))).toBe("2026-10-26T09:00:00+02:00");
    expect(rigaYmd(at("2026-10-31T22:30:00Z"))).toBe("2026-11-01"); // 00:30 next day in Riga
    expect(rigaHm(at("2026-10-31T22:30:00Z"))).toBe("00:30");
  });

  it("slots across the autumn change: 23 Oct at +03:00, 26 Oct at +02:00, same wall-clock hours", () => {
    const now = at("2026-10-19T09:00:00Z"); // Monday
    const all = candidateSlots(now);
    const fri = all.filter((s) => s.date === "2026-10-23");
    const mon = all.filter((s) => s.date === "2026-10-26");
    expect(fri[0]!.start).toBe("2026-10-23T09:00:00+03:00");
    expect(mon[0]!.start).toBe("2026-10-26T09:00:00+02:00");
    expect(fri.map((s) => s.hm)).toEqual(mon.map((s) => s.hm));
    expect(Date.parse(mon[0]!.start) - Date.parse(fri[0]!.start)).toBe(73 * 3600000); // 3 days + the extra hour
    expect(all.some((s) => s.date === "2026-10-24" || s.date === "2026-10-25")).toBe(false);
  });

  it("slots across the spring change: Good Friday and Easter Monday are skipped, 30 Mar is +03:00", () => {
    const now = at("2027-03-22T08:00:00Z"); // Monday
    const all = candidateSlots(now);
    const dates = [...new Set(all.map((s) => s.date))];
    expect(dates).toContain("2027-03-25");
    expect(dates).not.toContain("2027-03-26");
    expect(dates).not.toContain("2027-03-27");
    expect(dates).not.toContain("2027-03-28");
    expect(dates).not.toContain("2027-03-29");
    expect(dates).toContain("2027-03-30");
    expect(all.find((s) => s.date === "2027-03-25" && s.hm === "09:00")!.start).toBe("2027-03-25T09:00:00+02:00");
    expect(all.find((s) => s.date === "2027-03-30" && s.hm === "09:00")!.start).toBe("2027-03-30T09:00:00+03:00");
  });

  it("a booking on the spring-change Monday after Easter is validated with the right instant", () => {
    const now = at("2027-03-22T08:00:00Z");
    const ok = checkSlot("2027-03-30T06:00:00Z", now, []); // 09:00 EEST
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.slot.start).toBe("2027-03-30T09:00:00+03:00");
    expect(checkSlot("2027-03-30T07:00:00Z", now, []).ok).toBe(true); // 10:00
  });
});

describe("slot grid", () => {
  const now = at("2026-10-03T09:00:00Z"); // Saturday
  it("earliest is the next working day; horizon is 14 days", () => {
    expect(earliestSlotDate(now)).toBe("2026-10-05");
    expect(horizonDate(now)).toBe(addDaysYmd("2026-10-03", HORIZON_DAYS));
    const all = candidateSlots(now);
    expect(all[0]!.start).toBe("2026-10-05T09:00:00+03:00");
    expect(all[all.length - 1]!.date <= "2026-10-17").toBe(true);
  });
  it("earliest slot is tomorrow even on a working morning", () => {
    expect(earliestSlotDate(at("2026-10-06T06:00:00Z"))).toBe("2026-10-07");
    expect(earliestSlotDate(at("2026-10-09T10:00:00Z"))).toBe("2026-10-12"); // Friday -> Monday
    expect(earliestSlotDate(at("2026-11-17T10:00:00Z"))).toBe("2026-11-19"); // 18 Nov
  });
  it("only Mon-Fri 09:00-16:00 starts, one hour long, never on holidays", () => {
    const all = candidateSlots(now);
    for (const s of all) {
      const wd = weekdayOfYmd(s.date);
      expect(wd >= 1 && wd <= 5).toBe(true);
      expect(Number(s.hm.slice(0, 2))).toBeGreaterThanOrEqual(9);
      expect(Number(s.hm.slice(0, 2))).toBeLessThanOrEqual(16);
      expect(Date.parse(s.end) - Date.parse(s.start)).toBe(3600000);
    }
    const dec = candidateSlots(at("2026-12-22T09:00:00Z"));
    const dates = new Set(dec.map((s) => s.date));
    for (const h of ["2026-12-24", "2026-12-25", "2026-12-26", "2026-12-31", "2027-01-01"]) expect(dates.has(h), h).toBe(false);
    expect(dates.has("2026-12-23")).toBe(true);
    expect(dates.has("2026-12-28")).toBe(true);
  });
  it("labels exist in RU and LV", () => {
    const s = candidateSlots(now)[0]!;
    expect(s.label_ru).toBe("понедельник, 5 октября, 9:00");
    expect(s.label_lv).toBe("pirmdien, 5. oktobrī, plkst. 9.00");
  });
});

describe("findSlots", () => {
  const now = at("2026-10-03T09:00:00Z");
  it("offers 3 slots spread over days and morning/afternoon", () => {
    const r = findSlots({ now, busy: [] });
    expect(r.offers).toHaveLength(3);
    expect(new Set(r.offers.map((o) => o.date)).size).toBe(3);
    expect(r.offers.map((o) => o.part)).toEqual(["morning", "afternoon", "morning"]);
    expect(r.offers[1]!.hm >= "13:00").toBe(true);
    expect(r.relaxed).toBe(false);
  });
  it("busy intervals remove slots (freeBusy, UTC strings)", () => {
    // Monday 5 Oct 09:00-10:00 EEST is busy -> first offer moves to 10:00
    const busy = [{ start: "2026-10-05T06:00:00Z", end: "2026-10-05T07:00:00Z" }];
    const r = findSlots({ now, busy });
    expect(r.offers[0]!.start).toBe("2026-10-05T10:00:00+03:00");
    const free = freeSlots(now, busy);
    expect(free.some((s) => s.start === "2026-10-05T09:00:00+03:00")).toBe(false);
    expect(free.some((s) => s.start === "2026-10-05T10:00:00+03:00")).toBe(true);
  });
  it("partially overlapping busy time blocks the slot", () => {
    const busy = [{ start: "2026-10-05T06:30:00Z", end: "2026-10-05T06:45:00Z" }]; // 09:30-09:45 local
    const free = freeSlots(now, busy);
    expect(free.some((s) => s.start === "2026-10-05T09:00:00+03:00")).toBe(false);
    expect(free.some((s) => s.start === "2026-10-05T10:00:00+03:00")).toBe(true);
  });
  it("a busy interval ending exactly at the slot start does not block it", () => {
    const busy = [{ start: "2026-10-05T05:00:00Z", end: "2026-10-05T06:00:00Z" }]; // 08:00-09:00 local
    expect(freeSlots(now, busy).some((s) => s.start === "2026-10-05T09:00:00+03:00")).toBe(true);
  });
  it("filters by weekday", () => {
    const r = findSlots({ now, busy: [], weekdays: [3] }); // Wednesday
    expect(r.offers.length).toBe(3);
    expect(r.offers.every((o) => weekdayOfYmd(o.date) === 3 || r.relaxed)).toBe(true);
    expect(r.matched).toBeGreaterThan(0);
    expect(r.offers.filter((o) => weekdayOfYmd(o.date) === 3).length).toBeGreaterThanOrEqual(2);
  });
  it("filters by date range and part of day", () => {
    const r = findSlots({ now, busy: [], dateFrom: "2026-10-08", dateTo: "2026-10-09", partOfDay: "afternoon" });
    expect(r.offers.length).toBe(3);
    expect(r.offers.every((o) => o.part === "afternoon" && o.date >= "2026-10-08" && o.date <= "2026-10-09")).toBe(true);
    expect(r.relaxed).toBe(false);
  });
  it("tops up from unfiltered slots when the filter leaves too few (relaxed)", () => {
    const r = findSlots({ now, busy: [], dateFrom: "2026-10-08", dateTo: "2026-10-08", partOfDay: "morning" });
    expect(r.matched).toBe(3); // 09, 10, 11
    expect(r.offers.length).toBe(3);
    const r2 = findSlots({ now, busy: [], dateFrom: "2026-10-10", dateTo: "2026-10-11" }); // weekend
    expect(r2.matched).toBe(0);
    expect(r2.relaxed).toBe(true);
    expect(r2.offers.length).toBe(3);
  });
  it("returns no offers when the whole window is busy", () => {
    const r = findSlots({ now, busy: [{ start: "2026-10-01T00:00:00Z", end: "2026-11-01T00:00:00Z" }] });
    expect(r.offers).toEqual([]);
    expect(r.matched).toBe(0);
  });
  it("never offers anything beyond the 14-day horizon", () => {
    const r = findSlots({ now, busy: [], dateFrom: "2026-10-19", dateTo: "2026-10-30" });
    expect(r.matched).toBe(0);
    expect(r.offers.every((o) => o.date <= "2026-10-17")).toBe(true);
  });
});

describe("checkSlot and alternatives (book_inspection)", () => {
  const now = at("2026-10-03T09:00:00Z");
  it("accepts a free grid slot", () => {
    const c = checkSlot("2026-10-05T10:00:00+03:00", now, []);
    expect(c.ok).toBe(true);
  });
  it.each([
    ["not an instant", "tomorrow"],
    ["off the hour", "2026-10-05T10:30:00+03:00"],
    ["before 09:00", "2026-10-05T08:00:00+03:00"],
    ["after the last start (17:00)", "2026-10-05T17:00:00+03:00"],
    ["Saturday", "2026-10-10T10:00:00+03:00"],
    ["holiday", "2026-11-18T10:00:00+02:00"],
    ["today / too early (not the next working day)", "2026-10-03T10:00:00+03:00"],
    ["beyond the horizon", "2026-10-26T10:00:00+02:00"],
  ])("rejects: %s", (_label, iso) => {
    expect(checkSlot(iso, now, [])).toEqual({ ok: false, reason: "invalid_slot" });
  });
  it("reports slot_taken for busy time and offers the two closest alternatives", () => {
    const busy = [{ start: "2026-10-05T07:00:00Z", end: "2026-10-05T08:00:00Z" }]; // 10:00 local
    expect(checkSlot("2026-10-05T10:00:00+03:00", now, busy)).toEqual({ ok: false, reason: "slot_taken" });
    const alts = alternativesFor("2026-10-05T10:00:00+03:00", now, busy);
    expect(alts.map((a) => a.start)).toEqual(["2026-10-05T09:00:00+03:00", "2026-10-05T11:00:00+03:00"]);
  });
});

describe("misc", () => {
  it("rigaYmd for the current test clock", () => {
    expect(rigaYmd(at("2026-10-03T21:30:00Z"))).toBe("2026-10-04");
  });
});
