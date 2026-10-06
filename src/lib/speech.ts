// What Anna may SAY: price figures (rounded by code), dates, times, slot labels, building facts.
// Final sentences come from the phrase templates (src/copy/phrases.ts, see render.ts); this module only supplies values.
// Rules: monthly instalments and working-day estimates are NEVER output (they are not even exposed here).
// Russian speech (say_ru, every tool-facing label_ru) is ALWAYS finished words with the right case and gender, whatever
// NUMBER_MODE says: the *Ru functions below. The digit labels (dateLabel, dayLabel, timeLabel, slotLabel, windowLabel) are
// the text forms for Calendar / Sheet / Telegram, and the Latvian speech forms (unchanged).
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
  dayOrdinalNomRu,
  dayOrdinalRu,
  formatNumber,
  genitiveNounRu,
  hourGenitiveRu,
  numberToWords,
  numberToWordsGenRu,
  ordinalRu,
  pluralLv,
  pluralRu,
  timeAtRu,
  timeGenRu,
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

/**
 * Spoken RU bounds for «от {low} до {high} евро», in the genitive. Both bounds whole thousands (and below a million):
 * the thousands counts share one noun that agrees with the upper bound — «от семидесяти двух» / «до ста двенадцати тысяч»,
 * «до ста двадцати одной тысячи». Otherwise each bound is a full genitive number: «от восьми тысяч четырёхсот» / «до девяти тысяч ста».
 */
export function priceBoundsRu(low: number, high: number): { low: string; high: string } {
  const lo = Math.round(low);
  const hi = Math.round(high);
  if (lo > 0 && hi > 0 && lo % 1000 === 0 && hi % 1000 === 0 && lo < 1_000_000 && hi < 1_000_000) {
    const k = hi / 1000;
    return { low: numberToWordsGenRu(lo / 1000, "f"), high: `${numberToWordsGenRu(k, "f")} ${genitiveNounRu(k, "тысячи", "тысяч")}` };
  }
  return { low: numberToWordsGenRu(lo), high: numberToWordsGenRu(hi) };
}

/**
 * Values for the `price_range` phrase template. RU: always spoken words (genitive bounds, see priceBoundsRu; per apartment in the
 * nominative). LV / EN: mode digits "84000" | words | grouped "84 000".
 */
