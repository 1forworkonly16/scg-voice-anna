// Spoken Russian through the real Worker routes: the exact sentences Anna reads, no digits outside the address,
// Latvian unchanged, text channels (Calendar, Sheet, Telegram) still with digits.
import { describe, expect, it } from "vitest";
import { demoWorksRows } from "../../src/lib/works";
import { base, bookingBody, harness } from "./helpers";

type H = Awaited<ReturnType<typeof harness>>;

/** Tuesday 2026-10-06 11:00 Riga: the first free slots are Wed 7, Thu 8 and Fri 9 October. */
const TUE = new Date("2026-10-06T08:00:00Z");
const ILUKSTES = "varis-101117924";
const PARAUGA = "demo-parauga-iela-7";

const seedWorks = (h: H, today: string, window?: string) => {
  const rows = demoWorksRows(today, PARAUGA);
  h.world.tabs.Works = rows.map((w) => [w.building_id, w.address_lv, w.stairwell, w.apt_from, w.apt_to, w.start_date, w.end_date, w.apts_per_day, window ?? w.window, w.foreman_label, w.status, ""]);
};

async function tuesday(opts = {}, env = {}): Promise<H> {
  const h = await harness(opts, env);
  h.now.value = TUE;
  return h;
}

describe("the exact sentences (Tuesday 6 October)", () => {
  it("get_slots: three slots, month named once; today in the nominative; tool labels with the full date", async () => {
    const h = await tuesday();
    const r = await h.call("get_slots", base("e1"));
    expect(r.body.say_ru).toBe(
      "Для бесплатного осмотра свободно: в среду, седьмого октября, в девять утра; в четверг, восьмого, в час дня; или в пятницу, девятого, в девять утра. Какое время вам удобнее?",
    );
    expect(r.body.today.label_ru).toBe("вторник, шестое октября");
    expect(r.body.slots.map((s: { label_ru: string }) => s.label_ru)).toEqual([
      "в среду, седьмого октября, в девять утра",
      "в четверг, восьмого октября, в час дня",
      "в пятницу, девятого октября, в девять утра",
    ]);
    expect(r.body.say_lv).toBe(
      "Bezmaksas apsekošanai brīvie laiki: trešdien, 7. oktobrī, plkst. 9.00, ceturtdien, 8. oktobrī, plkst. 13.00 vai piektdien, 9. oktobrī, plkst. 9.00. Kurš laiks jums der?",
    );
    expect(r.body.today.label_lv).toBe("otrdien, 6. oktobrī");
  });

  it("book_inspection: booking_ok with the full date; Calendar, Telegram and Sheet keep digits", async () => {
    const h = await tuesday();
    const r = await h.call("book_inspection", bookingBody("e-book", { slot_start: "2026-10-08T13:00:00+03:00", building_id: ILUKSTES }));
    expect(r.body.ok).toBe(true);
    expect(r.body.say_ru).toBe(
      "Готово, я записала вас на бесплатный осмотр: Ilūkstes iela 16, в четверг, восьмого октября, в час дня. Пожалуйста, запишите это время — это и есть ваше подтверждение.",
    );
    expect(r.body.slot.label_ru).toBe("в четверг, восьмого октября, в час дня");
    expect(r.body.say_lv).toBe(
      "Esmu jūs pierakstījusi bezmaksas apsekošanai: Ilūkstes iela 16, ceturtdien, 8. oktobrī, plkst. 13.00. Lūdzu, pierakstiet šo laiku — tas ir jūsu apstiprinājums.",
    );
    await h.flush();
    const ev = [...h.world.events.values()][0]!;
    expect(ev.summary).toBe("Осмотр: Ilūkstes iela 16 · 9 эт., 4 под. [ДЕМО]");
    expect(ev.description).toContain("Бесплатный осмотр: четверг, 8 октября, 13:00");
    expect(ev.description).toContain("Ориентировочно: 72 000–112 000 евро без НДС, 87 000–135 000 евро с НДС 21%."); // grouped with NBSP
    expect(h.world.telegram[0]!.text).toContain("осмотр четверг, 8 октября, 13:00");
    expect(h.world.tabs.Leads[0]).toContain("2026-10-08 13:00");
    // the replay returns the same spoken confirmation
    const again = await h.call("book_inspection", bookingBody("e-book", { slot_start: "2026-10-08T13:00:00+03:00", building_id: ILUKSTES }));
    expect(again.body).toMatchObject({ ok: true, replayed: true, say_ru: r.body.say_ru, slot: { label_ru: "в четверг, восьмого октября, в час дня" } });
  });

  it("book_inspection moved to another slot: Telegram «Было» keeps digits", async () => {
    const h = await tuesday();
    await h.call("book_inspection", bookingBody("e-move", { slot_start: "2026-10-08T13:00:00+03:00" }));
    const b = await h.call("book_inspection", bookingBody("e-move", { slot_start: "2026-10-09T10:00:00+03:00" }));
    expect(b.body.say_ru).toBe(
      "Готово, я записала вас на бесплатный осмотр: Илукстес 16, в пятницу, девятого октября, в десять утра. Пожалуйста, запишите это время — это и есть ваше подтверждение.",
    );
    await h.flush();
    expect(h.world.telegram[1]!.text).toContain("Было: четверг, 8 октября, 13:00");
    expect(h.world.telegram[1]!.text).toContain("осмотр пятница, 9 октября, 10:00");
  });

  it("slot_taken: «…свободно ещё: {alt1} или {alt2}. Что вам удобнее?»", async () => {
    const h = await tuesday({ extraBusy: [{ start: "2026-10-08T13:00:00+03:00", end: "2026-10-08T14:00:00+03:00" }] });
    const r = await h.call("book_inspection", bookingBody("e-taken", { slot_start: "2026-10-08T13:00:00+03:00" }));
    expect(r.body.error.code).toBe("slot_taken");
    expect(r.body.say_ru).toBe(
      "К сожалению, это время только что заняли; свободно ещё: в четверг, восьмого октября, в двенадцать часов дня или в четверг, восьмого, в два часа дня. Что вам удобнее?",
    );
    expect(r.body.alternatives.map((a: { label_ru: string }) => a.label_ru)).toEqual(["в четверг, восьмого октября, в двенадцать часов дня", "в четверг, восьмого октября, в два часа дня"]);
    expect(r.body.say_lv).toBe(
      "Diemžēl šis laiks tikko kļuva aizņemts; vēl ir pieejami: ceturtdien, 8. oktobrī, plkst. 12.00 vai ceturtdien, 8. oktobrī, plkst. 14.00. Kurš jums ērtāk?",
    );
  });

  it("slots_offer_two (invalid_slot) and slots_offer_one", async () => {
    const h = await tuesday();
    const two = await h.call("book_inspection", bookingBody("e-bad", { slot_start: "2026-10-07T09:30:00+03:00" }));
    expect(two.body.error.code).toBe("invalid_slot");
    expect(two.body.say_ru).toBe("Для бесплатного осмотра свободно: в среду, седьмого октября, в девять утра или в четверг, восьмого, в час дня. Какое время вам удобнее?");
    expect(two.body.say_lv).toBe("Bezmaksas apsekošanai brīvie laiki: trešdien, 7. oktobrī, plkst. 9.00 vai ceturtdien, 8. oktobrī, plkst. 13.00. Kurš laiks jums der?");

    const busy = [
      { start: "2026-10-06T00:00:00+03:00", end: "2026-10-09T09:00:00+03:00" },
      { start: "2026-10-09T10:00:00+03:00", end: "2026-10-31T00:00:00+02:00" },
    ];
    const h1 = await tuesday({ extraBusy: busy });
    const one = await h1.call("get_slots", base("e-one"));
    expect(one.body.say_ru).toBe("Для бесплатного осмотра сейчас свободно только одно время: в пятницу, девятого октября, в девять утра. Вам подходит?");
    expect(one.body.say_lv).toBe("Bezmaksas apsekošanai šobrīd brīvs tikai viens laiks: piektdien, 9. oktobrī, plkst. 9.00. Vai jums der?");
  });

  it("lookup_building: facts in words with the noun's gender", async () => {
    const h = await tuesday();
    const r = await h.call("lookup_building", { ...base("e-l"), address: "Илукстес 16" });
    expect(r.body.say_ru).toBe("Нашла: Ilūkstes iela 16 — девять этажей, четыре подъезда и сто сорок одна квартира. Верно?");
    expect(r.body.say_lv).toBe("Atradu: Ilūkstes iela 16 — 9 stāvi, 4 kāpņu telpas un 141 dzīvoklis. Vai pareizi?");
  });

  it("quote_range 9 / 4 / 141: genitive bounds, one «тысяч», net and incl. VAT, per apartment", async () => {
    const h = await tuesday();
    const r = await h.call("quote_range", { ...base("e-q"), floors: 9, stairwells: 4, apartments: 141 });
    expect(r.body.say_ru).toBe(
      "Ориентировочно для вашего дома — от семидесяти двух до ста двенадцати тысяч евро без НДС, или от восьмидесяти семи до ста тридцати пяти тысяч с НДС двадцать один процент — это примерно семьсот восемьдесят евро на квартиру с НДС. Точную цену даст инженер после бесплатного осмотра.",
    );
    expect(r.body.figures).toEqual({ low_net: 72000, high_net: 112000, low_gross: 87000, high_gross: 135000, per_apt_gross: 780 });
    expect(r.body.say_lv).toBe(
      "Orientējoši jūsu mājai — no 72000 līdz 112000 eiro bez PVN, tas ir no 87000 līdz 135000 eiro ar PVN 21%, aptuveni 780 eiro uz vienu dzīvokli ar PVN. Precīzu cenu noteiks inženieris pēc bezmaksas apsekošanas.",
    );
  });

  it("quote_range below 10 000: full genitive numbers", async () => {
    const h = await tuesday();
    const r = await h.call("quote_range", { ...base("e-q2"), floors: 2, stairwells: 1, apartments: 2 });
    expect(r.body.say_ru).toBe(
      "Ориентировочно для вашего дома — от четырёх тысяч трёхсот до семи тысяч девятисот евро без НДС, или от пяти тысяч трёхсот до девяти тысяч шестисот с НДС двадцать один процент — это примерно три тысячи четыреста семьдесят евро на квартиру с НДС. Точную цену даст инженер после бесплатного осмотра.",
    );
  });

  it("find_works_schedule, its options and reschedule_access; Telegram keeps digits", async () => {
    const h = await tuesday();
    seedWorks(h, "2026-10-06", "09:00-13:00");
    const f = await h.call("find_works_schedule", { ...base("e-w"), apartment: 12, address: "Parauga iela 7" });
    expect(f.body.say_ru).toBe(
      "Квартира двенадцать, первый подъезд: работы у вас по графику — в среду, четырнадцатого октября, с девяти утра до часа дня. Хотите перенести это время?",
    );
    expect(f.body.say_lv).toBe(
      "Dzīvoklis 12, 1. kāpņu telpa: darbi pēc grafika paredzēti — trešdien, 14. oktobrī, no plkst. 9.00 līdz 13.00. Vai vēlaties šo laiku pārcelt?",
    );
    expect(f.body.options).toEqual([
      { date: "2026-10-12", window: "09:00-13:00", label_ru: "в понедельник, двенадцатого октября, с девяти утра до часа дня", label_lv: "pirmdien, 12. oktobrī, no plkst. 9.00 līdz 13.00" },
      { date: "2026-10-13", window: "09:00-13:00", label_ru: "во вторник, тринадцатого октября, с девяти утра до часа дня", label_lv: "otrdien, 13. oktobrī, no plkst. 9.00 līdz 13.00" },
      { date: "2026-10-15", window: "13:00-17:00", label_ru: "в четверг, пятнадцатого октября, с часа дня до пяти вечера", label_lv: "ceturtdien, 15. oktobrī, no plkst. 13.00 līdz 17.00" },
    ]);
    const r = await h.call("reschedule_access", { ...base("e-w"), building_id: PARAUGA, apartment: 12, new_date: "2026-10-15", new_window: "13:00-17:00" });
    expect(r.body.say_ru).toBe(
      "Готово, новое время доступа в вашу квартиру — в четверг, пятнадцатого октября, с часа дня до пяти вечера. Я записала это в график работ.",
    );
    expect(r.body.say_lv).toBe("Labi, jaunais piekļuves laiks jūsu dzīvoklim — ceturtdien, 15. oktobrī, no plkst. 13.00 līdz 17.00. Esmu to ierakstījusi darbu grafikā.");
    await h.flush();
    const t = h.world.telegram[0]!.text;
    expect(t).toContain("подъезд 1, кв. 12");
    expect(t).toContain("Было: среда, 14 октября, с 9:00 до 13:00");
    expect(t).toContain("Стало: четверг, 15 октября, с 13:00 до 17:00");
    expect(h.world.tabs.Access[0]).toContain("2026-10-15");
  });

  it("find_works_schedule: the default works window «с девяти утра до пяти вечера»; stairwells two and three", async () => {
    const h = await tuesday();
    seedWorks(h, "2026-10-06");
    const a = await h.call("find_works_schedule", { ...base("e-w2"), apartment: 3, building_id: PARAUGA });
    expect(a.body.say_ru).toBe(
      "Квартира три, первый подъезд: работы у вас по графику — в понедельник, двенадцатого октября, с девяти утра до пяти вечера. Хотите перенести это время?",
    );
    const b = await h.call("find_works_schedule", { ...base("e-w2"), apartment: 31, building_id: PARAUGA });
    expect(b.body.say_ru).toMatch(/^Квартира тридцать один, второй подъезд: работы у вас по графику — /);
    const c = await h.call("find_works_schedule", { ...base("e-w2"), apartment: 61, building_id: PARAUGA });
    expect(c.body.say_ru).toMatch(/^Квартира шестьдесят один, третий подъезд: /);
  });

  it("request_callback: office hours in words", async () => {
    const h = await tuesday();
    const r = await h.call("request_callback", { ...base("e-cb"), reason: "human_requested", summary_ru: "Хочет поговорить с человеком.", phone: "29327275" });
    expect(r.body.say_ru).toBe("Хорошо, я передала вашу просьбу — вам перезвонят в рабочее время, с понедельника по пятницу, с девяти утра до пяти вечера.");
    expect(r.body.say_lv).toBe("Labi, jūsu lūgumu esmu nodevusi — jums piezvanīs darba laikā, no pirmdienas līdz piektdienai no 9 līdz 17.");
    await h.flush();
    expect(h.world.telegram[0]!.text).toContain("Перезвонить в рабочее время, пн–пт 9:00–17:00.");
  });
});

