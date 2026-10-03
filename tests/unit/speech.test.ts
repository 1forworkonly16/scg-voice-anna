import { describe, expect, it } from "vitest";
import { parametricQuote } from "../../src/lib/quote";
import {
  buildingFacts, dateLabel, dayLabel, priceFigures, pricePlaceholders, roundHigh, roundLow, roundPerApartment, slotLabel, timeLabel, todayLabel, windowLabel,
} from "../../src/lib/speech";
import { dayOrdinalLv, dayOrdinalRu, formatNumber, numberToWords, pluralLv, pluralRu, timeWords } from "../../src/lib/words";

describe("price figures (rounded by code)", () => {
  it("rounds >= 10000 outward to thousands, smaller to the nearest 100, per apartment to 10", () => {
    expect(roundLow(83680)).toBe(83000);
    expect(roundHigh(83680)).toBe(84000);
    expect(roundLow(10000)).toBe(10000);
    expect(roundHigh(10000)).toBe(10000);
    expect(roundLow(10001)).toBe(10000);
    expect(roundHigh(10001)).toBe(11000);
    expect(roundLow(9949)).toBe(9900);
    expect(roundHigh(9951)).toBe(10000);
    expect(roundLow(4260)).toBe(4300);
    expect(roundPerApartment(724)).toBe(720);
    expect(roundPerApartment(725)).toBe(730);
  });
  it("Ilukštes-sized quote: net and gross ranges", () => {
    const q = parametricQuote({ floors: 9, apartments: 144, stairwells: 4 });
    const f = priceFigures(q);
    expect(f.low_net).toBe(Math.floor(q.range.low.net / 1000) * 1000);
    expect(f.high_net).toBe(Math.ceil(q.range.high.net / 1000) * 1000);
    expect(f.low_gross).toBeLessThanOrEqual(q.range.low.gross);
    expect(f.high_gross).toBeGreaterThanOrEqual(q.range.high.gross);
    expect(f.per_apt_gross % 10).toBe(0);
    expect(f.high_gross).toBeGreaterThan(f.high_net);
  });
  it("exposes no instalments or working days", () => {
    const f = priceFigures(parametricQuote({ floors: 5, apartments: 60, stairwells: 3 }));
    expect(Object.keys(f).sort()).toEqual(["high_gross", "high_net", "low_gross", "low_net", "per_apt_gross"]);
    const text = JSON.stringify(pricePlaceholders(f, "ru", "words"));
    expect(text).not.toMatch(/месяц|monthly|working/i);
  });
  it("placeholders in digits, grouped and words", () => {
    const f = { low_net: 84000, high_net: 125000, low_gross: 101000, high_gross: 152000, per_apt_gross: 720 };
    expect(pricePlaceholders(f, "ru").low_net).toBe("84000");
    expect(pricePlaceholders(f, "ru", "grouped").high_net).toBe("125 000");
    expect(pricePlaceholders(f, "ru", "words").low_net).toBe("восемьдесят четыре тысячи");
    expect(pricePlaceholders(f, "lv", "words").per_apt_gross).toBe("septiņi simti divdesmit");
  });
});

