// Number, date and time words in Russian and Latvian. Russian speech always uses words with the right case and gender
// (genitive cardinals, ordinals, clock times below); Latvian speech follows NUMBER_MODE (digits by default). Pure functions, no I/O.
import type { Lang } from "./time";

export type WordLang = "ru" | "lv";
export type Gender = "m" | "f";

const RU_UNITS_M = ["ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const RU_UNITS_F = ["ноль", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const RU_TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const RU_TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const RU_HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

const LV_UNITS_M = ["nulle", "viens", "divi", "trīs", "četri", "pieci", "seši", "septiņi", "astoņi", "deviņi"];
const LV_UNITS_F = ["nulle", "viena", "divas", "trīs", "četras", "piecas", "sešas", "septiņas", "astoņas", "deviņas"];
const LV_TEENS = ["desmit", "vienpadsmit", "divpadsmit", "trīspadsmit", "četrpadsmit", "piecpadsmit", "sešpadsmit", "septiņpadsmit", "astoņpadsmit", "deviņpadsmit"];
const LV_TENS = ["", "", "divdesmit", "trīsdesmit", "četrdesmit", "piecdesmit", "sešdesmit", "septiņdesmit", "astoņdesmit", "deviņdesmit"];

/** Russian plural form: [1 тысяча, 2 тысячи, 5 тысяч]. */
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a >= 11 && a <= 14) return forms[2];
  if (b === 1) return forms[0];
  if (b >= 2 && b <= 4) return forms[1];
  return forms[2];
}

/** Latvian plural: singular for numbers ending in 1 (except 11), plural otherwise (and for 0). */
export function pluralLv(n: number, forms: readonly [string, string]): string {
  const a = Math.abs(n) % 100;
  return a % 10 === 1 && a !== 11 ? forms[0] : forms[1];
}

function ruBelow1000(n: number, g: Gender): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) out.push(RU_HUNDREDS[h]!);
  if (rest >= 10 && rest < 20) out.push(RU_TEENS[rest - 10]!);
  else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    if (t >= 2) out.push(RU_TENS[t]!);
    if (u) out.push((g === "f" ? RU_UNITS_F : RU_UNITS_M)[u]!);
  }
  return out;
}

function lvBelow1000(n: number, g: Gender): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h === 1) out.push("simts");
  else if (h > 1) out.push(LV_UNITS_M[h]!, "simti");
  if (rest >= 10 && rest < 20) out.push(LV_TEENS[rest - 10]!);
  else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    if (t >= 2) out.push(LV_TENS[t]!);
    if (u) out.push((g === "f" ? LV_UNITS_F : LV_UNITS_M)[u]!);
  }
  return out;
}

/** Integer 0 .. 999 999 999 as words. `gender` applies to the units place of the final group (apartments = f). */
export function numberToWords(n: number, lang: WordLang, gender: Gender = "m"): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999) throw new RangeError(`numberToWords: unsupported ${n}`);
  if (n === 0) return lang === "ru" ? "ноль" : "nulle";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor(n / 1000) % 1000;
  const rest = n % 1000;
  const out: string[] = [];
  if (lang === "ru") {
    if (millions) out.push(...ruBelow1000(millions, "m"), pluralRu(millions, ["миллион", "миллиона", "миллионов"]));
    if (thousands) out.push(...ruBelow1000(thousands, "f"), pluralRu(thousands, ["тысяча", "тысячи", "тысяч"]));
    if (rest) out.push(...ruBelow1000(rest, gender));
  } else {
    if (millions) out.push(...lvBelow1000(millions, "m"), pluralLv(millions, ["miljons", "miljoni"]));
    if (thousands === 1) out.push("tūkstotis");
    else if (thousands) out.push(...lvBelow1000(thousands, "m"), pluralLv(thousands, ["tūkstotis", "tūkstoši"]));
    if (rest) out.push(...lvBelow1000(rest, gender));
  }
  return out.join(" ");
}

export type NumberMode = "digits" | "words" | "grouped";