// ---------- no digits outside the address, for every M1 tool ----------

const ADDRESSES = ["Ilūkstes iela 16", "Parauga iela 7", "Илукстес 16"];

/** say_ru plus every label_ru anywhere in the body. */
function spokenRu(body: Record<string, unknown>): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (k === "label_ru" && typeof x === "string") out.push(x);
        else walk(x);
      }
    }
  };
  if (typeof body.say_ru === "string") out.push(body.say_ru);
  walk(body);
  return out;
}

const withoutAddresses = (s: string) => ADDRESSES.reduce((t, a) => t.split(a).join("‹addr›"), s);

const M1_TOOLS = ["lookup_building", "quote_range", "get_slots", "book_inspection", "find_works_schedule", "reschedule_access", "request_callback"] as const;
type M1 = (typeof M1_TOOLS)[number];

/** Several paths per tool (success and errors). */
async function exercise(h: H, today: string): Promise<{ tool: M1; texts: string[] }[]> {
  const out: { tool: M1; texts: string[] }[] = [];
  const call = async (tool: M1, body: unknown) => {
    const r = await h.call(tool, body);
    out.push({ tool, texts: spokenRu(r.body) });
    return r;
  };
  for (const address of ["Илукстес 16", "Parauga iela 7", "Ilūkstes iela", "Abrakadabra iela 99"]) await call("lookup_building", { ...base("n1"), address });
  for (const [floors, stairwells, apartments] of [[9, 4, 141], [5, 2, 40], [2, 1, 2], [16, 12, 1400], [40, 30, 2000], [1, 1, 1], [12, 6, 121]]) {
    await call("quote_range", { ...base("n1"), floors, stairwells, apartments });
  }
  await call("quote_range", { ...base("n1"), floors: "x" });
  const slots = await call("get_slots", base("n1"));
  for (const weekday of ["mon", "tue", "wed", "thu", "fri"]) await call("get_slots", { ...base("n1"), weekday });
  for (const part_of_day of ["morning", "afternoon"]) await call("get_slots", { ...base("n1"), part_of_day });
  const starts: string[] = slots.body.slots.map((s: { start: string }) => s.start);
  await call("book_inspection", bookingBody("n-b1", { slot_start: starts[0], building_id: ILUKSTES }));
  await call("book_inspection", bookingBody("n-b1", { slot_start: starts[0], building_id: ILUKSTES })); // replay
  await call("book_inspection", bookingBody("n-b1", { slot_start: starts[1] })); // move
  await call("book_inspection", bookingBody("n-b2", { slot_start: starts[1] })); // taken by n-b1
  await call("book_inspection", bookingBody("n-b3", { slot_start: starts[2]!.replace(":00:00", ":30:00") })); // invalid
  await call("book_inspection", bookingBody("n-b4", { phone: "123456" }));
  seedWorks(h, today);
  for (const apartment of [1, 12, 30, 31, 61, 90, 999]) await call("find_works_schedule", { ...base("n-w"), apartment, address: "Parauga iela 7" });
  const f = await call("find_works_schedule", { ...base("n-w"), apartment: 12, building_id: PARAUGA });
  for (const o of f.body.options as { date: string; window: string }[]) {
    await call("reschedule_access", { ...base(`n-r-${o.date}`), building_id: PARAUGA, apartment: 12, new_date: o.date, new_window: o.window });
  }
  await call("find_works_schedule", { ...base("n-w"), apartment: 12, building_id: PARAUGA }); // after the move
  await call("reschedule_access", { ...base("n-r"), building_id: PARAUGA, apartment: 12, new_date: "2027-02-02", new_window: "09:00-13:00" });
  await call("reschedule_access", { ...base("n-r"), building_id: "nope", apartment: 12, new_date: "2026-10-13", new_window: "09:00-13:00" });
  await call("request_callback", { ...base("n-c"), reason: "human_requested", summary_ru: "Перезвонить.", phone: "29327275" });
  await call("request_callback", { ...base("n-c"), reason: "x", summary_ru: "y", phone: "123456" });
  await h.flush();
  return out;
}

