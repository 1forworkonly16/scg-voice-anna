// Russian spoken form of Latvian street addresses, for say_ru only (Worker var RU_STREET_SPOKEN=cyrillic). Pure functions, no I/O.
//   «Ilūkstes iela 16» -> «улица Илукстес, дом шестнадцать»      «Tirzas iela 3 k-2» -> «улица Тирзас, дом три, корпус два»
// The Latin address stays everywhere else: say_lv, Sheet rows, Calendar, Telegram and the structured fields of the tool answers.
// Streets of src/data/riga_buildings_search.json (+ the demo «Parauga iela») come from the reviewed map STREET_RU; any other street is
// transliterated letter by letter (transliterateLvRu, same convention). House and korpuss numbers are words (words.ts), nominative.
import { numberToWords } from "./words";

export type StreetSpoken = "latin" | "cyrillic";

/** Worker var RU_STREET_SPOKEN: only the word «cyrillic» (any case) switches it on; unset, empty or anything else keeps the Latin address. */
export function streetSpokenMode(v: unknown): StreetSpoken {
  return typeof v === "string" && v.trim().toLowerCase() === "cyrillic" ? "cyrillic" : "latin";
}

/**
 * Reviewed Russian spoken form of every street in the building list: key = `street_lv` exactly as in riga_buildings_search.json.
 * Convention: the Latvian genitive name is kept as is («Илукстес»), no stress marks; «улица / проспект / бульвар» before the name,
 * «гатве» after it (as people say it: «Юрмалас гатве»). ķ, ģ -> к, г; ļ, ņ -> ль, нь; j + vowel -> я, ю, е; ai, ei, ui, oi -> ай, ей, уй, ой.
 */
export const STREET_RU: Readonly<Record<string, string>> = {
  "Ilūkstes iela": "улица Илукстес",
  "Tirzas iela": "улица Тирзас",
  "Velkoņu iela": "улица Велконьу",
  "Balvu iela": "улица Балву",
  "Kuldīgas iela": "улица Кулдигас",
  "Jūrmalas gatve": "Юрмалас гатве",
  "Vizmas Belševicas iela": "улица Визмас Белшевицас",
  "Annas Brigaderes iela": "улица Аннас Бригадерес",
  "Dzelzavas iela": "улица Дзелзавас",
  "Zentenes iela": "улица Зентенес",
  "Rigondas gatve": "Ригондас гатве",
  "Kurzemes prospekts": "проспект Курземес",
  "Anniņmuižas bulvāris": "бульвар Анниньмуйжас",
  "Mazā Krūmu iela": "улица Маза Круму",
  "Salnas iela": "улица Салнас",
  "Zemes iela": "улица Земес",
  "Dzeņu iela": "улица Дзеньу",
  "Bērzupes iela": "улица Берзупес",
  "Skaistkalnes iela": "улица Скайсткалнес",
  "Valdeķu iela": "улица Валдеку",
  "Bauskas iela": "улица Баускас",
  "Ozolciema iela": "улица Озолциема",
  "Ilmājas iela": "улица Илмаяс",
  "Parauga iela": "улица Парауга",
};

// ---------- helpers ----------

/** Lower case, no diacritics, single spaces: «Ilūkstes  IELA» -> «ilukstes iela». */
const fold = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const LATIN_LETTER = /[A-Za-z\u00C0-\u017F]/;
const LATIN_RUN = /[A-Za-z\u00C0-\u017F]+/g;

interface StreetType {
  canon: string;
  /** Russian type word. */
  ru: string;
  /** true: «улица Илукстес»; false: «Юрмалас гатве». */
  before: boolean;
}

const TYPES: readonly (StreetType & { forms: readonly string[] })[] = [
  { canon: "iela", forms: ["iela", "ielā", "ielas", "ielu"], ru: "улица", before: true },
  { canon: "gatve", forms: ["gatve", "gatvē", "gatves", "gatvi"], ru: "гатве", before: false },
  { canon: "prospekts", forms: ["prospekts", "prospektā", "prospekta", "prospektu"], ru: "проспект", before: true },
  { canon: "bulvaris", forms: ["bulvāris", "bulvārī", "bulvāra", "bulvāri"], ru: "бульвар", before: true },
  { canon: "aleja", forms: ["aleja", "alejā", "alejas"], ru: "аллея", before: true },
  { canon: "soseja", forms: ["šoseja", "šosejā", "šosejas"], ru: "шоссе", before: false },
  { canon: "krastmala", forms: ["krastmala", "krastmalā", "krastmalas"], ru: "набережная", before: true },
  { canon: "laukums", forms: ["laukums", "laukumā", "laukuma"], ru: "площадь", before: true },
];
const TYPE_OF = new Map<string, StreetType>(TYPES.flatMap((t) => t.forms.map((f) => [fold(f), t] as const)));

