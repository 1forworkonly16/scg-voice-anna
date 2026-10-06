// Spoken Russian: every number, date and time Anna reads is finished words in the right case and gender.
import { describe, expect, it } from "vitest";
import { PHRASES } from "../../src/copy/phrases";
import { parametricQuote } from "../../src/lib/quote";
import { renderBoth } from "../../src/lib/render";
import {
  apartmentSpokenRu,
  buildingFacts,
  dayAtRu,
  dayNameRu,
  priceBoundsRu,
  priceFigures,
  pricePlaceholders,
  slotListRu,
  slotSpokenRu,
  stairwellSpokenRu,
  todayLabel,
  windowSpokenRu,
} from "../../src/lib/speech";
import { rigaLocalToUtc } from "../../src/lib/time";
import { dayOrdinalNomRu, dayOrdinalRu, numberToWordsGenRu, ordinalRu, timeAtRu, timeGenRu } from "../../src/lib/words";

const at = (ymd: string, hm: string) => rigaLocalToUtc(ymd, hm);

describe("days 1-31", () => {
  const GEN = [
    "первого", "второго", "третьего", "четвёртого", "пятого", "шестого", "седьмого", "восьмого", "девятого", "десятого",
    "одиннадцатого", "двенадцатого", "тринадцатого", "четырнадцатого", "пятнадцатого", "шестнадцатого", "семнадцатого", "восемнадцатого", "девятнадцатого", "двадцатого",
    "двадцать первого", "двадцать второго", "двадцать третьего", "двадцать четвёртого", "двадцать пятого", "двадцать шестого", "двадцать седьмого", "двадцать восьмого", "двадцать девятого", "тридцатого",
    "тридцать первого",
  ];
  const NOM_N = [
    "первое", "второе", "третье", "четвёртое", "пятое", "шестое", "седьмое", "восьмое", "девятое", "десятое",
    "одиннадцатое", "двенадцатое", "тринадцатое", "четырнадцатое", "пятнадцатое", "шестнадцатое", "семнадцатое", "восемнадцатое", "девятнадцатое", "двадцатое",
    "двадцать первое", "двадцать второе", "двадцать третье", "двадцать четвёртое", "двадцать пятое", "двадцать шестое", "двадцать седьмое", "двадцать восьмое", "двадцать девятое", "тридцатое",
    "тридцать первое",
  ];
  it.each(GEN.map((w, i) => [i + 1, w, NOM_N[i]!] as const))("%i: %s / %s", (day, gen, nom) => {
    expect(dayOrdinalRu(day)).toBe(gen);
    expect(dayOrdinalNomRu(day)).toBe(nom);
  });
  it("rejects days outside 1..31", () => {
    for (const d of [0, 32, 1.5]) {
      expect(() => dayOrdinalRu(d)).toThrow();
      expect(() => dayOrdinalNomRu(d)).toThrow();
    }
  });
});

describe("ordinals and genitive cardinals", () => {
  it.each([
    [1, "первый"], [2, "второй"], [3, "третий"], [4, "четвёртый"], [5, "пятый"], [6, "шестой"], [7, "седьмой"], [8, "восьмой"], [9, "девятый"],
    [10, "десятый"], [11, "одиннадцатый"], [20, "двадцатый"], [21, "двадцать первый"], [23, "двадцать третий"], [30, "тридцатый"], [40, "сороковой"],
    [41, "сорок первый"], [99, "девяносто девятый"], [100, "сотый"], [101, "сто первый"], [141, "сто сорок первый"], [200, "двухсотый"], [0, "нулевой"],
  ] as const)("masculine nominative %i -> %s", (n, w) => {
    expect(ordinalRu(n, "nom_m")).toBe(w);
  });
  it("neuter nominative and genitive of the irregular stems", () => {
    expect(ordinalRu(3, "nom_n")).toBe("третье");
    expect(ordinalRu(3, "gen")).toBe("третьего");
    expect(ordinalRu(40, "nom_n")).toBe("сороковое");
    expect(ordinalRu(40, "gen")).toBe("сорокового");
    expect(ordinalRu(100, "gen")).toBe("сотого");
    expect(() => ordinalRu(1000, "gen")).toThrow();
  });
  it.each([
    [0, "m", "нуля"], [1, "m", "одного"], [1, "f", "одной"], [2, "f", "двух"], [11, "m", "одиннадцати"], [21, "f", "двадцати одной"], [40, "m", "сорока"],
    [72, "f", "семидесяти двух"], [90, "m", "девяноста"], [100, "m", "ста"], [112, "f", "ста двенадцати"], [121, "f", "ста двадцати одной"],
    [135, "f", "ста тридцати пяти"], [200, "m", "двухсот"], [999, "m", "девятисот девяноста девяти"], [1000, "m", "одной тысячи"],
    [2000, "m", "двух тысяч"], [5000, "m", "пяти тысяч"], [8400, "m", "восьми тысяч четырёхсот"], [9100, "m", "девяти тысяч ста"],
    [11000, "m", "одиннадцати тысяч"], [21000, "m", "двадцати одной тысячи"], [121000, "m", "ста двадцати одной тысячи"],
    [1000000, "m", "одного миллиона"], [2500000, "m", "двух миллионов пятисот тысяч"], [21000000, "m", "двадцати одного миллиона"],
  ] as const)("genitive %i (%s) -> %s", (n, g, w) => {
    expect(numberToWordsGenRu(n, g)).toBe(w);
  });
});

