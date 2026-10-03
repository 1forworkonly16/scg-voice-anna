// Pure logic behind find_works_schedule / reschedule_access, over Works and Access rows (Google Sheet tabs).
// ALL works data in the demo is fictional (building «Parauga iela 7», labelled ДЕМО). Nothing here invents real works.
import model from "../data/price_model.json";
import {
  addDaysYmd,
  diffDays,
  isWorkingDay,
  mondayOnOrAfter,
  nextWorkingDay,
  rigaYmd,
} from "./time";

/** Offered access windows (demo assumption). A Works row may carry a wider daily window, e.g. "09:00-17:00". */
export const ACCESS_WINDOWS = ["09:00-13:00", "13:00-17:00"] as const;
export const MAX_RESCHEDULE_OPTIONS = 3;

/** Apartments per crew-day x crews (2.5 x 2 = 5), from info/data/price_model.json. */
export const APARTMENTS_PER_DAY: number = model.parametric.schedule.bathrooms_per_crew_day * model.parametric.schedule.default_crews;

export interface WorksRow {
  building_id: string;
  address_lv: string;
  stairwell: number;
  apt_from: number;
  apt_to: number;
  /** YYYY-MM-DD, first working day of works in this stairwell. */
  start_date: string;
  end_date: string;
  apts_per_day: number;
  /** Daily access window, e.g. "09:00-17:00". */
  window: string;
  foreman_label?: string;
  status?: string;
}

export interface AccessRow {
  building_id: string;
  apartment: number;
  new_date: string;
  new_window: string;
  created_at?: string;
}

/** n-th working day (0-based) counting from `start` (start itself counts when it is a working day). */
export function nthWorkingDay(start: string, n: number): string {
  let d = isWorkingDay(start) ? start : nextWorkingDay(start);
  for (let i = 0; i < n; i++) d = nextWorkingDay(d);
  return d;
}

export function workingDaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysYmd(d, 1)) if (isWorkingDay(d)) out.push(d);
  return out;
}

export interface ApartmentSchedule {
  row: WorksRow;
  stairwell: number;
  planned_date: string;
  planned_window: string;
  /** After any reschedule. */
  current_date: string;
  current_window: string;
  rescheduled: boolean;
}

export function findWorksRow(works: readonly WorksRow[], buildingId: string, apartment: number): WorksRow | undefined {
  return works.find((w) => w.building_id === buildingId && apartment >= w.apt_from && apartment <= w.apt_to);
}

export function apartmentSchedule(works: readonly WorksRow[], access: readonly AccessRow[], buildingId: string, apartment: number): ApartmentSchedule | null {
  const row = findWorksRow(works, buildingId, apartment);
  if (!row) return null;
  const perDay = row.apts_per_day > 0 ? row.apts_per_day : APARTMENTS_PER_DAY;
  const planned = nthWorkingDay(row.start_date, Math.floor((apartment - row.apt_from) / perDay));
  const overrides = access
    .filter((a) => a.building_id === buildingId && Number(a.apartment) === apartment)
    .sort((x, y) => String(x.created_at ?? "").localeCompare(String(y.created_at ?? "")));
  const last = overrides[overrides.length - 1];
  return {
    row,
    stairwell: row.stairwell,
    planned_date: planned,
    planned_window: row.window,
    current_date: last ? last.new_date : planned,
    current_window: last ? last.new_window : row.window,
    rescheduled: Boolean(last),
  };
}

export interface RescheduleOption {
  date: string;
  window: string;
}

/**
 * Up to 3 alternatives: working days inside the stairwell's works window, from tomorrow on, never the current date.
 * Days nearest to the current date come first; morning and afternoon windows alternate.
 */
export function rescheduleOptions(s: ApartmentSchedule, now: Date, max = MAX_RESCHEDULE_OPTIONS): RescheduleOption[] {
  const tomorrow = nextWorkingDay(rigaYmd(now));
  const from = tomorrow > s.row.start_date ? tomorrow : s.row.start_date;
  const days = workingDaysBetween(from, s.row.end_date)
    .filter((d) => d !== s.current_date)
    .sort((a, b) => Math.abs(diffDays(s.current_date, a)) - Math.abs(diffDays(s.current_date, b)) || (a < b ? -1 : 1));
  const out: RescheduleOption[] = [];
  for (const d of days) {
    if (out.length >= max) break;
    out.push({ date: d, window: ACCESS_WINDOWS[out.length % ACCESS_WINDOWS.length]! });
  }
  // fewer days than options: offer the other window of the days already used
  for (const d of days) {
    if (out.length >= max) break;
    for (const w of ACCESS_WINDOWS) {
      if (out.length < max && !out.some((o) => o.date === d && o.window === w)) out.push({ date: d, window: w });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? (a.window < b.window ? -1 : 1) : a.date < b.date ? -1 : 1));
}

export type RescheduleError =
  | "window_not_offered"
  | "not_a_working_day"
  | "date_in_past_or_today"
  | "outside_works_period"
  | "same_as_current";

export function validateReschedule(s: ApartmentSchedule, date: string, window: string, now: Date): RescheduleError | null {
  const windows: readonly string[] = [...ACCESS_WINDOWS, s.row.window];
  if (!windows.includes(window)) return "window_not_offered";
  if (!isWorkingDay(date)) return "not_a_working_day";
  if (date <= rigaYmd(now)) return "date_in_past_or_today";
  if (date < s.row.start_date || date > s.row.end_date) return "outside_works_period";
  if (date === s.current_date && window === s.current_window) return "same_as_current";
  return null;
}

/**
 * DEMO works plan relative to `today` for the FICTIONAL building «Parauga iela 7» (ДЕМО): three stairwells of 30 apartments,
 * the first starting on the next Monday, each followed by the next, 5 apartments a day plus two buffer days.
 * Written to the Works tab by the admin reset route and rolled forward by the daily cron.
 */
export function demoWorksRows(today: string, buildingId = "demo-parauga-7"): WorksRow[] {
  const rows: WorksRow[] = [];
  let start = mondayOnOrAfter(addDaysYmd(today, 1));
  const perStairwell = 30;
  const days = Math.ceil(perStairwell / APARTMENTS_PER_DAY);
  for (let i = 0; i < 3; i++) {
    const end = nthWorkingDay(start, days - 1 + 2);
    rows.push({
      building_id: buildingId,
      address_lv: "Parauga iela 7, Rīga",
      stairwell: i + 1,
      apt_from: i * perStairwell + 1,
      apt_to: (i + 1) * perStairwell,
      start_date: start,
      end_date: end,
      apts_per_day: APARTMENTS_PER_DAY,
      window: "09:00-17:00",
      foreman_label: "Прораб (ДЕМО)",
      status: "ДЕМО",
    });
    start = nextWorkingDay(end);
  }
  return rows;
}