/** «Ilūkstes iela» -> name «Ilūkstes» + type; a last word that is no street type leaves the type undefined. */
function splitType(street: string): { name: string; type: StreetType | undefined } {
  const m = /^(.*\S)\s+(\S+)$/.exec(street);
  const type = m ? TYPE_OF.get(fold(m[2]!)) : undefined;
  return type ? { name: m![1]!, type } : { name: street, type: undefined };
}

// ---------- Latvian -> Cyrillic, letter by letter ----------

const VOWELS = "aāeēiīouū";
const isVowel = (c: string | undefined): boolean => c !== undefined && VOWELS.includes(c);

const VOWEL_RU: Record<string, string> = { a: "а", ā: "а", e: "е", ē: "е", i: "и", ī: "и", o: "о", u: "у", ū: "у" };
const CONSONANT_RU: Record<string, string> = {
  b: "б", c: "ц", č: "ч", d: "д", f: "ф", g: "г", ģ: "г", h: "х", k: "к", ķ: "к", l: "л", ļ: "ль", m: "м", n: "н", ņ: "нь",
  p: "п", r: "р", s: "с", š: "ш", t: "т", v: "в", z: "з", ž: "ж", w: "в", q: "к", x: "кс", y: "и",
};
/** j + vowel is written with one iotated letter: «Jūrmalas» -> «Юрмалас», «Ilmājas» -> «Илмаяс». */
const JOTATED: Record<string, string> = { a: "я", ā: "я", u: "ю", ū: "ю", e: "е", ē: "е", o: "ё", i: "йи", ī: "йи" };

/** Cyrillic for one source letter in its context (previous / next letter, lower case); undefined: not a letter we know. */
function letterRu(c: string, prev: string | undefined, next: string | undefined, atStart: boolean): string | undefined {
  if (c === "e" || c === "ē") return atStart || (isVowel(prev) && prev !== "i" && prev !== "ī") ? "э" : "е"; // «Элизабетес», «Аэропорта»; «ие» after i
  if (c === "i" && (prev === "a" || prev === "e" || prev === "o" || prev === "u") && !isVowel(next)) return "й"; // ai, ei, oi, ui: «Скайсткалнес»
  if ((c === "ļ" || c === "ņ") && (next === "e" || next === "ē" || next === "i" || next === "ī")) return c === "ļ" ? "л" : "н"; // the vowel softens it
  return VOWEL_RU[c] ?? CONSONANT_RU[c];
}

function translitWord(word: string): string {
  const chars = [...word];
  const lower = chars.map((c) => c.toLowerCase());
  const shout = chars.length > 1 && word === word.toUpperCase(); // «KRŪMU»: keep the whole word in capitals
  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const c = lower[i]!;
    let ru: string | undefined;
    let step = 0;
    if (c === "j") {
      const iot = lower[i + 1] ? JOTATED[lower[i + 1]!] : undefined;
      ru = iot ?? "й";
      if (iot) step = 1;
    } else {
      ru = letterRu(c, lower[i - 1], lower[i + 1], i === 0);
      if (ru === undefined) {
        const base = c.normalize("NFD")[0]!; // «ö», «é»: try the letter without its mark
        ru = base !== c ? letterRu(base, lower[i - 1], lower[i + 1], i === 0) : undefined;
      }
    }
    const piece = ru ?? chars[i]!;
    out.push(shout ? piece.toUpperCase() : chars[i] !== lower[i] ? piece.charAt(0).toUpperCase() + piece.slice(1) : piece);
    i += step;
  }
  return out.join("");
}

/**
 * Simple Latvian -> Russian transliteration for the street names the map does not know: «Brīvības» -> «Бривибас».
 * Latin letter runs only; digits, punctuation and Cyrillic text pass through. Unaccented input works too (the marks are lost, not guessed).
 */
