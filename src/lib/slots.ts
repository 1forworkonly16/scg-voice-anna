// Inspection slots: Mon-Fri, 1-hour slots starting 09:00-16:00 Europe/Riga (a slot may start at 16:00 and ends 17:00),
// Latvian public holidays excluded, earliest = next working day (demo assumption), horizon 14 days,
// at most 3 offers spread across days and morning/afternoon. Input is the busy intervals (Google freeBusy).
import { slotLabel } from "./speech";
import {
  addDaysYmd,
  isOfficeOpen,
  isWorkingDay,
  nextWorkingDay,
  rigaLocalToUtc,
  rigaParts,
  rigaYmd,
  toRigaIso,
  weekdayOfYmd,
} from "./time";

export const SLOT_FIRST_HOUR = 9;
export const SLOT_LAST_START_HOUR = 16;
export const SLOT_MINUTES = 60;
export const HORIZON_DAYS = 14;
export const MAX_OFFERS = 3;

export type PartOfDay = "morning" | "afternoon";

export interface BusyInterval {
  start: string | Date;
  end: string | Date;
}

export interface Slot {
  /** ISO 8601 with the Riga offset, e.g. 2026-10-26T10:00:00+02:00 (this is what book_inspection receives back). */
  start: string;
  end: string;
  /** Riga calendar date and wall-clock start. */
  date: string;
  hm: string;
  part: PartOfDay;
  label_ru: string;
  label_lv: string;
  startMs: number;
}

export interface SlotFilter {
  /** 1 = Monday ... 5 = Friday. */
  weekdays?: readonly number[];
  dateFrom?: string;
  dateTo?: string;
  partOfDay?: PartOfDay;
}

export interface SlotQuery extends SlotFilter {
  now: Date;
  busy: readonly BusyInterval[];
  max?: number;
}

export interface SlotResult {
  offers: Slot[];
  /** Number of free slots that match the filter (before picking). */
  matched: number;
  /** True when the filter left fewer than `max` slots and the offers were topped up from unfiltered free slots. */
  relaxed: boolean;
}

const toMs = (v: string | Date): number => (v instanceof Date ? v.getTime() : Date.parse(v));

/** First bookable date: the next working day after today (Riga). */
export function earliestSlotDate(now: Date): string {
  return nextWorkingDay(rigaYmd(now));
}

/** Last bookable date: today + 14 days. */
export function horizonDate(now: Date): string {
  return addDaysYmd(rigaYmd(now), HORIZON_DAYS);
}

function makeSlot(date: string, hour: number): Slot {
  const hm = `${String(hour).padStart(2, "0")}:00`;
  const start = rigaLocalToUtc(date, hm);
  const end = new Date(start.getTime() + SLOT_MINUTES * 60000);
  return {
    start: toRigaIso(start),
    end: toRigaIso(end),
    date,
    hm,
    part: hour < 12 ? "morning" : "afternoon",
    label_ru: slotLabel(start, "ru"),
    label_lv: slotLabel(start, "lv"),
    startMs: start.getTime(),
  };
}

/** Every grid slot in the booking window, ignoring busy time. */
export function candidateSlots(now: Date): Slot[] {
  const out: Slot[] = [];
  const last = horizonDate(now);
  for (let d = earliestSlotDate(now); d <= last; d = addDaysYmd(d, 1)) {
    if (!isWorkingDay(d)) continue;
    for (let h = SLOT_FIRST_HOUR; h <= SLOT_LAST_START_HOUR; h++) out.push(makeSlot(d, h));
  }
  return out;
}

function overlapsBusy(s: Slot, busyMs: readonly [number, number][]): boolean {
  const end = s.startMs + SLOT_MINUTES * 60000;
  return busyMs.some(([bs, be]) => s.startMs < be && bs < end);
}