describe("hours and times", () => {
  it.each([
    ["09:00", "в девять утра", "девяти утра"],
    ["10:00", "в десять утра", "десяти утра"],
    ["11:00", "в одиннадцать утра", "одиннадцати утра"],
    ["12:00", "в двенадцать часов дня", "двенадцати часов дня"],
    ["13:00", "в час дня", "часа дня"],
    ["14:00", "в два часа дня", "двух часов дня"],
    ["15:00", "в три часа дня", "трёх часов дня"],
    ["16:00", "в четыре часа дня", "четырёх часов дня"],
    ["17:00", "в пять вечера", "пяти вечера"],
  ] as const)("slot hours 9-17: %s -> %s / %s", (hm, inForm, genForm) => {
    expect(timeAtRu(hm)).toBe(inForm);
    expect(timeGenRu(hm)).toBe(genForm);
  });
  it.each([
    ["00:00", "в полночь", "полуночи"], ["01:00", "в час ночи", "часа ночи"], ["02:00", "в два часа ночи", "двух часов ночи"],
    ["04:00", "в четыре часа утра", "четырёх часов утра"], ["05:00", "в пять утра", "пяти утра"], ["8:00", "в восемь утра", "восьми утра"],
    ["18:00", "в шесть вечера", "шести вечера"], ["21:00", "в девять вечера", "девяти вечера"], ["23:00", "в одиннадцать вечера", "одиннадцати вечера"],
    ["24:00", "в полночь", "полуночи"],
  ] as const)("other whole hours: %s -> %s / %s", (hm, inForm, genForm) => {
    expect(timeAtRu(hm)).toBe(inForm);
    expect(timeGenRu(hm)).toBe(genForm);
  });
  it.each([
    ["09:30", "в девять тридцать", "девяти тридцати"],
    ["9:45", "в девять сорок пять", "девяти сорока пяти"],
    ["9.15", "в девять пятнадцать", "девяти пятнадцати"],
    ["13:05", "в тринадцать ноль пять", "тринадцати ноль пяти"],
    ["01:30", "в час тридцать", "часа тридцати"],
    ["09:21", "в девять двадцать одна", "девяти двадцати одной"],
  ] as const)("not a whole hour (24-hour reading): %s -> %s / %s", (hm, inForm, genForm) => {
    expect(timeAtRu(hm)).toBe(inForm);
    expect(timeGenRu(hm)).toBe(genForm);
  });
  it("rejects impossible times", () => {
    for (const t of ["25:00", "09:60", "24:30", "9", "nine"]) expect(() => timeAtRu(t), t).toThrow();
  });
  it.each([
    ["09:00-13:00", "с девяти утра до часа дня"],
    ["13:00-17:00", "с часа дня до пяти вечера"],
    ["09:00-17:00", "с девяти утра до пяти вечера"],
    ["09:00-14:00", "с девяти утра до двух часов дня"],
    ["10:00-12:00", "с десяти утра до двенадцати часов дня"],
    ["12:00-16:00", "с двенадцати часов дня до четырёх часов дня"],
    ["09:30-13:00", "с девяти тридцати до часа дня"],
    ["9:00 – 13:00", "с девяти утра до часа дня"],
    ["garbage", "garbage"],
    ["25:00-26:00", "25:00-26:00"],
  ] as const)("window %s -> %s", (w, spoken) => {
    expect(windowSpokenRu(w)).toBe(spoken);
  });
  it("never «часу»", () => {
    for (let h = 0; h <= 24; h++) {
      const hm = `${String(h).padStart(2, "0")}:00`;
      expect(timeAtRu(hm)).not.toMatch(/часу/);
      expect(timeGenRu(hm)).not.toMatch(/часу/);
    }
  });
});