describe("say_ru and label_ru hold no digits outside the address", () => {
  const DAYS: [string, string][] = [
    ["2026-10-05T08:00:00Z", "2026-10-05"], // Monday
    ["2026-10-06T08:00:00Z", "2026-10-06"], // Tuesday
    ["2026-10-28T08:00:00Z", "2026-10-28"], // offers cross into November (and the DST change)
    ["2026-12-21T09:00:00Z", "2026-12-21"], // Christmas and New Year holidays
  ];
  for (const [iso, today] of DAYS) {
    it(`every M1 tool, every NUMBER_MODE, now ${iso}`, async () => {
      const seen = new Set<M1>();
      let ruByMode: string | null = null;
      for (const mode of ["digits", "words", "grouped"]) {
        const h = await harness({}, { NUMBER_MODE: mode });
        h.now.value = new Date(iso);
        const results = await exercise(h, today);
        for (const { tool, texts } of results) {
          seen.add(tool);
          expect(texts.length, tool).toBeGreaterThan(0);
          for (const t of texts) expect(withoutAddresses(t), `${tool}: ${t}`).not.toMatch(/\d/);
        }
        const ru = JSON.stringify(results);
        if (ruByMode === null) ruByMode = ru;
        else expect(ru, `RU speech differs under NUMBER_MODE=${mode}`).toBe(ruByMode);
      }
      expect([...seen].sort()).toEqual([...M1_TOOLS].sort());
    });
  }
});