/** digits = "84000" (TTS-safe), grouped = "84 000" with NBSP (text channels), words = full words. */
export function formatNumber(n: number, lang: Lang, mode: NumberMode = "digits", gender: Gender = "m"): string {
  const v = Math.round(n);
  if (mode === "words" && lang !== "en") return numberToWords(v, lang, gender);
  if (mode === "grouped") return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return String(v);
}

// ---------- Russian genitive cardinals (spoken RU always uses words, see the *Ru functions in speech.ts) ----------
const RU_GEN_UNITS_M = ["нуля", "одного", "двух", "трёх", "четырёх", "пяти", "шести", "семи", "восьми", "девяти"];
const RU_GEN_UNITS_F = ["нуля", "одной", "двух", "трёх", "четырёх", "пяти", "шести", "семи", "восьми", "девяти"];
const RU_GEN_TEENS = ["десяти", "одиннадцати", "двенадцати", "тринадцати", "четырнадцати", "пятнадцати", "шестнадцати", "семнадцати", "восемнадцати", "девятнадцати"];
const RU_GEN_TENS = ["", "", "двадцати", "тридцати", "сорока", "пятидесяти", "шестидесяти", "семидесяти", "восьмидесяти", "девяноста"];
const RU_GEN_HUNDREDS = ["", "ста", "двухсот", "трёхсот", "четырёхсот", "пятисот", "шестисот", "семисот", "восьмисот", "девятисот"];

function ruBelow1000Gen(n: number, g: Gender): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) out.push(RU_GEN_HUNDREDS[h]!);
  if (rest >= 10 && rest < 20) out.push(RU_GEN_TEENS[rest - 10]!);
  else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    if (t >= 2) out.push(RU_GEN_TENS[t]!);
    if (u) out.push((g === "f" ? RU_GEN_UNITS_F : RU_GEN_UNITS_M)[u]!);
  }
  return out;
}

/** Noun after a numeral in the genitive: singular after ...1 (not ...11), plural otherwise («одной тысячи», «двух тысяч», «одиннадцати тысяч»). */
export function genitiveNounRu(n: number, singular: string, plural: string): string {
  const a = Math.abs(n) % 100;
  return a % 10 === 1 && a !== 11 ? singular : plural;
}

/** Genitive cardinal 0 .. 999 999 999: 72 -> «семидесяти двух», 8400 -> «восьми тысяч четырёхсот», 121 (f) -> «ста двадцати одной». */
export function numberToWordsGenRu(n: number, gender: Gender = "m"): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999) throw new RangeError(`numberToWordsGenRu: unsupported ${n}`);
  if (n === 0) return "нуля";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor(n / 1000) % 1000;
  const rest = n % 1000;
  const out: string[] = [];
  if (millions) out.push(...ruBelow1000Gen(millions, "m"), genitiveNounRu(millions, "миллиона", "миллионов"));
  if (thousands) out.push(...ruBelow1000Gen(thousands, "f"), genitiveNounRu(thousands, "тысячи", "тысяч"));
  if (rest) out.push(...ruBelow1000Gen(rest, gender));
  return out.join(" ");
}

// ---------- Russian ordinals ----------
/** nom_m «первый» (подъезд), nom_n «первое» (число месяца), gen «первого» (masculine / neuter genitive: «первого октября»). */
export type OrdinalFormRu = "nom_m" | "nom_n" | "gen";
type OrdStem = readonly [stem: string, kind: "hard" | "stressed" | "soft"];
const ORD_END = {
  hard: { nom_m: "ый", nom_n: "ое", gen: "ого" },
  stressed: { nom_m: "ой", nom_n: "ое", gen: "ого" },
  soft: { nom_m: "ий", nom_n: "ье", gen: "ьего" },
} as const;
const ORD_UNITS: readonly OrdStem[] = [
  ["нулев", "stressed"], ["перв", "hard"], ["втор", "stressed"], ["трет", "soft"], ["четвёрт", "hard"],
  ["пят", "hard"], ["шест", "stressed"], ["седьм", "stressed"], ["восьм", "stressed"], ["девят", "hard"],
];
const ORD_TEENS = ["десят", "одиннадцат", "двенадцат", "тринадцат", "четырнадцат", "пятнадцат", "шестнадцат", "семнадцат", "восемнадцат", "девятнадцат"];
const ORD_TENS: readonly OrdStem[] = [
  ["", "hard"], ["", "hard"], ["двадцат", "hard"], ["тридцат", "hard"], ["сороков", "stressed"],
  ["пятидесят", "hard"], ["шестидесят", "hard"], ["семидесят", "hard"], ["восьмидесят", "hard"], ["девяност", "hard"],
];
const ORD_HUNDREDS = ["", "сот", "двухсот", "трёхсот", "четырёхсот", "пятисот", "шестисот", "семисот", "восьмисот", "девятисот"];