describe("weekdays, dates, today", () => {
  it.each([
    ["2026-10-05", "в понедельник, пятого октября", "понедельник, пятое октября"],
    ["2026-10-06", "во вторник, шестого октября", "вторник, шестое октября"],
    ["2026-10-07", "в среду, седьмого октября", "среда, седьмое октября"],
    ["2026-10-08", "в четверг, восьмого октября", "четверг, восьмое октября"],
    ["2026-10-09", "в пятницу, девятого октября", "пятница, девятое октября"],
    ["2026-10-10", "в субботу, десятого октября", "суббота, десятое октября"],
    ["2026-10-11", "в воскресенье, одиннадцатого октября", "воскресенье, одиннадцатое октября"],
  ] as const)("%s -> %s / %s", (ymd, atForm, nameForm) => {
    expect(dayAtRu(ymd)).toBe(atForm);
    expect(dayNameRu(ymd)).toBe(nameForm);
  });
  it("month can be dropped; every month name is genitive", () => {
    expect(dayAtRu("2026-10-08", { month: false })).toBe("в четверг, восьмого");
    const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
    months.forEach((m, i) => expect(dayAtRu(`2027-${String(i + 1).padStart(2, "0")}-01`)).toMatch(new RegExp(`, первого ${m}$`)));
  });
  it("get_slots today.label_ru: «вторник, шестое октября» (Riga date; LV unchanged)", () => {
    expect(todayLabel(new Date("2026-10-06T08:00:00Z"), "ru")).toBe("вторник, шестое октября");
    expect(todayLabel(new Date("2026-10-06T08:00:00Z"), "lv")).toBe("otrdien, 6. oktobrī");
  });
});

describe("slots", () => {
  it("tool label: full date «в среду, седьмого октября, в девять утра»", () => {
    expect(slotSpokenRu(at("2026-10-07", "09:00"))).toBe("в среду, седьмого октября, в девять утра");
    expect(slotSpokenRu(at("2026-10-08", "13:00"))).toBe("в четверг, восьмого октября, в час дня");
  });
  it("one offer list: the month only for the first slot and when it changes", () => {
    expect(slotListRu([at("2026-10-07", "09:00"), at("2026-10-08", "13:00"), at("2026-10-09", "09:00")])).toEqual([
      "в среду, седьмого октября, в девять утра",
      "в четверг, восьмого, в час дня",
      "в пятницу, девятого, в девять утра",
    ]);
    expect(slotListRu([at("2026-10-29", "09:00"), at("2026-10-30", "13:00"), at("2026-11-02", "09:00")])).toEqual([
      "в четверг, двадцать девятого октября, в девять утра",
      "в пятницу, тридцатого, в час дня",
      "в понедельник, второго ноября, в девять утра",
    ]);
    expect(slotListRu([at("2026-12-30", "16:00"), at("2027-01-04", "10:00")])).toEqual([
      "в среду, тридцатого декабря, в четыре часа дня",
      "в понедельник, четвёртого января, в десять утра",
    ]);
    expect(slotListRu([])).toEqual([]);
  });
  it("Riga wall time across the DST change (26 Oct 2026 is UTC+2)", () => {
    expect(slotSpokenRu(new Date("2026-10-26T07:00:00Z"))).toBe("в понедельник, двадцать шестого октября, в девять утра");
    expect(slotSpokenRu(new Date("2026-10-23T06:00:00Z"))).toBe("в пятницу, двадцать третьего октября, в девять утра");
  });
});