describe("number words", () => {
  it.each([
    [0, "ru", "ноль"], [1, "ru", "один"], [21, "ru", "двадцать один"], [101, "ru", "сто один"], [1000, "ru", "одна тысяча"],
    [2000, "ru", "две тысячи"], [5742, "ru", "пять тысяч семьсот сорок два"], [11000, "ru", "одиннадцать тысяч"],
    [21000, "ru", "двадцать одна тысяча"], [125000, "ru", "сто двадцать пять тысяч"], [1000000, "ru", "один миллион"],
    [0, "lv", "nulle"], [16, "lv", "sešpadsmit"], [21, "lv", "divdesmit viens"], [100, "lv", "simts"], [200, "lv", "divi simti"],
    [1000, "lv", "tūkstotis"], [2000, "lv", "divi tūkstoši"], [21000, "lv", "divdesmit viens tūkstotis"], [11000, "lv", "vienpadsmit tūkstoši"],
    [125000, "lv", "simts divdesmit pieci tūkstoši"], [5742, "lv", "pieci tūkstoši septiņi simti četrdesmit divi"],
  ] as const)("%i (%s) -> %s", (n, lang, words) => {
    expect(numberToWords(n, lang)).toBe(words);
  });
  it("feminine units and plural helpers", () => {
    expect(numberToWords(2, "ru", "f")).toBe("две");
    expect(numberToWords(2, "lv", "f")).toBe("divas");
    expect(pluralRu(11, ["этаж", "этажа", "этажей"])).toBe("этажей");
    expect(pluralRu(22, ["этаж", "этажа", "этажей"])).toBe("этажа");
    expect(pluralLv(21, ["stāvs", "stāvi"])).toBe("stāvs");
    expect(pluralLv(11, ["stāvs", "stāvi"])).toBe("stāvi");
  });
  it("rejects out-of-range input", () => {
    expect(() => numberToWords(-1, "ru")).toThrow();
    expect(() => numberToWords(1.5, "lv")).toThrow();
    expect(formatNumber(84000, "en", "words")).toBe("84000");
  });
  it("day ordinals", () => {
    expect(dayOrdinalRu(5)).toBe("пятого");
    expect(dayOrdinalRu(22)).toBe("двадцать второго");
    expect(dayOrdinalRu(30)).toBe("тридцатого");
    expect(dayOrdinalLv(5)).toBe("piektajā");
    expect(dayOrdinalLv(13)).toBe("trīspadsmitajā");
    expect(dayOrdinalLv(21)).toBe("divdesmit pirmajā");
    expect(dayOrdinalLv(30)).toBe("trīsdesmitajā");
  });
  it("time words", () => {
    expect(timeWords("10:00", "ru")).toBe("десять часов");
    expect(timeWords("13:00", "ru")).toBe("тринадцать часов");
    expect(timeWords("10:30", "ru")).toBe("десять тридцать");
    expect(timeWords("09:05", "ru")).toBe("девять ноль пять");
    expect(timeWords("11:00", "lv")).toBe("vienpadsmit");
    expect(timeWords("10:30", "lv")).toBe("desmit trīsdesmit");
  });
});

describe("date, time and slot labels", () => {
  const start = new Date("2026-11-05T08:00:00Z"); // 10:00 EET, Thursday
  it("digits", () => {
    expect(slotLabel(start, "ru")).toBe("четверг, 5 ноября, 10:00");
    expect(slotLabel(start, "lv")).toBe("ceturtdien, 5. novembrī, plkst. 10.00");
    expect(dayLabel("2026-10-05", "ru")).toBe("понедельник, 5 октября");
    expect(dateLabel("2026-12-01", "en")).toBe("1 December");
  });
  it("words (TTS fallback)", () => {
    expect(slotLabel(start, "ru", { words: true })).toBe("четверг, пятого ноября, десять часов");
    expect(slotLabel(start, "lv", { words: true })).toBe("ceturtdien, piektajā novembrī, plkst. desmit");
    expect(timeLabel("09:00", "lv")).toBe("plkst. 9.00");
  });
  it("access window", () => {
    expect(windowLabel("09:00-13:00", "ru")).toBe("с 9:00 до 13:00");
    expect(windowLabel("09:00-17:00", "ru", { words: true })).toBe("с девяти до семнадцати часов");
    expect(windowLabel("13:00-17:00", "lv")).toBe("no plkst. 13.00 līdz 17.00");
    expect(windowLabel("garbage", "ru")).toBe("garbage");
  });
  it("today label uses Riga time (late UTC evening is already tomorrow)", () => {
    expect(todayLabel(new Date("2026-10-03T21:30:00Z"), "ru")).toBe("воскресенье, 4 октября");
  });
});

describe("building facts: only sourced fields", () => {
  it("speaks sourced fields, skips the rest", () => {
    const b = { floors: 9, stairwells: 4, apartments: 144, sourced: ["floors", "stairwells"] };
    expect(buildingFacts(b, "ru")).toBe("9 этажей и 4 подъезда");
    expect(buildingFacts(b, "lv")).toBe("9 stāvi un 4 kāpņu telpas");
    expect(buildingFacts({ ...b, sourced: ["floors"] }, "ru")).toBe("9 этажей");
    expect(buildingFacts({ ...b, sourced: [] }, "ru")).toBe("");
    expect(buildingFacts({ floors: null, stairwells: null, apartments: 60, sourced: ["apartments"] }, "ru")).toBe("60 квартир");
    expect(buildingFacts({ ...b, sourced: ["floors", "stairwells", "apartments"] }, "ru")).toBe("9 этажей, 4 подъезда и 144 квартиры");
  });
});
