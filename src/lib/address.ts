import { speakableFields } from "./buildings";

// Address matching for addresses spoken aloud in Latvian or Russian (English filler tolerated).
//   normalise: lowercase -> Cyrillic to Latvian-style transliteration -> strip diacritics -> spoken numbers to digits
//   -> drop city, postcode and street-type words -> parse house, korpuss and apartment
//   match:     Jaro-Winkler >= 0.88 on street names (+ aliases); the house number must match EXACTLY.
// Statuses: found | confirm | need_house | not_found, with a confidence (0..1) and at most 3 candidates.

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "z", з: "z", и: "i", й: "i",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "c", ч: "c", ш: "s", щ: "s", ъ: "", ы: "i", ь: "", э: "e", ю: "ju", я: "ja",
};

/**
 * Lowercase, Cyrillic -> Latin (Latvian-friendly: ц->c, ш->s, й->i so «Вайдавас» = Vaidavas), strip diacritics,
 * fold the soft consonants Russian writes for ņ / ļ («ню», «ль») so both sides compare equal.
 */
export function normalizeText(input: string): string {
  let s = input.toLowerCase();
  s = s.replace(/[а-яё]/g, (ch) => CYR[ch] ?? ch);
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/nj/g, "n").replace(/lj/g, "l");
  s = s.replace(/[^a-z0-9-]+/g, " ").replace(/-{2,}/g, "-").replace(/\s+/g, " ").trim();
  return s;
}

const norm = normalizeText;

// Street-type, city and filler words removed before comparing street names (stored in normalised form).
const STOP = new Set(
  [
    // street types LV / RU / EN
    "iela", "ielas", "ielu", "iel", "gatve", "gatves", "prospekts", "prospekta", "prospekte", "bulvaris", "bulvara", "bulvari",
    "aleja", "alejas", "soseja", "krastmala", "laukums", "laukuma", "linija",
    "улица", "улицу", "улице", "улицы", "ул", "гатве", "гатвe", "проспект", "проспекта", "пр", "бульвар", "бульвара", "аллея", "аллее",
    "шоссе", "набережная", "площадь", "переулок", "street", "st", "str", "road", "rd", "avenue", "ave", "boulevard", "blvd",
    // city, country, postcode words
    "riga", "rigas", "rige", "rigi", "latvija", "latvia", "lv", "рига", "риге", "ригу", "латвия", "город", "pilseta", "city",
    // house words
    "dom", "doma", "dome", "domu", "дом", "maja", "majas", "nr", "no", "numurs", "nomer", "номер", "house", "number", "no.",
    // filler (RU transliterated + LV + EN)
    "я", "живу", "на", "в", "во", "по", "у", "мой", "моя", "адрес", "это", "esmu", "dzivoju", "mana", "adrese", "adresu", "ir", "pie", "uz", "tas",
    "i", "live", "at", "my", "address", "is", "the", "in", "on", "address",
  ].map((w) => norm(w)),
);

// ---------- spoken numbers (RU + LV + EN), normalised with the same function ----------
const NUM_WORDS: Record<string, number> = {};
const addNums = (words: string[], values: number[]) =>
  words.forEach((w, i) => w.split("|").forEach((v) => (NUM_WORDS[norm(v)] = values[i]!)));