describe("building facts: gender of the noun", () => {
  const facts = (field: "floors" | "stairwells" | "apartments", n: number) => buildingFacts({ [field]: n, sourced: [field] }, "ru");
  it.each([
    [1, "одна квартира"], [2, "две квартиры"], [5, "пять квартир"], [21, "двадцать одна квартира"], [141, "сто сорок одна квартира"],
    [22, "двадцать две квартиры"], [11, "одиннадцать квартир"], [1000, "одна тысяча квартир"],
  ] as const)("apartments %i -> %s", (n, w) => {
    expect(facts("apartments", n)).toBe(w);
  });
  it("floors and stairwells are masculine", () => {
    expect(facts("floors", 1)).toBe("один этаж");
    expect(facts("floors", 2)).toBe("два этажа");
    expect(facts("floors", 5)).toBe("пять этажей");
    expect(facts("floors", 21)).toBe("двадцать один этаж");
    expect(facts("stairwells", 1)).toBe("один подъезд");
    expect(facts("stairwells", 2)).toBe("два подъезда");
    expect(facts("stairwells", 22)).toBe("двадцать два подъезда");
  });
  it("lookup_building row: «девять этажей, четыре подъезда и сто сорок одна квартира»", () => {
    const b = { floors: 9, stairwells: 4, apartments: 141, sourced: ["floors", "stairwells", "apartments"] };
    for (const mode of ["digits", "grouped", "words"] as const) expect(buildingFacts(b, "ru", mode)).toBe("девять этажей, четыре подъезда и сто сорок одна квартира");
    expect(buildingFacts(b, "lv")).toBe("9 stāvi, 4 kāpņu telpas un 141 dzīvoklis");
  });
});

describe("works: apartment and stairwell", () => {
  it("apartment in words when it is a plain integer, otherwise as given", () => {
    expect(apartmentSpokenRu(12)).toBe("двенадцать");
    expect(apartmentSpokenRu(1)).toBe("один");
    expect(apartmentSpokenRu(141)).toBe("сто сорок один");
    expect(apartmentSpokenRu("12")).toBe("двенадцать");
    expect(apartmentSpokenRu("12a")).toBe("12a");
  });
  it("stairwell: masculine ordinal before «подъезд»", () => {
    expect(stairwellSpokenRu(1)).toBe("первый");
    expect(stairwellSpokenRu(2)).toBe("второй");
    expect(stairwellSpokenRu(3)).toBe("третий");
    expect(stairwellSpokenRu(21)).toBe("двадцать первый");
  });
});