export function transliterateLvRu(text: string): string {
  return text.replace(LATIN_RUN, (w) => translitWord(w));
}

// ---------- street and address ----------

/** Digit runs as Russian words (nominative, masculine); runs too long for words.ts stay as digits. */
const digitsToWords = (s: string): string => s.replace(/\d+/g, (d) => (d.length <= 9 ? numberToWords(Number(d), "ru") : d));

/** Last resort for text that is no «street house» shape: every token transliterated, street types replaced in place, digits as words. */
function looseSpoken(s: string): string {
  return s
    .split(" ")
    .map((tok) => TYPE_OF.get(fold(tok))?.ru ?? digitsToWords(transliterateLvRu(tok)))
    .join(" ");
}

const CURATED_BY_NAME = new Map<string, { canon: string | undefined; ru: string }>(
  Object.entries(STREET_RU).map(([lv, ru]) => {
    const { name, type } = splitType(lv);
    return [fold(name), { canon: type?.canon, ru }] as const;
  }),
);

/**
 * Street without the house: «Ilūkstes iela» -> «улица Илукстес», «Jūrmalas gatve» -> «Юрмалас гатве». Known streets come from STREET_RU
 * (accents, case and a missing or inflected type word do not matter), others are transliterated. Text without a Latin letter is returned as given.
 */
export function streetSpokenRu(street: string): string {
  if (!LATIN_LETTER.test(street)) return street.trim();
  const s = street.trim().replace(/[\s,;.]+$/, "").replace(/\s+/g, " ");
  const { name, type } = splitType(s);
  const hit = CURATED_BY_NAME.get(fold(name));
  if (hit && (!type || type.canon === hit.canon)) return hit.ru;
  const ru = digitsToWords(transliterateLvRu(name.replace(/(\d)\./g, "$1"))); // «13. janvāra»: a number in the name is read as words, not as digits
  if (!type) return ru;
  return type.before ? `${type.ru} ${ru}` : `${ru} ${type.ru}`;
}

// What follows the street: house number, optional house letter and korpuss («3 k-2», «3k2», «3 korpuss 2»), optional city.
const HOUSE_RE = /^[\s,]*(\d{1,4})(?:\s?([A-Za-z]))?(?:[\s,]*(?:k|korp|korpuss|korpusa)\.?\s*-?\s*(\d{1,3}))?(?:[\s,]+(R[iī]ga))?$/iu;

/** Street = up to and including the first street-type word (never the first word); without one, up to the first word that starts with a digit. */
function splitAddress(s: string): { street: string; rest: string } {
  const words = s.split(" ");
  const typeAt = words.findIndex((w, i) => i > 0 && TYPE_OF.has(fold(w.replace(/[,;.]+$/, ""))));
  const digitAt = words.findIndex((w, i) => i > 0 && /^\d/.test(w));
  const cut = typeAt >= 0 ? typeAt + 1 : digitAt >= 0 ? digitAt : words.length;
  return { street: words.slice(0, cut).join(" "), rest: words.slice(cut).join(" ") };
}

/**
 * Whole address: «Ilūkstes iela 16» -> «улица Илукстес, дом шестнадцать»; «Ilūkstes iela 103 k-1» -> «…, дом сто три, корпус один»;
 * «Bērzupes iela 31A» -> «…, дом тридцать один А». Text without a Latin letter (already Russian) is returned as given; what is
 * left after the street and does not look like a house number is transliterated word by word, digits as words.
 */
export function addressSpokenRu(address: string): string {
  if (!LATIN_LETTER.test(address)) return address.trim();
  const { street, rest } = splitAddress(address.trim().replace(/[\s,;.]+$/, "").replace(/\s+/g, " "));
  const streetRu = streetSpokenRu(street);
  if (!rest) return streetRu;
  const m = HOUSE_RE.exec(rest);
  if (!m) return `${streetRu}, ${looseSpoken(rest)}`;
  const [, house, letter, korpuss, city] = m;
  const parts = [streetRu, `дом ${numberToWords(Number(house), "ru")}${letter ? ` ${transliterateLvRu(letter.toUpperCase())}` : ""}`];
  if (korpuss) parts.push(`корпус ${numberToWords(Number(korpuss), "ru")}`);
  if (city) parts.push("Рига");
  return parts.join(", ");
}