addNums(
  ["ноль", "один|одна|одно", "два|две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять",
    "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"],
  Array.from({ length: 20 }, (_, i) => i),
);
addNums(["двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"], [20, 30, 40, 50, 60, 70, 80, 90]);
addNums(["сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"], [100, 200, 300, 400, 500, 600, 700, 800, 900]);
addNums(
  ["nulle", "viens|viena", "divi|divas", "trīs", "četri|četras", "pieci|piecas", "seši|sešas", "septiņi|septiņas", "astoņi|astoņas", "deviņi|deviņas", "desmit",
    "vienpadsmit", "divpadsmit", "trīspadsmit", "četrpadsmit", "piecpadsmit", "sešpadsmit", "septiņpadsmit", "astoņpadsmit", "deviņpadsmit"],
  Array.from({ length: 20 }, (_, i) => i),
);
addNums(["divdesmit", "trīsdesmit", "četrdesmit", "piecdesmit", "sešdesmit", "septiņdesmit", "astoņdesmit", "deviņdesmit"], [20, 30, 40, 50, 60, 70, 80, 90]);
addNums(["simts|simt|simti", "divsimt", "trīssimt", "četrsimt", "piecsimt", "sešsimt", "septiņsimt", "astoņsimt", "deviņsimt"], [100, 200, 300, 400, 500, 600, 700, 800, 900]);
addNums(
  ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
    "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred"],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 30, 40, 50, 60, 70, 80, 90, 100],
);
// "no" (Latvian "from") is not a number; "one" etc. are only reached after normalisation.
delete NUM_WORDS["no"];

/** Replace runs of number words with digits: "dom sestnadcat" -> "dom 16". */
export function wordsToDigits(normalized: string): string {
  const toks = normalized.split(" ");
  const out: string[] = [];
  let acc: number | null = null;
  const flush = () => {
    if (acc !== null) out.push(String(acc));
    acc = null;
  };
  for (const t of toks) {
    const v = NUM_WORDS[t];
    if (v === undefined) {
      flush();
      out.push(t);
      continue;
    }
    if (acc === null) acc = v;
    else if (v === 100 && acc < 10) acc = acc * 100; // "divi simti", "one hundred"
    else if (acc % 10 === 0 && acc >= 20 && v < 10) acc += v; // "двадцать четыре", "сто двадцать пять" handled below
    else if (acc % 100 === 0 && acc >= 100 && v < acc && v < 100) acc += v; // "сто пять", "simts divdesmit"
    else {
      flush();
      acc = v;
    }
  }
  flush();
  return out.join(" ");
}

const MONTH_GEN: Record<string, string> = {
  janvara: "janvara", februara: "februara", marta: "marta", aprila: "aprila", maija: "maija", junija: "junija",
  julija: "julija", augusta: "augusta", septembra: "septembra", oktobra: "oktobra", novembra: "novembra", decembra: "decembra",
  // Russian genitive months after transliteration
  janvarja: "janvara", fevralja: "februara", aprelja: "aprila", maja: "maija", ijunja: "junija", ijulja: "julija",
  avgusta: "augusta", sentjabrja: "septembra", oktjabrja: "oktobra", nojabrja: "novembra", dekabrja: "decembra",
};

export interface ParsedAddress {
  normalized: string;
  /** Street-name tokens (type words, city, filler removed). */
  streetTokens: string[];
  house?: string;
  /** House number with a spaced single letter, e.g. "16 a" -> "16a" (tried only when `house` finds nothing). */
  houseAlt?: string;
  korpuss?: string;
  apartment?: string;
}

