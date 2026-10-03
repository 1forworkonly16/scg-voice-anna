import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fromRoot } from "../fixtures/paths";
import { describe, expect, it } from "vitest";
import { roundHalfEven, roundHalfEvenN } from "../../src/lib/pyround";
import { PRICE_MODEL_VERSION, parametricQuote, scopeLabel, SCOPES, OPTIONS, type QuoteInput } from "../../src/lib/quote";

interface Case {
  kind: string;
  in: Required<QuoteInput>;
  out: ReturnType<typeof parametricQuote>;
  ties: string[];
}
interface Fixture {
  model_version: string;
  price_model_sha256: string;
  tie_sites_covered: string[];
  round0: { x: number; r: number }[];
  round2: { x: number; r: number }[];
  cases: Case[];
}
const fx: Fixture = JSON.parse(readFileSync(fromRoot("tests/fixtures/parity.json"), "utf8"));

describe("price model data", () => {
  it("fixture was generated from the same price_model.json that the port reads", () => {
    const bytes = readFileSync(fromRoot("src/data/price_model.json"));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(fx.price_model_sha256);
    expect(PRICE_MODEL_VERSION).toBe(fx.model_version);
  });
});

describe("roundHalfEven (Python round)", () => {
  it("breaks exact ties to even", () => {
    expect([0.5, 1.5, 2.5, 3.5, -0.5, -1.5, -2.5].map(roundHalfEven)).toEqual([0, 2, 2, 4, 0, -2, -2]);
    expect(roundHalfEven(91880 / 16)).toBe(5742);
    expect(roundHalfEven(104680 / 16)).toBe(6542);
  });
  it("rounds non-ties normally", () => {
    expect(roundHalfEven(2.4999999999999996)).toBe(2);
    expect(roundHalfEven(2.5000000000000004)).toBe(3);
    expect(roundHalfEven(7.75)).toBe(8);
  });
  it("2-decimal rounding follows the exact binary value, like Python", () => {
    expect(roundHalfEvenN(2.675, 2)).toBe(2.67); // double is below the tie
    expect(roundHalfEvenN(0.125, 2)).toBe(0.12); // exact tie -> even
    expect(roundHalfEvenN(0.375, 2)).toBe(0.38); // exact tie -> even
    expect(roundHalfEvenN(1.005, 2)).toBe(1);
  });
  it("matches Python on all generated integer-rounding vectors", () => {
    for (const v of fx.round0) expect(roundHalfEven(v.x), `round(${v.x})`).toBe(v.r);
  });
  it("matches Python on all generated 2-decimal vectors", () => {
    for (const v of fx.round2) expect(roundHalfEvenN(v.x, 2), `round(${v.x}, 2)`).toBe(v.r);
  });
});

describe("parametricQuote parity with price_model_reference.py", () => {
  it("covers floors/apartments/stairwells grid, every scope, every option, both booleans, every tie site", () => {
    const k = new Set(fx.cases.map((c) => c.kind));
    for (const kind of ["anchor", "grid", "scope", "option", "flags", "combo", "random", "tie"]) expect(k.has(kind)).toBe(true);
    for (const s of SCOPES) expect(fx.cases.some((c) => c.in.scope === s)).toBe(true);
    for (const o of OPTIONS) expect(fx.cases.some((c) => c.in.options.includes(o))).toBe(true);
    for (const flag of ["horizontals", "sewer_outlet", "pump_station"] as const) {
      expect(fx.cases.some((c) => c.in[flag] === true)).toBe(true);
      expect(fx.cases.some((c) => c.in[flag] === false)).toBe(true);
    }
    expect([...fx.tie_sites_covered].sort()).toEqual(["gross", "monthly", "net", "per_apartment_gross", "per_riser_set_net", "riser_sets"]);
    for (const site of fx.tie_sites_covered) expect(fx.cases.some((c) => c.ties.includes(site))).toBe(true);
    expect(fx.cases.length).toBeGreaterThanOrEqual(300);
  });

  it("anchors: 91880/16 -> 5742 and 104680/16 -> 6542", () => {
    const a = parametricQuote({ floors: 9, apartments: 144, stairwells: 4 });
    expect(a.range.base.net).toBe(91880);
    expect(a.riser_sets_estimate).toBe(16);
    expect(a.per_riser_set_net).toBe(5742);
    const b = parametricQuote({ floors: 9, apartments: 144, stairwells: 4, sewer_outlet: true });
    expect(b.range.base.net).toBe(104680);
    expect(b.per_riser_set_net).toBe(6542);
  });

  it("matches ALL fixture cases exactly (100%)", () => {
    const bad: string[] = [];
    for (const c of fx.cases) {
      const got = parametricQuote(c.in);
      if (JSON.stringify(got) !== JSON.stringify(c.out)) bad.push(`${c.kind} ${JSON.stringify(c.in)}`);
    }
    expect(bad).toEqual([]);
  });

  it("every exact tie case is checked field by field", () => {
    const ties = fx.cases.filter((c) => c.ties.length > 0);
    expect(ties.length).toBeGreaterThan(50);
    for (const c of ties) expect(parametricQuote(c.in)).toEqual(c.out);
  });

  it("applies the reference defaults when optional arguments are omitted", () => {
    const d = parametricQuote({ floors: 9, apartments: 36, stairwells: 1 });
    const e = parametricQuote({ floors: 9, apartments: 36, stairwells: 1, scope: "risers_complete", horizontals: true, sewer_outlet: false, pump_station: false, options: [] });
    expect(d).toEqual(e);
    // Ilukstes replay from the reference selftest (1 stairwell, 36 apts, no horizontals): 20220
    expect(parametricQuote({ floors: 9, apartments: 36, stairwells: 1, horizontals: false }).range.base.net).toBe(20220);
  });

  it("rejects unknown scope/option and non-positive floors/apartments", () => {
    expect(() => parametricQuote({ floors: 9, apartments: 36, stairwells: 1, scope: "nope" as never })).toThrow();
    expect(() => parametricQuote({ floors: 9, apartments: 36, stairwells: 1, options: ["nope" as never] })).toThrow();
    expect(() => parametricQuote({ floors: 0, apartments: 36, stairwells: 1 })).toThrow();
    expect(() => parametricQuote({ floors: 9, apartments: 0, stairwells: 1 })).toThrow();
  });

  it("has labels for every scope", () => {
    for (const s of SCOPES) expect(scopeLabel(s, "ru").length).toBeGreaterThan(3);
  });
});
