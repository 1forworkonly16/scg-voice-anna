// Helpers for the M2 tools: leak detection (safety net behind the model's own `type`/`urgency`) and phone redaction
// (data minimisation: free-text fields must never hold a phone number, whatever the model sends).

/**
 * True when free text describes water leaking / flooding (ru, lv, en). It errs on the side of escalating, with one exception:
 * a negation within two words before the leak word in the same clause («не течёт», «не капает», «нет течи», «nav sūces», «ne tek»)
 * or glued to it as the Latvian prefix («nenoplūd») cancels that match. This only steers the keyword safety net; the model's own
 * `type: leak` / `urgency: urgent` still escalates.
 */
export function looksLikeLeak(text: string): boolean {
  for (const m of text.matchAll(LEAK_RE)) {
    if (!isNegated(text, m.index ?? 0)) return true;
  }
  return false;
}

const NEGATIONS = new Set(["не", "нет", "ни", "никакой", "никакая", "никаких", "без", "nav", "nē", "ne", "bez", "not", "isn't", "isnt", "doesn't", "doesnt", "never"]);

function isNegated(text: string, at: number): boolean {
  const before = text.slice(0, at);
  if (/(?<!\p{L})ne$/iu.test(before)) return true; // Latvian prefix: nenoplūd
  const clause = before.split(/[.!?;,\n]/).pop() ?? ""; // a negation in an earlier clause or sentence does not count
  const words = clause.match(/[\p{L}']+/gu) ?? [];
  return words.slice(-2).some((w) => NEGATIONS.has(w.toLowerCase()));
}

// `\b` is ASCII-only in JS, so word starts are written as a lookbehind on any letter (Unicode mode).
const LEAK_RE = new RegExp(
  [
    "(?<!\\p{L})теч[её]т",
    "(?<!\\p{L})теч[ьи](?!\\p{L})",
    "(?<!\\p{L})течк",
    "(?<!\\p{L})текл[аои]?(?!\\p{L})",
    "протеч|проте[кч]|протёк",
    "залив|залит|затоп|потоп|прорыв|хлещет|капает",
    "(?<!\\p{L})(?:leak|flood|burst)",
    "(?<!\\p{L})tek(?!\\p{L})",
    "(?<!\\p{L})teku(?!\\p{L})",
    "(?<!\\p{L})sūc[eēi]",
    "applūd|noplūd|saplīsu|izplīsu",
  ].join("|"),
  "giu",
);

const PHONE_PREFIXED = /(?:\+|\b00)\d[\d\s()-]{7,}\d/g;
const PHONE_DIGITS = /\b\d(?: ?\d){7,}\b/g;

/** Replaces phone-like digit runs (+371 …, 00371 …, or 8+ digits with optional single spaces) with a neutral marker. */
export function redactPhones(text: string): string {
  return text.replace(PHONE_PREFIXED, "[номер скрыт]").replace(PHONE_DIGITS, "[номер скрыт]");
}