export function parseAddress(text: string): ParsedAddress {
  const normalized = norm(text);
  let s = wordsToDigits(normalized);
  s = s.replace(/\blv ?-? ?\d{4}\b/g, " "); // postcode LV-1082
  let korpuss: string | undefined;
  let apartment: string | undefined;
  const datedTokens: string[] = [];

  // streets named after a date: "13. janvara iela" must not be read as house 13
  s = s.replace(/\b(\d{1,2})\s+([a-z]+)\b/g, (m, d: string, mon: string) => {
    const canon = MONTH_GEN[mon];
    if (!canon) return m;
    datedTokens.push(`${d}${canon}`);
    return " ";
  });

  // "второй корпус" -> "korpus 2" (Russian ordinals only make sense next to the word korpus)
  s = s.replace(/\b(pervii|vtoroi|tretii|cetvertii)\s+korpus\b/, (_m, o: string) => `korpus ${({ pervii: 1, vtoroi: 2, tretii: 3, cetvertii: 4 } as Record<string, number>)[o]}`);
  // korpuss: "3 k-2", "3k2", "3 korpus 2", "3 korp 2", "3 k 2"
  s = s.replace(/(\d+[a-z]?)\s*-?\s*(?:korpuss|korpusa|korpus|korp|k)\s*-?\s*(\d+)\b/, (_m, h: string, k: string) => {
    korpuss = k;
    return ` ${h} `;
  });
  // apartment words: "kv 45", "kvartira 45", "dz 45", "dzivoklis 45", "apt 45", "flat 45"
  s = s.replace(/\b(?:kvartira|kvartiru|kvartire|kv|dzivoklis|dzivokli|dzivokla|dz|apartment|apt|flat)\s*-?\s*(\d+)\b/, (_m, a: string) => {
    apartment = a;
    return " ";
  });

  let house: string | undefined;
  let houseAlt: string | undefined;
  // Latvian convention "74-45" = house 74, apartment 45
  const hm = s.match(/\b(\d{1,4})([a-z])?\b(?:\s*-\s*(\d{1,4})\b)?/);
  if (hm) {
    house = `${hm[1]}${hm[2] ?? ""}`;
    if (hm[3] && !apartment) apartment = hm[3];
    const after = s.slice((hm.index ?? 0) + hm[0].length);
    const spaced = /^\s([a-d])(?:\s|$)/.exec(after);
    if (!hm[2] && spaced) houseAlt = `${hm[1]}${spaced[1]}`;
    s = s.replace(hm[0], " ");
  }
  const streetTokens = [
    ...s
      .replace(/\d+/g, " ")
      .split(" ")
      .filter((t) => t.length >= 2 && !STOP.has(t)),
    ...datedTokens,
  ];
  return { normalized, streetTokens, house, houseAlt, korpuss, apartment };
}

