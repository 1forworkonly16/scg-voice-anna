// What Anna may SAY: price figures (rounded by code), dates, times, slot labels, building facts.
// Final sentences come from the phrase templates (src/copy/phrases.ts, see render.ts); this module only supplies values.
// Rules: monthly instalments and working-day estimates are NEVER output (they are not even exposed here).
import type { ParametricQuote } from "./quote";
import {
  type Lang,
  addDaysYmd,
  rigaHm,
  rigaYmd,
  weekdayOfYmd,
} from "./time";
import {
  type NumberMode,
  dayOrdinalLv,
  dayOrdinalRu,
  formatNumber,
  hourGenitiveRu,
  pluralLv,
  pluralRu,
  timeWords,
} from "./words";

// ---------- price ----------

export interface PriceFigures {
  /** Spoken lower/upper bounds, EUR, net of VAT. */
  low_net: number;
  high_net: number;
  /** Spoken lower/upper bounds, EUR, incl. VAT 21%. */
  low_gross: number;
  high_gross: number;
  /** Indicative price per apartment, incl. VAT, rounded to the nearest 10. */
  per_apt_gross: number;
}

export const THOUSANDS_FROM = 10_000;

/** Lower bound: amounts >= 10 000 round DOWN to thousands, smaller ones to the nearest 100. */
export function roundLow(x: number): number {
  return x >= THOUSANDS_FROM ? Math.floor(x / 1000) * 1000 : Math.round(x / 100) * 100;
}

/** Upper bound: amounts >= 10 000 round UP to thousands, smaller ones to the nearest 100. */
export function roundHigh(x: number): number {
  return x >= THOUSANDS_FROM ? Math.ceil(x / 1000) * 1000 : Math.round(x / 100) * 100;
}

export function roundPerApartment(x: number): number {
  return Math.round(x / 10) * 10;
}

/** The only numbers Anna speaks for a quote. Built from the ported quote, never by the LLM. */
export function priceFigures(q: ParametricQuote): PriceFigures {
  return {
    low_net: roundLow(q.range.low.net),
    high_net: roundHigh(q.range.high.net),
    low_gross: roundLow(q.range.low.gross),
    high_gross: roundHigh(q.range.high.gross),
    per_apt_gross: roundPerApartment(q.per_apartment_gross),
  };
}

export const PRICE_PLACEHOLDERS = ["low_net", "high_net", "low_gross", "high_gross", "per_apt_gross"] as const;

/** Values for the `price_range` phrase template. mode: digits "84000" | words | grouped "84 000" (text). */
export function pricePlaceholders(f: PriceFigures, lang: Lang, mode: NumberMode = "digits"): Record<(typeof PRICE_PLACEHOLDERS)[number], string> {
  const fmt = (n: number) => formatNumber(n, lang, mode);
  return {
    low_net: fmt(f.low_net),
    high_net: fmt(f.high_net),
    low_gross: fmt(f.low_gross),
    high_gross: fmt(f.high_gross),
    per_apt_gross: fmt(f.per_apt_gross),
  };
}

// ---------- dates, times, slot labels ----------

const RU_WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const RU_MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const LV_WD = ["svētdien", "pirmdien", "otrdien", "trešdien", "ceturtdien", "piektdien", "sestdien"];
const LV_MON = ["janvārī", "februārī", "martā", "aprīlī", "maijā", "jūnijā", "jūlijā", "augustā", "septembrī", "oktobrī", "novembrī", "decembrī"];
const EN_WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EN_MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface LabelOpts {
  /** Spell day and hour out as words (TTS fallback). */
  words?: boolean;
}

/** «5 ноября» / «5. novembrī» / "5 November"; words: «пятого ноября» / «piektajā novembrī». */
export function dateLabel(ymd: string, lang: Lang, opts: LabelOpts = {}): string {
  const [, m, d] = ymd.split("-").map(Number) as [number, number, number];
  if (lang === "lv") return opts.words ? `${dayOrdinalLv(d)} ${LV_MON[m - 1]}` : `${d}. ${LV_MON[m - 1]}`;
  if (lang === "en") return `${d} ${EN_MON[m - 1]}`;
  return opts.words ? `${dayOrdinalRu(d)} ${RU_MON[m - 1]}` : `${d} ${RU_MON[m - 1]}`;
}

