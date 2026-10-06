import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { fromRoot } from "../fixtures/paths";
import { describe, expect, it } from "vitest";
import { PHRASES as SAMPLE } from "../fixtures/phrases.sample";
import { PHRASE_SPEC, fillTemplate, placeholdersOf, renderBoth, renderPhrase, validatePhraseTable, type PhraseKey, type PhraseTable } from "../../src/lib/render";

describe("fillTemplate / renderPhrase", () => {
  it("fills placeholders, repeats allowed", () => {
    expect(fillTemplate("{a} и {b}, {a}", { a: 1, b: "x" })).toBe("1 и x, 1");
    expect(placeholdersOf("{a} {b} {a}")).toEqual(["a", "b"]);
  });
  it("throws on a missing placeholder value", () => {
    expect(() => fillTemplate("{a} {b}", { a: 1 })).toThrow(/missing: \[b\]/);
  });
  it("throws on an extra value", () => {
    expect(() => fillTemplate("{a}", { a: 1, c: 2 })).toThrow(/extra: \[c\]/);
  });
  it("renders a typed phrase in both languages", () => {
    const r = renderBoth(SAMPLE, "slots_offer", { ru: { slot1: "a", slot2: "b", slot3: "c" }, lv: { slot1: "d", slot2: "e", slot3: "f" } });
    expect(r.say_ru).toBe("Свободно: a, b или c.");
    expect(r.say_lv).toBe("Brīvi: d, e vai f.");
    expect(renderPhrase(SAMPLE, "callback_ok", "ru", {})).toBe("Передала.");
  });
  it("throws on an unknown key or an empty template", () => {
    expect(() => renderPhrase({} as PhraseTable, "callback_ok", "ru", {})).toThrow(/unknown phrase key/);
    expect(() => renderPhrase({ callback_ok: { ru: "", lv: "x" } } as PhraseTable, "callback_ok", "ru", {})).toThrow(/empty/);
  });
});

describe("phrase table vs PHRASE_SPEC", () => {
  it("the sample fixture satisfies the spec", () => {
    expect(validatePhraseTable(SAMPLE)).toEqual([]);
  });
  it("reports missing keys and wrong placeholders", () => {
    const { callback_ok: _drop, ...rest } = SAMPLE;
    const bad = { ...rest, price_range: { ru: "{low_net}", lv: SAMPLE.price_range.lv } } as unknown as PhraseTable;
    const problems = validatePhraseTable(bad);
    expect(problems.some((p) => p.startsWith("missing key callback_ok"))).toBe(true);
    expect(problems.some((p) => p.startsWith("price_range.ru"))).toBe(true);
  });
  it("spec has the 20 agreed keys (17 from WP3 + 4 moved from routes/say.ts, minus consent_required dropped 2026-10-06)", () => {
    expect(Object.keys(PHRASE_SPEC)).toHaveLength(20);
    expect(Object.keys(PHRASE_SPEC)).not.toContain("consent_required");
  });

  const real = fromRoot("src/copy/phrases.ts");
  it.skipIf(!existsSync(real))("src/copy/phrases.ts (WP3): every key and placeholder set matches", async () => {
    const mod = (await import(/* @vite-ignore */ pathToFileURL(real).href)) as { PHRASES: PhraseTable };
    expect(validatePhraseTable(mod.PHRASES)).toEqual([]);
    for (const key of Object.keys(PHRASE_SPEC) as PhraseKey[]) {
      for (const lang of ["ru", "lv"] as const) {
        const values = Object.fromEntries(PHRASE_SPEC[key].map((p) => [p, "X"]));
        expect(() => renderPhrase(mod.PHRASES, key, lang, values as never)).not.toThrow();
      }
    }
  });
});