// ---------- fuzzy comparison ----------

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  const win = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const ma = new Array<boolean>(la).fill(false);
  const mb = new Array<boolean>(lb).fill(false);
  let m = 0;
  for (let i = 0; i < la; i++) {
    for (let j = Math.max(0, i - win); j < Math.min(lb, i + win + 1); j++) {
      if (mb[j] || a[i] !== b[j]) continue;
      ma[i] = mb[j] = true;
      m++;
      break;
    }
  }
  if (!m) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!ma[i]) continue;
    while (!mb[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (m / la + m / lb + (m - t / 2) / m) / 3;
  let p = 0;
  while (p < Math.min(4, la, lb) && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}

function windowScore(win: string[], name: string[]): number {
  const wj = win.join("");
  const bj = name.join("");
  if (wj === bj) return 1;
  const perToken = win.map((t) => Math.max(...name.map((u) => jaroWinkler(t, u))));
  const avg = perToken.reduce((x, y) => x + y, 0) / perToken.length;
  return Math.max(avg, jaroWinkler(wj, bj));
}

/**
 * 0..1 similarity between the spoken street tokens and one street name. Every contiguous window of up to 3 spoken
 * tokens is scored, so filler words («я живу на …», "my address is …") do not drag the score down.
 */
export function streetScore(query: readonly string[], name: readonly string[]): number {
  if (!query.length || !name.length) return 0;
  let best = 0;
  for (let i = 0; i < query.length; i++) {
    for (let len = 1; len <= 3 && i + len <= query.length; len++) {
      best = Math.max(best, windowScore(query.slice(i, i + len) as string[], name as string[]));
      if (best === 1) return 1;
    }
  }
  return best;
}

// ---------- index ----------

/** Minimal record the matcher needs. Extra fields (floors, stairwells, ...) travel along untouched. */
export interface AddressEntry {
  id: string;
  address_lv: string;
  address_ru?: string;
  /** Other spellings of the street name, e.g. the former or colloquial name. */
  aliases?: readonly string[];
  /** Optional explicit parts; otherwise they are parsed from address_lv. */
  street_lv?: string;
  house?: string;
  korpuss?: string | null;
}

export interface IndexedEntry<E extends AddressEntry> {
  entry: E;
  house: string;
  korpuss: string | null;
}

export interface StreetGroup<E extends AddressEntry> {
  key: string;
  display: string;
  /** Primary name first, then aliases / address_ru street names. */
  names: string[][];
  items: IndexedEntry<E>[];
}

export interface AddressIndex<E extends AddressEntry> {
  streets: StreetGroup<E>[];
  size: number;
}

function displayStreet(e: AddressEntry): string {
  if (e.street_lv) return e.street_lv;
  const first = e.address_lv.split(",")[0] ?? e.address_lv;
  return first.replace(/\s+\d.*$/, "").trim();
}

export function buildAddressIndex<E extends AddressEntry>(entries: readonly E[]): AddressIndex<E> {
  const groups = new Map<string, StreetGroup<E>>();
  for (const entry of entries) {
    const parsed = parseAddress(entry.address_lv);
    const tokens = streetTokensOfEntry(entry, parsed);
    const key = tokens.join(" ");
    let g = groups.get(key);
    if (!g) {
      g = { key, display: displayStreet(entry), names: [tokens], items: [] };
      groups.set(key, g);
    }
    const extra = [...(entry.aliases ?? []), ...(entry.address_ru ? [entry.address_ru] : [])];
    for (const a of extra) {
      const t = parseAddress(a).streetTokens;
      if (t.length && !g.names.some((n) => n.join(" ") === t.join(" "))) g.names.push(t);
    }
    g.items.push({
      entry,
      house: (entry.house ?? parsed.house ?? "").toLowerCase(),
      korpuss: entry.korpuss !== undefined ? entry.korpuss : (parsed.korpuss ?? null),
    });
  }
  return { streets: [...groups.values()], size: entries.length };
}

function streetTokensOfEntry(entry: AddressEntry, parsed: ParsedAddress): string[] {
  return entry.street_lv ? parseAddress(entry.street_lv).streetTokens : parsed.streetTokens;
}

/**
 * Tolerant loader for data/buildings/out/riga_buildings_search.json. Accepts an array of records
 * ({id, address_lv, address_ru?, aliases?, ...}) or an object map {address_lv: id}. Anything else is ignored.
 */
export function loadSearchIndex(raw: unknown): AddressEntry[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
      .map((r) => {
        // WP1 shape: {id, street_lv, house ("3 k-2" for korpuss records), korpuss, aliases[], ...} without address_lv
        let house = typeof r.house === "string" ? r.house : undefined;
        let korpuss = r.korpuss === undefined || r.korpuss === null ? undefined : String(r.korpuss);
        if (house) {
          const m = /^(.*?)\s*k-?(\d+)$/i.exec(house);
          if (m) {
            house = m[1]!;
            korpuss ??= m[2]!;
          }
        }
        const street = typeof r.street_lv === "string" ? r.street_lv : undefined;
        const synthesized = street && house ? `${street} ${house}${korpuss ? ` k-${korpuss}` : ""}, Rīga` : "";
        const address = String(r.address_lv ?? r.address ?? r.a ?? synthesized);
        const e: AddressEntry & Record<string, unknown> = { ...r, id: String(r.id ?? r.i ?? address), address_lv: address };
        if (Array.isArray(r.sourced)) e.sourced = speakableFields(r.sourced.map(String));
        if (street && house) {
          e.street_lv = street;
          e.house = house;
          e.korpuss = korpuss ?? null;
        }
        return e;
      })
      .filter((e) => e.address_lv);
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([address, id]) => ({ id: String(id), address_lv: address }));
  }
  return [];
}

// ---------- matching ----------

export type MatchStatus = "found" | "confirm" | "need_house" | "not_found";

export const STREET_THRESHOLD = 0.88;
/** Street scores from here up (practically: equal after normalisation) are trusted without asking the caller to confirm. */
export const FOUND_THRESHOLD = 0.99;
export const MAX_CANDIDATES = 3;

