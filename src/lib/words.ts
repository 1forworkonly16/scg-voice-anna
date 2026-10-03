// Number, date and time words in Russian and Latvian for the TTS fallback (the spike decides whether digits
// or words are used for speech). Pure functions, no I/O.
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

// ---------- ordinals for dates ----------
const RU_DAY_GEN = [
  "", "первого", "второго", "третьего", "четвёртого", "пятого", "шестого", "седьмого", "восьмого", "девятого", "десятого",
  "одиннадцатого", "двенадцатого", "тринадцатого", "четырнадцатого", "пятнадцатого", "шестнадцатого", "семнадцатого", "восемнадцатого", "девятнадцатого",
  "двадцатого",
];
const LV_UNIT_ORD_LOC = ["", "pirmajā", "otrajā", "trešajā", "ceturtajā", "piektajā", "sestajā", "septītajā", "astotajā", "devītajā"];

/** "5" -> "пятого" (genitive, for «5 ноября»). Days 1..31. */
export function dayOrdinalRu(day: number): string {
  if (day < 1 || day > 31) throw new RangeError(`day ${day}`);
  if (day <= 20) return RU_DAY_GEN[day]!;
  if (day === 30) return "тридцатого";
  const tens = day < 30 ? "двадцать" : "тридцать";
  return `${tens} ${RU_DAY_GEN[day % 10]}`;
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