const ord = ([stem, kind]: OrdStem, form: OrdinalFormRu): string => stem + ORD_END[kind][form];

/** Ordinal 0..999; only the last word is ordinal: 21 -> «двадцать первый» / «двадцать первое» / «двадцать первого». */
export function ordinalRu(n: number, form: OrdinalFormRu): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) throw new RangeError(`ordinalRu: unsupported ${n}`);
  if (n === 0) return ord(ORD_UNITS[0]!, form);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (rest === 0) return ord([ORD_HUNDREDS[h]!, "hard"], form);
  const head = h ? [RU_HUNDREDS[h]!] : [];
  if (rest < 10) return [...head, ord(ORD_UNITS[rest]!, form)].join(" ");
  if (rest < 20) return [...head, ord([ORD_TEENS[rest - 10]!, "hard"], form)].join(" ");
  const t = Math.floor(rest / 10);
  const u = rest % 10;
  if (!u) return [...head, ord(ORD_TENS[t]!, form)].join(" ");
  return [...head, RU_TENS[t]!, ord(ORD_UNITS[u]!, form)].join(" ");
}

// ---------- ordinals for dates ----------
const LV_UNIT_ORD_LOC = ["", "pirmajā", "otrajā", "trešajā", "ceturtajā", "piektajā", "sestajā", "septītajā", "astotajā", "devītajā"];

function checkDay(day: number): void {
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new RangeError(`day ${day}`);
}

/** "5" -> "пятого" (genitive, for «пятого ноября»). Days 1..31. */
export function dayOrdinalRu(day: number): string {
  checkDay(day);
  return ordinalRu(day, "gen");
}

/** "6" -> "шестое" (nominative neuter, for «шестое октября»). Days 1..31. */
export function dayOrdinalNomRu(day: number): string {
  checkDay(day);
  return ordinalRu(day, "nom_n");
}

/** "5" -> "piektajā" (locative, for «5. novembrī»). Days 1..31. */
export function dayOrdinalLv(day: number): string {
  if (day < 1 || day > 31) throw new RangeError(`day ${day}`);
  if (day < 10) return LV_UNIT_ORD_LOC[day]!;
  if (day < 20) return `${LV_TEENS[day - 10]}ajā`;
  if (day % 10 === 0) return `${LV_TENS[day / 10]}ajā`;
  return `${LV_TENS[Math.floor(day / 10)]} ${LV_UNIT_ORD_LOC[day % 10]}`;
}

// ---------- hours ----------
const RU_HOUR_GEN = [
  "ноля", "часа", "двух", "трёх", "четырёх", "пяти", "шести", "семи", "восьми", "девяти", "десяти", "одиннадцати", "двенадцати",
  "тринадцати", "четырнадцати", "пятнадцати", "шестнадцати", "семнадцати", "восемнадцати", "девятнадцати", "двадцати", "двадцати одного", "двадцати двух", "двадцати трёх",
];

/** Hour (0..23) as spoken in "в десять часов"-style phrases. */
export function hourWords(h: number, lang: WordLang): string {
  if (lang === "ru") return h === 1 ? "час" : `${numberToWords(h, "ru")} ${pluralRu(h, ["час", "часа", "часов"])}`;
  return numberToWords(h, "lv");
}