/** «четверг, 5 ноября» / «ceturtdien, 5. novembrī». */
export function dayLabel(ymd: string, lang: Lang, opts: LabelOpts = {}): string {
  const wd = weekdayOfYmd(ymd);
  const date = dateLabel(ymd, lang, opts);
  if (lang === "lv") return `${LV_WD[wd]}, ${date}`;
  if (lang === "en") return `${EN_WD[wd]} ${date}`;
  return `${RU_WD[wd]}, ${date}`;
}

/** «10:00» / «plkst. 10.00»; words: «десять часов» / «plkst. desmit». */
export function timeLabel(hm: string, lang: Lang, opts: LabelOpts = {}): string {
  const [h, m] = hm.split(":");
  const clean = `${Number(h)}:${m}`;
  if (lang === "lv") return opts.words ? `plkst. ${timeWords(hm, "lv")}` : `plkst. ${clean.replace(":", ".")}`;
  if (lang === "en") return `${h}:${m}`;
  return opts.words ? timeWords(hm, "ru") : clean;
}

/** «четверг, 5 ноября, 10:00» / «ceturtdien, 5. novembrī, plkst. 10.00». */
export function slotLabel(start: Date, lang: Lang, opts: LabelOpts = {}): string {
  return `${dayLabel(rigaYmd(start), lang, opts)}, ${timeLabel(rigaHm(start), lang, opts)}`;
}

/** Access window "09:00-13:00" -> «с 9:00 до 13:00» / «no plkst. 9.00 līdz 13.00»; words: «с девяти до тринадцати часов». */
export function windowLabel(window: string, lang: Lang, opts: LabelOpts = {}): string {
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(window);
  if (!m) return window;
  const [, h1, m1, h2, m2] = m as unknown as [string, string, string, string, string];
  const wholeHours = m1 === "00" && m2 === "00";
  if (lang === "lv") {
    return opts.words
      ? `no ${timeLabel(`${h1}:${m1}`, "lv", opts)} līdz ${timeLabel(`${h2}:${m2}`, "lv", opts)}`
      : `no plkst. ${Number(h1)}.${m1} līdz ${Number(h2)}.${m2}`;
  }
  if (lang === "en") return `from ${Number(h1)}:${m1} to ${Number(h2)}:${m2}`;
  if (opts.words && wholeHours) return `с ${hourGenitiveRu(Number(h1))} до ${hourGenitiveRu(Number(h2))} часов`;
  return `с ${Number(h1)}:${m1} до ${Number(h2)}:${m2}`;
}

/** Label for "today" in Riga time (the agent never computes dates itself). */
export function todayLabel(now: Date, lang: Lang): string {
  return dayLabel(rigaYmd(now), lang);
}

/** The date `n` days after today, labelled. */
export function relativeDayLabel(now: Date, n: number, lang: Lang): string {
  return dayLabel(addDaysYmd(rigaYmd(now), n), lang);
}

// ---------- building facts (only sourced fields are spoken) ----------

export type FactField = "floors" | "stairwells" | "apartments";
export interface SourcedFacts {
  floors?: number | null;
  stairwells?: number | null;
  apartments?: number | null;
  /** Which of the fields above are backed by an info/ source. Anything else is NOT spoken. */
  sourced: readonly string[];
}

/** «9 этажей, 4 подъезда» built from sourced fields only; empty string if none is sourced. */
export function buildingFacts(b: SourcedFacts, lang: Lang, mode: NumberMode = "digits"): string {
  const parts: string[] = [];
  const num = (n: number) => formatNumber(n, lang, mode);
  const add = (field: FactField, ru: readonly [string, string, string], lv: readonly [string, string], en: readonly [string, string]) => {
    const n = b[field];
    if (n == null || !b.sourced.includes(field)) return;
    if (lang === "lv") parts.push(`${num(n)} ${pluralLv(n, lv)}`);
    else if (lang === "en") parts.push(`${num(n)} ${n === 1 ? en[0] : en[1]}`);
    else parts.push(`${num(n)} ${pluralRu(n, ru)}`);
  };
  add("floors", ["этаж", "этажа", "этажей"], ["stāvs", "stāvi"], ["floor", "floors"]);
  add("stairwells", ["подъезд", "подъезда", "подъездов"], ["kāpņu telpa", "kāpņu telpas"], ["stairwell", "stairwells"]);
  add("apartments", ["квартира", "квартиры", "квартир"], ["dzīvoklis", "dzīvokļi"], ["apartment", "apartments"]);
  if (parts.length <= 1) return parts.join("");
  const sep = lang === "lv" ? " un " : lang === "en" ? " and " : " и ";
  return `${parts.slice(0, -1).join(", ")}${sep}${parts[parts.length - 1]}`;
}
