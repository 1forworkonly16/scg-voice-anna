// Fills the {placeholder} slots of the phrase templates written by the copy builder (src/copy/phrases.ts).
// Interface shared with WP3: `export const PHRASES = { <key>: { ru: string, lv: string }, ... } as const`.
// render() THROWS on a missing or an extra placeholder, so a typo can never reach a caller's ear.

export type PhraseLang = "ru" | "lv";
export type PhraseTable = Readonly<Record<string, { readonly ru: string; readonly lv: string }>>;

/** The agreed keys and their placeholder sets (the contract between WP2 and WP3). */
export const PHRASE_SPEC = {
  price_range: ["low_net", "high_net", "low_gross", "high_gross", "per_apt_gross"],
  building_found: ["address", "facts"],
  building_confirm: ["address"],
  building_need_house: ["street"],
  building_not_found: [],
  slots_offer: ["slot1", "slot2", "slot3"],
  no_slots: [],
  booking_ok: ["slot", "address"],
  slot_taken: ["alt1", "alt2"],
  invalid_phone: [],
  calendar_down: [],
  works_found: ["apartment", "stairwell", "date", "window"],
  works_not_found: [],
  access_rescheduled: ["date", "window"],
  callback_ok: [],
  tool_error_generic: [],
  unknown_question: [],
} as const satisfies Record<string, readonly string[]>;

export type PhraseKey = keyof typeof PHRASE_SPEC;
export type PlaceholdersOf<K extends PhraseKey> = (typeof PHRASE_SPEC)[K][number];
export type PhraseValues<K extends PhraseKey> = { [P in PlaceholdersOf<K>]: string | number };

const SLOT_RE = /\{([a-zA-Z0-9_]+)\}/g;

/** Placeholder names used by a template, in order of first appearance, without duplicates. */
export function placeholdersOf(template: string): string[] {
  const out: string[] = [];
  for (const m of template.matchAll(SLOT_RE)) {
    const name = m[1]!;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/** Fill a template. Throws on a placeholder without a value and on a value without a placeholder. */
export function fillTemplate(template: string, values: Readonly<Record<string, string | number>>): string {
  const wanted = placeholdersOf(template);
  const given = Object.keys(values);
  const missing = wanted.filter((k) => !(k in values));
  const extra = given.filter((k) => !wanted.includes(k));
  if (missing.length || extra.length) {
    throw new Error(`render: placeholders mismatch (missing: [${missing.join(", ")}], extra: [${extra.join(", ")}]) in "${template.slice(0, 60)}"`);
  }
  return template.replace(SLOT_RE, (_m, k: string) => String(values[k]));
}

/** Render one phrase of a table in one language. */
export function renderPhrase<K extends PhraseKey>(table: PhraseTable, key: K, lang: PhraseLang, values: PhraseValues<K>): string {
  const entry = table[key];
  if (!entry) throw new Error(`render: unknown phrase key ${key}`);
  const template = entry[lang];
  if (typeof template !== "string" || !template) throw new Error(`render: empty ${lang} template for ${key}`);
  return fillTemplate(template, values as Record<string, string | number>);
}

/** Both languages at once: the `say_ru` / `say_lv` pair of a tool response. */
export function renderBoth<K extends PhraseKey>(table: PhraseTable, key: K, values: { ru: PhraseValues<K>; lv: PhraseValues<K> }): { say_ru: string; say_lv: string } {
  return {
    say_ru: renderPhrase(table, key, "ru", values.ru),
    say_lv: renderPhrase(table, key, "lv", values.lv),
  };
}

/** Checks a whole table against PHRASE_SPEC (extra keys are allowed). Returns human-readable problems (empty array = OK). */
export function validatePhraseTable(table: PhraseTable): string[] {
  const problems: string[] = [];
  const keys = Object.keys(PHRASE_SPEC) as PhraseKey[];
  for (const key of keys) {
    const entry = table[key];
    if (!entry) {
      problems.push(`missing key ${key}`);
      continue;
    }
    for (const lang of ["ru", "lv"] as const) {
      const t = entry[lang];
      if (typeof t !== "string" || !t.trim()) {
        problems.push(`${key}.${lang} is empty`);
        continue;
      }
      const got = [...placeholdersOf(t)].sort();
      const want = [...PHRASE_SPEC[key]].sort();
      if (got.join(",") !== want.join(",")) problems.push(`${key}.${lang} placeholders [${got.join(", ")}] != [${want.join(", ")}]`);
    }
  }
  return problems;
}