describe("prices", () => {
  it.each([
    [72000, 112000, "семидесяти двух", "ста двенадцати тысяч"],
    [87000, 135000, "восьмидесяти семи", "ста тридцати пяти тысяч"],
    [101000, 121000, "ста одной", "ста двадцати одной тысячи"],
    [11000, 21000, "одиннадцати", "двадцати одной тысячи"],
    [1000, 2000, "одной", "двух тысяч"],
    [8400, 9100, "восьми тысяч четырёхсот", "девяти тысяч ста"],
    [6900, 12000, "шести тысяч девятисот", "двенадцати тысяч"],
    [9000, 9500, "девяти тысяч", "девяти тысяч пятисот"],
    [756000, 1135000, "семисот пятидесяти шести тысяч", "одного миллиона ста тридцати пяти тысяч"],
  ] as const)("bounds %i-%i -> «от %s до %s»", (lo, hi, low, high) => {
    expect(priceBoundsRu(lo, hi)).toEqual({ low, high });
  });

  const sayPrice = (f: Parameters<typeof pricePlaceholders>[0]) => renderBoth(PHRASES, "price_range", { ru: pricePlaceholders(f, "ru"), lv: pricePlaceholders(f, "lv") });

  it("9 floors / 4 stairwells / 141 apartments (quote from code)", () => {
    const f = priceFigures(parametricQuote({ floors: 9, stairwells: 4, apartments: 141 }));
    expect(f).toEqual({ low_net: 72000, high_net: 112000, low_gross: 87000, high_gross: 135000, per_apt_gross: 780 });
    const s = sayPrice(f);
    expect(s.say_ru).toBe(
      "Ориентировочно для вашего дома — от семидесяти двух до ста двенадцати тысяч евро без НДС, или от восьмидесяти семи до ста тридцати пяти тысяч с НДС двадцать один процент — это примерно семьсот восемьдесят евро на квартиру с НДС. Точную цену даст инженер после бесплатного осмотра.",
    );
    expect(s.say_lv).toBe(
      "Orientējoši jūsu mājai — no 72000 līdz 112000 eiro bez PVN, tas ir no 87000 līdz 135000 eiro ar PVN 21%, aptuveni 780 eiro uz vienu dzīvokli ar PVN. Precīzu cenu noteiks inženieris pēc bezmaksas apsekošanas.",
    );
  });
  it("below 10 000 (rounded to hundreds): full genitive numbers (2 floors / 1 stairwell / 2 apartments)", () => {
    const f = priceFigures(parametricQuote({ floors: 2, stairwells: 1, apartments: 2 }));
    expect(f).toEqual({ low_net: 4300, high_net: 7900, low_gross: 5300, high_gross: 9600, per_apt_gross: 3470 });
    expect(sayPrice(f).say_ru).toBe(
      "Ориентировочно для вашего дома — от четырёх тысяч трёхсот до семи тысяч девятисот евро без НДС, или от пяти тысяч трёхсот до девяти тысяч шестисот с НДС двадцать один процент — это примерно три тысячи четыреста семьдесят евро на квартиру с НДС. Точную цену даст инженер после бесплатного осмотра.",
    );
    expect(sayPrice({ low_net: 8400, high_net: 9100, low_gross: 10000, high_gross: 11000, per_apt_gross: 900 }).say_ru).toContain(
      "от восьми тысяч четырёхсот до девяти тысяч ста евро без НДС, или от десяти до одиннадцати тысяч с НДС двадцать один процент",
    );
  });
  it("an upper bound ending in 1: «до ста двадцати одной тысячи»", () => {
    const s = sayPrice({ low_net: 101000, high_net: 121000, low_gross: 122000, high_gross: 147000, per_apt_gross: 850 });
    expect(s.say_ru).toBe(
      "Ориентировочно для вашего дома — от ста одной до ста двадцати одной тысячи евро без НДС, или от ста двадцати двух до ста сорока семи тысяч с НДС двадцать один процент — это примерно восемьсот пятьдесят евро на квартиру с НДС. Точную цену даст инженер после бесплатного осмотра.",
    );
  });
  it("RU price: hedged, net and gross, ends with the engineer sentence, no digits; any NUMBER_MODE", () => {
    for (const [fl, st, ap] of [[9, 4, 141], [5, 2, 40], [2, 1, 2], [16, 12, 1400], [40, 30, 2000]] as const) {
      const f = priceFigures(parametricQuote({ floors: fl, stairwells: st, apartments: ap }));
      for (const mode of ["digits", "grouped", "words"] as const) {
        const ru = renderBoth(PHRASES, "price_range", { ru: pricePlaceholders(f, "ru", mode), lv: pricePlaceholders(f, "lv", mode) }).say_ru;
        expect(ru).toMatch(/^Ориентировочно /);
        expect(ru).toContain(" без НДС, или от ");
        expect(ru).toContain(" с НДС двадцать один процент — это примерно ");
        expect(ru.endsWith("Точную цену даст инженер после бесплатного осмотра.")).toBe(true);
        expect(ru, `${fl}/${st}/${ap}`).not.toMatch(/\d/);
      }
    }
  });
});

describe("copy: RU templates hold no digits; LV templates unchanged", () => {
  it("no digit in any RU phrase (outside the {placeholders})", () => {
    for (const [k, v] of Object.entries(PHRASES)) expect(v.ru.replace(/\{[a-z0-9_]+\}/g, ""), k).not.toMatch(/\d/);
  });
  it("the changed keys keep their Latvian text byte for byte", () => {
    expect(PHRASES.price_range.lv).toBe(
      "Orientējoši jūsu mājai — no {low_net} līdz {high_net} eiro bez PVN, tas ir no {low_gross} līdz {high_gross} eiro ar PVN 21%, aptuveni {per_apt_gross} eiro uz vienu dzīvokli ar PVN. Precīzu cenu noteiks inženieris pēc bezmaksas apsekošanas.",
    );
    expect(PHRASES.slots_offer.lv).toBe("Bezmaksas apsekošanai brīvie laiki: {slot1}, {slot2} vai {slot3}. Kurš laiks jums der?");
    expect(PHRASES.works_found.lv).toBe("Dzīvoklis {apartment}, {stairwell}. kāpņu telpa: darbi pēc grafika paredzēti — {date}, {window}. Vai vēlaties šo laiku pārcelt?");
    expect(PHRASES.callback_ok.lv).toBe("Labi, jūsu lūgumu esmu nodevusi — jums piezvanīs darba laikā, no pirmdienas līdz piektdienai no 9 līdz 17.");
  });
  it("callback_ok names the office hours in words", () => {
    expect(PHRASES.callback_ok.ru).toBe("Хорошо, я передала вашу просьбу — вам перезвонят в рабочее время, с понедельника по пятницу, с девяти утра до пяти вечера.");
    expect(PHRASES.callback_ok.ru).toContain(windowSpokenRu("09:00-17:00"));
  });
});