export function pricePlaceholders(f: PriceFigures, lang: Lang, mode: NumberMode = "digits"): Record<(typeof PRICE_PLACEHOLDERS)[number], string> {
  if (lang === "ru") {
    const net = priceBoundsRu(f.low_net, f.high_net);
    const gross = priceBoundsRu(f.low_gross, f.high_gross);
    return { low_net: net.low, high_net: net.high, low_gross: gross.low, high_gross: gross.high, per_apt_gross: numberToWords(Math.round(f.per_apt_gross), "ru") };
  }
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
// dateLabel / dayLabel / timeLabel / slotLabel / windowLabel: RU digit forms are TEXT only (Calendar, Sheet, Telegram);
// LV forms are the Latvian speech forms (unchanged). RU speech: see "spoken Russian" below. `words` is the old TTS fallback.

const RU_WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const RU_MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const LV_WD = ["svētdien", "pirmdien", "otrdien", "trešdien", "ceturtdien", "piektdien", "sestdien"];
const LV_MON = ["janvārī", "februārī", "martā", "aprīlī", "maijā", "jūnijā", "jūlijā", "augustā", "septembrī", "oktobrī", "novembrī", "decembrī"];
const EN_WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EN_MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** «в/во» + accusative weekday. */
const RU_WD_AT = ["в воскресенье", "в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу"];

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

// ---------- spoken Russian (say_ru and tool-facing label_ru): words only ----------

const ymdParts = (ymd: string) => ymd.split("-").map(Number) as [number, number, number];

/** «седьмого октября»; month false: «седьмого» (the month was already named). */
export function dateSpokenRu(ymd: string, opts: { month?: boolean } = {}): string {
  const [, m, d] = ymdParts(ymd);
  return opts.month === false ? dayOrdinalRu(d) : `${dayOrdinalRu(d)} ${RU_MON[m - 1]}`;
}

/** «в среду, седьмого октября» / «во вторник, шестого октября»; month false: «в четверг, восьмого». */
export function dayAtRu(ymd: string, opts: { month?: boolean } = {}): string {
  return `${RU_WD_AT[weekdayOfYmd(ymd)]}, ${dateSpokenRu(ymd, opts)}`;
}

/** Nominative, for «today»: «вторник, шестое октября». */
export function dayNameRu(ymd: string): string {
  const [, m, d] = ymdParts(ymd);
  return `${RU_WD[weekdayOfYmd(ymd)]}, ${dayOrdinalNomRu(d)} ${RU_MON[m - 1]}`;
}

/** Spoken slot: «в среду, седьмого октября, в девять утра»; month false: «в четверг, восьмого, в час дня». */
export function slotSpokenRu(start: Date, opts: { month?: boolean } = {}): string {
  return `${dayAtRu(rigaYmd(start), opts)}, ${timeAtRu(rigaHm(start))}`;
}

/** Spoken slots of ONE list (an offer): the month is named for the first slot and whenever it differs from the previous slot's. */
export function slotListRu(starts: readonly Date[]): string[] {
  let prev = "";
  return starts.map((s) => {
    const ym = rigaYmd(s).slice(0, 7);
    const label = slotSpokenRu(s, { month: ym !== prev });
    prev = ym;
    return label;
  });
}

const WINDOW_RE = /^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/;

/** Access window "09:00-13:00" -> «с девяти утра до часа дня»; "13:00-17:00" -> «с часа дня до пяти вечера». Unparsable input is returned as given. */
export function windowSpokenRu(window: string): string {
  const m = WINDOW_RE.exec(window.trim());
  if (!m) return window;
  try {
    return `с ${timeGenRu(`${m[1]}:${m[2]}`)} до ${timeGenRu(`${m[3]}:${m[4]}`)}`;
  } catch {
    return window;
  }
}

/** Apartment number as spoken after «Квартира»: a plain integer in words («двенадцать»), anything else as given. */
export function apartmentSpokenRu(apartment: number | string): string {
  const n = typeof apartment === "number" ? apartment : /^\d+$/.test(apartment.trim()) ? Number(apartment.trim()) : NaN;
  return Number.isSafeInteger(n) && n >= 0 && n <= 999_999_999 ? numberToWords(n, "ru") : String(apartment);
}

/** Stairwell as a masculine ordinal before «подъезд»: 1 -> «первый». Outside 0..999 the value is returned as given. */
export function stairwellSpokenRu(stairwell: number): string {
  return Number.isInteger(stairwell) && stairwell >= 0 && stairwell <= 999 ? ordinalRu(stairwell, "nom_m") : String(stairwell);
}

/** Label for "today" in Riga time (the agent never computes dates itself). RU spoken nominative «вторник, шестое октября»; LV / EN as dayLabel. */
export function todayLabel(now: Date, lang: Lang): string {
  const ymd = rigaYmd(now);
  return lang === "ru" ? dayNameRu(ymd) : dayLabel(ymd, lang);
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

/**
 * Built from sourced fields only; empty string if none is sourced. RU always spoken words with the noun's gender
 * («девять этажей, четыре подъезда и сто сорок одна квартира»); LV / EN follow `mode` («9 stāvi, 4 kāpņu telpas»).
 */
export function buildingFacts(b: SourcedFacts, lang: Lang, mode: NumberMode = "digits"): string {
  const parts: string[] = [];
  const num = (n: number) => formatNumber(n, lang, mode);
  const ruNum = (n: number, g: "m" | "f") => (Number.isInteger(n) && n >= 0 && n <= 999_999_999 ? numberToWords(n, "ru", g) : String(n));
  const add = (field: FactField, ru: readonly [string, string, string], ruGender: "m" | "f", lv: readonly [string, string], en: readonly [string, string]) => {
    const n = b[field];
    if (n == null || !b.sourced.includes(field)) return;
    if (lang === "lv") parts.push(`${num(n)} ${pluralLv(n, lv)}`);
    else if (lang === "en") parts.push(`${num(n)} ${n === 1 ? en[0] : en[1]}`);
    else parts.push(`${ruNum(n, ruGender)} ${pluralRu(n, ru)}`);
  };
  add("floors", ["этаж", "этажа", "этажей"], "m", ["stāvs", "stāvi"], ["floor", "floors"]);
  add("stairwells", ["подъезд", "подъезда", "подъездов"], "m", ["kāpņu telpa", "kāpņu telpas"], ["stairwell", "stairwells"]);
  add("apartments", ["квартира", "квартиры", "квартир"], "f", ["dzīvoklis", "dzīvokļi"], ["apartment", "apartments"]);
  if (parts.length <= 1) return parts.join("");
  const sep = lang === "lv" ? " un " : lang === "en" ? " and " : " и ";
  return `${parts.slice(0, -1).join(", ")}${sep}${parts[parts.length - 1]}`;
}