export interface MatchResult<E extends AddressEntry> {
  status: MatchStatus;
  /** 0..1, rounded to 2 decimals. */
  confidence: number;
  /** Set for found, and for confirm when there is a single proposed building. */
  building: E | null;
  /** At most 3 alternatives (confirm / need_house / not_found-with-street). */
  candidates: E[];
  /** Canonical street name when the street was recognised (for the need_house phrase). */
  street: string | null;
  parsed: ParsedAddress;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function byHouse<E extends AddressEntry>(a: IndexedEntry<E>, b: IndexedEntry<E>): number {
  const na = parseInt(a.house, 10);
  const nb = parseInt(b.house, 10);
  return (Number.isNaN(na) ? 1e9 : na) - (Number.isNaN(nb) ? 1e9 : nb) || a.house.localeCompare(b.house) || String(a.korpuss ?? "").localeCompare(String(b.korpuss ?? ""));
}

export function matchAddress<E extends AddressEntry>(text: string, index: AddressIndex<E>): MatchResult<E> {
  const parsed = parseAddress(text);
  const none = (confidence: number, street: string | null = null, candidates: E[] = []): MatchResult<E> => ({
    status: "not_found", confidence: round2(confidence), building: null, candidates, street, parsed,
  });
  if (!parsed.streetTokens.length || !index.streets.length) return none(0);

  const scored = index.streets
    .map((g) => ({ g, score: Math.max(...g.names.map((n) => streetScore(parsed.streetTokens, n))) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  if (best.score < STREET_THRESHOLD) return none(best.score);
  const close = scored.filter((x) => x.score >= STREET_THRESHOLD && x.score >= best.score - 0.02);

  if (!parsed.house) {
    const items = close.flatMap((x) => x.g.items).sort(byHouse).slice(0, MAX_CANDIDATES);
    return {
      status: "need_house", confidence: round2(best.score), building: null,
      candidates: items.map((i) => i.entry), street: best.g.display, parsed,
    };
  }

  const houses = [parsed.house, ...(parsed.houseAlt ? [parsed.houseAlt] : [])].map((h) => h.toLowerCase());
  let pool: { it: IndexedEntry<E>; score: number }[] = [];
  for (const h of houses) {
    pool = close.flatMap((x) => x.g.items.filter((i) => i.house === h).map((it) => ({ it, score: x.score })));
    if (pool.length) break;
  }
  if (!pool.length) return none(best.score * 0.5, best.g.display);

  if (parsed.korpuss) {
    const k = pool.filter((p) => p.it.korpuss === parsed.korpuss);
    if (!k.length) return none(best.score * 0.5, best.g.display, pool.slice(0, MAX_CANDIDATES).map((p) => p.it.entry));
    pool = k;
  }

  const plain = pool.filter((p) => !p.it.korpuss);
  let pick = pool.length === 1 ? pool[0] : !parsed.korpuss && plain.length === 1 ? plain[0] : undefined;
  if (!pick) {
    // several buildings share the number (korpuss 1 / 2, or two close street names): the caller must choose
    const cands = pool.slice().sort((a, b) => b.score - a.score || byHouse(a.it, b.it)).slice(0, MAX_CANDIDATES).map((p) => p.it.entry);
    return { status: "confirm", confidence: round2(Math.min(best.score, 0.85)), building: null, candidates: cands, street: best.g.display, parsed };
  }
  const korpussAssumed = Boolean(pick.it.korpuss) && !parsed.korpuss;
  const trusted = pick.score >= FOUND_THRESHOLD && close.length === 1 && !korpussAssumed;
  return {
    status: trusted ? "found" : "confirm",
    confidence: round2(korpussAssumed ? Math.min(pick.score, 0.9) : pick.score),
    building: pick.it.entry,
    candidates: [],
    street: best.g.display,
    parsed,
  };
}
