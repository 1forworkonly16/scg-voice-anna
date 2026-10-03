// Europe/Riga calendar helpers. Intl only (no tz library). Dates are "YYYY-MM-DD" strings (calendar days).
import holidayData from "../data/holidays_lv.json";

export const TZ = "Europe/Riga";
export const OFFICE = { openHour: 9, closeHour: 17 } as const;

export type Lang = "ru" | "lv" | "en";

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export interface RigaParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function rigaParts(d: Date): RigaParts {
  const p: Record<string, string> = {};
  for (const x of partsFmt.formatToParts(d)) p[x.type] = x.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Riga UTC offset in minutes at the given instant (120 winter, 180 summer). */
export function rigaOffsetMinutes(d: Date): number {
  const p = rigaParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function rigaYmd(d: Date): string {
  const p = rigaParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function rigaHm(d: Date): string {
  const p = rigaParts(d);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Riga wall-clock date + time to UTC instant. Handles both DST changes. */
export function rigaLocalToUtc(ymd: string, hm: string): Date {
  const [y, mo, da] = ymd.split("-").map(Number) as [number, number, number];
  const [h, mi] = hm.split(":").map(Number) as [number, number];
  const wall = Date.UTC(y, mo - 1, da, h, mi);
  let guess = wall - rigaOffsetMinutes(new Date(wall)) * 60000;
  guess = wall - rigaOffsetMinutes(new Date(guess)) * 60000;
  return new Date(guess);
}

/** ISO 8601 with the Riga offset, e.g. 2026-11-05T10:00:00+02:00. */
export function toRigaIso(d: Date): string {
  const p = rigaParts(d);
  const off = rigaOffsetMinutes(d);
  const sign = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

export function isYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function diffDays(a: string, b: string): number {
  const f = (s: string) => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((f(b) - f(a)) / 86400000);
}

// ---------- holidays ----------

/** Easter Sunday (Gregorian), Meeus/Jones/Butcher algorithm. Returns "YYYY-MM-DD". */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export interface Holiday {
  date: string;
  name_lv: string;
  name_ru: string;
  source: string;
  assumption: boolean;
}

const holidayCache = new Map<number, Map<string, Holiday>>();

export function holidaysOfYear(year: number): Map<string, Holiday> {
  const hit = holidayCache.get(year);
  if (hit) return hit;
  const out = new Map<string, Holiday>();
  for (const h of holidayData.fixed) {
    const date = `${year}-${h.md}`;
    out.set(date, { date, name_lv: h.name_lv, name_ru: h.name_ru, source: h.source, assumption: false });
  }
  const easter = easterSunday(year);
  for (const h of holidayData.easter_based) {
    const date = addDaysYmd(easter, h.offset);
    out.set(date, { date, name_lv: h.name_lv, name_ru: h.name_ru, source: h.source, assumption: false });
  }
  for (const h of holidayData.extra_days) {
    if (h.date.startsWith(`${year}-`)) {
      out.set(h.date, { date: h.date, name_lv: h.name_lv, name_ru: h.name_ru, source: h.source, assumption: Boolean(h.assumption) });
    }
  }
  holidayCache.set(year, out);
  return out;
}

export function holidayOn(ymd: string): Holiday | undefined {
  return holidaysOfYear(Number(ymd.slice(0, 4))).get(ymd);
}

export function isWorkingDay(ymd: string): boolean {
  const wd = weekdayOfYmd(ymd);
  return wd >= 1 && wd <= 5 && !holidayOn(ymd);
}

/** First working day strictly after the given date. */
export function nextWorkingDay(ymd: string): string {
  let d = addDaysYmd(ymd, 1);
  while (!isWorkingDay(d)) d = addDaysYmd(d, 1);
  return d;
}

/** Office open now (Mon-Fri 9:00-17:00 Riga, not a holiday)? */
export function isOfficeOpen(d: Date): boolean {
  if (!isWorkingDay(rigaYmd(d))) return false;
  const p = rigaParts(d);
  return p.hour >= OFFICE.openHour && p.hour < OFFICE.closeHour;
}

/** Monday on or after the given date. */
export function mondayOnOrAfter(ymd: string): string {
  let d = ymd;
  while (weekdayOfYmd(d) !== 1) d = addDaysYmd(d, 1);
  return d;
}