/** "10:00" -> "десять часов"; "10:30" -> "десять тридцать"; "9:05" -> "девять ноль пять". LV: "desmit", "desmit trīsdesmit". */
export function timeWords(hm: string, lang: WordLang): string {
  const [hs, ms] = hm.split(":");
  const h = Number(hs);
  const m = Number(ms);
  if (lang === "ru") {
    if (m === 0) return hourWords(h, "ru");
    return `${numberToWords(h, "ru")} ${m < 10 ? "ноль " : ""}${numberToWords(m, "ru")}`;
  }
  if (m === 0) return numberToWords(h, "lv");
  return `${numberToWords(h, "lv")} ${m < 10 ? "nulle " : ""}${numberToWords(m, "lv")}`;
}

/** Genitive hour for «с девяти до тринадцати»; only whole hours (minutes fall back to the caller's digits). */
export function hourGenitiveRu(h: number): string {
  if (h < 0 || h > 23) throw new RangeError(`hour ${h}`);
  return h === 1 ? "часа" : RU_HOUR_GEN[h]!;
}

// ---------- Russian clock times for speech («в девять утра», «с часа дня до пяти вечера») ----------
// Whole hours use the 12-hour spoken style with the part of the day; other times use the 24-hour reading («в девять тридцать»).

/** Part of the day for a whole hour: 1-3 ночи, 4-11 утра, 12-16 дня, 17-23 вечера. */
function partOfDayRu(h: number): string {
  return h < 4 ? "ночи" : h < 12 ? "утра" : h < 17 ? "дня" : "вечера";
}

/** Whole hour 0..24: «девять утра», «двенадцать часов дня», «час дня», «два часа дня», «пять вечера»; gen: «девяти утра», «часа дня», «двух часов дня». 0 / 24 = полночь. */
function hourOfDayRu(h: number, gen: boolean): string {
  if (!Number.isInteger(h) || h < 0 || h > 24) throw new RangeError(`hour ${h}`);
  if (h === 0 || h === 24) return gen ? "полуночи" : "полночь";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  let core: string;
  if (h12 === 1) core = gen ? "часа" : "час";
  else if (h12 <= 4) core = gen ? `${numberToWordsGenRu(h12)} часов` : `${numberToWords(h12, "ru")} часа`;
  else if (h12 === 12) core = gen ? "двенадцати часов" : "двенадцать часов";
  else core = gen ? numberToWordsGenRu(h12) : numberToWords(h12, "ru");
  return `${core} ${partOfDayRu(h)}`;
}

/** "HH:MM" / "H:MM" / "H.MM" -> [hour, minute]; 24:00 is allowed (end of day). */
function parseClock(hm: string): [number, number] {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(hm.trim());
  if (!m) throw new RangeError(`time ${hm}`);
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59 || (h === 24 && mi !== 0)) throw new RangeError(`time ${hm}`);
  return [h, mi];
}

function clockRu(hm: string, gen: boolean): string {
  const [h, m] = parseClock(hm);
  if (m === 0) return hourOfDayRu(h, gen);
  const hw = h === 1 ? (gen ? "часа" : "час") : gen ? numberToWordsGenRu(h) : numberToWords(h, "ru");
  const mw = gen ? numberToWordsGenRu(m, "f") : numberToWords(m, "ru", "f"); // минута: feminine
  return `${hw} ${m < 10 ? "ноль " : ""}${mw}`;
}

/** «в девять утра», «в двенадцать часов дня», «в час дня», «в два часа дня», «в пять вечера»; not a whole hour: «в девять тридцать». */
export function timeAtRu(hm: string): string {
  return `в ${clockRu(hm, false)}`;
}

/** Genitive for «с … до …»: «девяти утра», «часа дня» (never «часу»), «двух часов дня», «пяти вечера», «девяти тридцати». */
export function timeGenRu(hm: string): string {
  return clockRu(hm, true);
}