function normaliseBusy(busy: readonly BusyInterval[]): [number, number][] {
  return busy.map((b) => [toMs(b.start), toMs(b.end)] as [number, number]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
}

function matches(s: Slot, f: SlotFilter): boolean {
  if (f.weekdays && f.weekdays.length && !f.weekdays.includes(weekdayOfYmd(s.date))) return false;
  if (f.dateFrom && s.date < f.dateFrom) return false;
  if (f.dateTo && s.date > f.dateTo) return false;
  if (f.partOfDay && s.part !== f.partOfDay) return false;
  return true;
}

/** Free slots (no busy overlap) inside the window that match the filter, in time order. */
export function freeSlots(now: Date, busy: readonly BusyInterval[], filter: SlotFilter = {}): Slot[] {
  const b = normaliseBusy(busy);
  return candidateSlots(now).filter((s) => matches(s, filter) && !overlapsBusy(s, b));
}

/**
 * Pick up to `max` offers: one slot per day on the first days that have any, alternating morning / afternoon
 * (morning, afternoon, morning); if there are fewer days than offers, fill with a second slot of a used day
 * that is at least two hours away from the offers already on that day.
 */
export function pickOffers(slots: readonly Slot[], max = MAX_OFFERS, partOfDay?: PartOfDay, exclude: ReadonlySet<string> = new Set()): Slot[] {
  const pool = slots.filter((s) => !exclude.has(s.start));
  const days: string[] = [];
  for (const s of pool) if (!days.includes(s.date)) days.push(s.date);
  const seq: PartOfDay[] = partOfDay ? [partOfDay] : ["morning", "afternoon", "morning"];
  const offers: Slot[] = [];
  for (const day of days) {
    if (offers.length >= max) break;
    const want = seq[offers.length % seq.length]!;
    const list = pool.filter((s) => s.date === day);
    // afternoon offers start after the lunch hour when possible
    offers.push(list.find((s) => s.part === want && (want === "morning" || s.hm >= "13:00")) ?? list.find((s) => s.part === want) ?? list[0]!);
  }
  if (offers.length < max) {
    for (const day of days) {
      for (const s of pool.filter((x) => x.date === day)) {
        if (offers.length >= max) break;
        if (offers.some((o) => o.start === s.start)) continue;
        const farEnough = offers.filter((o) => o.date === day).every((o) => Math.abs(o.startMs - s.startMs) >= 2 * 3600000);
        if (farEnough) offers.push(s);
      }
    }
  }
  return offers.sort((a, b) => a.startMs - b.startMs);
}

/** Offers for get_slots. Tops up from unfiltered slots when the filter leaves fewer than `max` (relaxed = true). */
export function findSlots(q: SlotQuery): SlotResult {
  const max = q.max ?? MAX_OFFERS;
  const filter: SlotFilter = { weekdays: q.weekdays, dateFrom: q.dateFrom, dateTo: q.dateTo, partOfDay: q.partOfDay };
  const hasFilter = Boolean((q.weekdays && q.weekdays.length) || q.dateFrom || q.dateTo || q.partOfDay);
  const matched = freeSlots(q.now, q.busy, filter);
  let offers = pickOffers(matched, max, q.partOfDay);
  let relaxed = false;
  if (hasFilter && offers.length < max) {
    const all = freeSlots(q.now, q.busy);
    const taken = new Set(offers.map((o) => o.start));
    const extra = pickOffers(all, max - offers.length, undefined, taken);
    if (extra.length) {
      relaxed = true;
      offers = [...offers, ...extra].sort((a, b) => a.startMs - b.startMs);
    }
  }
  return { offers, matched: matched.length, relaxed };
}

export type SlotCheck =
  | { ok: true; slot: Slot }
  | { ok: false; reason: "invalid_slot" | "slot_taken" };

/** Validates the slot_start that book_inspection receives: on the grid, working day, inside the window, still free. */
export function checkSlot(startIso: string, now: Date, busy: readonly BusyInterval[]): SlotCheck {
  const ms = Date.parse(startIso);
  if (!Number.isFinite(ms)) return { ok: false, reason: "invalid_slot" };
  const d = new Date(ms);
  const p = rigaParts(d);
  if (p.minute !== 0 || p.second !== 0 || p.hour < SLOT_FIRST_HOUR || p.hour > SLOT_LAST_START_HOUR) return { ok: false, reason: "invalid_slot" };
  const date = rigaYmd(d);
  if (!isWorkingDay(date) || date < earliestSlotDate(now) || date > horizonDate(now)) return { ok: false, reason: "invalid_slot" };
  const slot = makeSlot(date, p.hour);
  if (overlapsBusy(slot, normaliseBusy(busy))) return { ok: false, reason: "slot_taken" };
  return { ok: true, slot };
}

/** The `n` free slots closest in time to `around` (default 2), in time order: alternatives for slot_taken. */
export function alternativesFor(around: Date | string, now: Date, busy: readonly BusyInterval[], n = 2): Slot[] {
  const center = toMs(around);
  const free = freeSlots(now, busy).filter((s) => s.startMs !== center);
  return free
    .sort((a, b) => Math.abs(a.startMs - center) - Math.abs(b.startMs - center) || a.startMs - b.startMs)
    .slice(0, n)
    .sort((a, b) => a.startMs - b.startMs);
}

export function officeOpenNow(now: Date): boolean {
  return isOfficeOpen(now);
}
