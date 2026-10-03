import { describe, expect, it } from "vitest";
import {
  ACCESS_WINDOWS, APARTMENTS_PER_DAY, apartmentSchedule, demoWorksRows, findWorksRow, rescheduleOptions, validateReschedule, workingDaysBetween, type AccessRow,
} from "../../src/lib/works";
import { isWorkingDay } from "../../src/lib/time";

// DEMO rows for the FICTIONAL «Parauga iela 7» (ДЕМО): 3 stairwells x 30 apartments, starting next Monday.
const TODAY = "2026-10-03"; // Saturday
const NOW = new Date("2026-10-03T09:00:00Z");
const works = demoWorksRows(TODAY);
const B = "demo-parauga-7";

describe("demo works rows", () => {
  it("three stairwells of 30 apartments, ДЕМО, Parauga iela 7", () => {
    expect(works).toHaveLength(3);
    expect(works.map((w) => [w.stairwell, w.apt_from, w.apt_to])).toEqual([[1, 1, 30], [2, 31, 60], [3, 61, 90]]);
    expect(works.every((w) => w.address_lv === "Parauga iela 7, Rīga" && w.status === "ДЕМО")).toBe(true);
    expect(APARTMENTS_PER_DAY).toBe(5);
  });
  it("starts on the next Monday; stairwells follow each other on working days", () => {
    expect(works[0]!.start_date).toBe("2026-10-05");
    for (const w of works) {
      expect(isWorkingDay(w.start_date)).toBe(true);
      expect(isWorkingDay(w.end_date)).toBe(true);
      expect(w.end_date >= w.start_date).toBe(true);
    }
    expect(works[1]!.start_date > works[0]!.end_date).toBe(true);
    expect(works[2]!.start_date > works[1]!.end_date).toBe(true);
  });
});

describe("apartmentSchedule", () => {
  it("finds the stairwell by apartment range", () => {
    expect(findWorksRow(works, B, 1)?.stairwell).toBe(1);
    expect(findWorksRow(works, B, 30)?.stairwell).toBe(1);
    expect(findWorksRow(works, B, 31)?.stairwell).toBe(2);
    expect(findWorksRow(works, B, 90)?.stairwell).toBe(3);
    expect(findWorksRow(works, B, 91)).toBeUndefined();
    expect(findWorksRow(works, "other", 5)).toBeUndefined();
    expect(apartmentSchedule(works, [], B, 200)).toBeNull();
  });
  it("5 apartments a day on consecutive working days", () => {
    expect(apartmentSchedule(works, [], B, 1)!.planned_date).toBe("2026-10-05");
    expect(apartmentSchedule(works, [], B, 5)!.planned_date).toBe("2026-10-05");
    expect(apartmentSchedule(works, [], B, 6)!.planned_date).toBe("2026-10-06");
    expect(apartmentSchedule(works, [], B, 26)!.planned_date).toBe("2026-10-12"); // 6th working day, across the weekend
    const s = apartmentSchedule(works, [], B, 7)!;
    expect(s.stairwell).toBe(1);
    expect(s.current_date).toBe(s.planned_date);
    expect(s.current_window).toBe("09:00-17:00");
    expect(s.rescheduled).toBe(false);
  });
  it("the latest Access row for that apartment overrides date and window", () => {
    const access: AccessRow[] = [
      { building_id: B, apartment: 7, new_date: "2026-10-08", new_window: "09:00-13:00", created_at: "2026-10-04T10:00:00Z" },
      { building_id: B, apartment: 7, new_date: "2026-10-09", new_window: "13:00-17:00", created_at: "2026-10-04T11:00:00Z" },
      { building_id: B, apartment: 8, new_date: "2026-10-07", new_window: "09:00-13:00", created_at: "2026-10-04T12:00:00Z" },
    ];
    const s = apartmentSchedule(works, access, B, 7)!;
    expect(s.planned_date).toBe("2026-10-06");
    expect(s.current_date).toBe("2026-10-09");
    expect(s.current_window).toBe("13:00-17:00");
    expect(s.rescheduled).toBe(true);
    expect(apartmentSchedule(works, access, B, 9)!.rescheduled).toBe(false);
  });
});

describe("reschedule options and validation", () => {
  const s = apartmentSchedule(works, [], B, 12)!; // 3rd working day of stairwell 1: Wed 7 Oct
  it("at most 3 options, working days inside the works window, never the current date", () => {
    expect(s.current_date).toBe("2026-10-07");
    const opts = rescheduleOptions(s, NOW);
    expect(opts).toHaveLength(3);
    const days = workingDaysBetween(s.row.start_date, s.row.end_date);
    for (const o of opts) {
      expect(days).toContain(o.date);
      expect(isWorkingDay(o.date)).toBe(true);
      expect(o.date).not.toBe(s.current_date);
      expect((ACCESS_WINDOWS as readonly string[]).includes(o.window)).toBe(true);
    }
    expect(new Set(opts.map((o) => `${o.date}|${o.window}`)).size).toBe(3);
  });
  it("nearest days to the current date come first", () => {
    const dates = rescheduleOptions(s, NOW).map((o) => o.date);
    expect(dates).toContain("2026-10-06");
    expect(dates).toContain("2026-10-08");
  });
  it("never offers days before tomorrow", () => {
    const opts = rescheduleOptions(s, new Date("2026-10-07T09:00:00Z"));
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((o) => o.date >= "2026-10-08")).toBe(true);
  });
  it("returns fewer options when little of the works window is left", () => {
    const last = apartmentSchedule(works, [], B, 30)!;
    const opts = rescheduleOptions(last, new Date(`${last.row.end_date}T06:00:00Z`));
    expect(opts).toEqual([]);
  });
  it.each([
    ["ok", "2026-10-08", "09:00-13:00", null],
    ["window not offered", "2026-10-08", "10:00-12:00", "window_not_offered"],
    ["weekend", "2026-10-10", "09:00-13:00", "not_a_working_day"],
    ["not after today", "2026-10-02", "09:00-13:00", "date_in_past_or_today"],
    ["outside works", "2026-11-02", "09:00-13:00", "outside_works_period"],
  ])("validateReschedule: %s", (_label, date, window, err) => {
    expect(validateReschedule(s, date, window, NOW)).toBe(err);
  });
  it("same as current is rejected", () => {
    expect(validateReschedule(s, s.current_date, s.current_window, NOW)).toBe("same_as_current");
  });
});
