// The 7 M1 tool handlers. Pure business flow over Deps (fetch, clock, limits, waitUntil); every handler returns an envelope body.
// Subrequest budget (token cached: -1): lookup 0 (+1 pre-warm), quote 0, get_slots 2, book 5 (409 replay 4, move 5 + background),
// find_works 2, reschedule 4, callback 3.
import type { ToolInput } from "../contract";
import searchRaw from "../data/riga_buildings_search.json";
import { buildAddressIndex, loadSearchIndex, matchAddress, type AddressIndex, type AddressEntry } from "../lib/address";
import { displayAddress, toBuilding, type BuildingRecord } from "../lib/buildings";
import { normalizePhone } from "../lib/phone";
import { PRICE_MODEL_VERSION, parametricQuote, type QuoteInput } from "../lib/quote";
import {
  alternativesFor,
  checkSlot,
  findSlots,
  horizonDate,
  officeOpenNow,
  pickOffers,
  freeSlots,
  type BusyInterval,
  type Slot as GridSlot,
} from "../lib/slots";
import {
  apartmentSpokenRu,
  buildingFacts,
  dayAtRu,
  dayLabel,
  priceFigures,
  pricePlaceholders,
  slotLabel,
  slotListRu,
  slotSpokenRu,
  stairwellSpokenRu,
  todayLabel,
  windowLabel,
  windowSpokenRu,
} from "../lib/speech";
import { addressSpokenRu, streetSpokenMode, streetSpokenRu } from "../lib/street_ru";
import { rigaLocalToUtc, rigaYmd, toRigaIso, type Lang } from "../lib/time";
import type { NumberMode } from "../lib/words";
import {
  apartmentSchedule,
  rescheduleOptions,
  validateReschedule,
  type AccessRow,
  type WorksRow,
} from "../lib/works";
import { freeBusy, getEvent, inspectionEventId, insertEvent, patchEvent, sameInstant, type EventBody } from "../google/calendar";
import { GoogleError } from "../google/errors";
import { prewarmToken } from "../google/auth";
import { appendRow, readTabs, rowOf } from "../google/sheets";
import { accessMessage, bookingMessage, callbackMessage, priceText, ROLE_RU } from "../notify/messages";
import { sendTelegram } from "../notify/telegram";
import { fail, ok, say, sayGeneric, type Body, type Say } from "./envelope";
import type { Channel, Deps } from "./types";
import { isTestMarker, randomHex, sha256Hex } from "./util";

// ---------- shared ----------

interface Ctx {
  deps: Deps;
  channel: Channel;
}

/** Tool-facing slot: label_ru is spoken words with the full date («в среду, седьмого октября, в девять утра»), label_lv unchanged. */
type Slot = { start: string; label_ru: string; label_lv: string };

const slotOut = (s: GridSlot): Slot => ({ start: s.start, label_ru: s.label_ru, label_lv: s.label_lv });

function slotFromIso(iso: string): Slot {
  const d = new Date(Date.parse(iso));
  return { start: toRigaIso(d), label_ru: slotSpokenRu(d), label_lv: slotLabel(d, "lv") };
}

/** NUMBER_MODE applies to LV speech only; RU speech is always words (see lib/speech.ts). */
function numberMode(deps: Deps): NumberMode {
  const m = deps.env.NUMBER_MODE;
  return m === "words" || m === "grouped" ? m : "digits";
}

/**
 * RU_STREET_SPOKEN=cyrillic: say_ru speaks a street address as Russian words («улица Илукстес, дом шестнадцать», lib/street_ru.ts).
 * Only the say_ru placeholders go through these two; say_lv, the Sheet, the Calendar, Telegram and the structured fields keep the Latin address.
 */
const ruAddress = (deps: Deps, address: string): string => (streetSpokenMode(deps.env.RU_STREET_SPOKEN) === "cyrillic" ? addressSpokenRu(address) : address);
const ruStreet = (deps: Deps, street: string): string => (streetSpokenMode(deps.env.RU_STREET_SPOKEN) === "cyrillic" ? streetSpokenRu(street) : street);

let indexCache: AddressIndex<AddressEntry> | null = null;
export function addressIndex(): AddressIndex<AddressEntry> {
  indexCache ??= buildAddressIndex(loadSearchIndex(searchRaw));
  return indexCache;
}

function entryById(id: string | undefined): AddressEntry | undefined {
  if (!id) return undefined;
  for (const g of addressIndex().streets) for (const it of g.items) if (it.entry.id === id) return it.entry;
  return undefined;
}

const asRecord = (e: AddressEntry): BuildingRecord => e as unknown as BuildingRecord;

/**
 * Value of the `consent` column in Leads and Callbacks: the legal basis for storing the name and phone, no longer a yes/no.
 * Since 2026-10-06 it is the caller's own request (GDPR Art. 6(1)(b)); Anna asks no consent question. A lawyer confirms before the pilot.
 */
const CONTACT_BASIS = "request";

/** What the Leads row, the Telegram text and the Calendar description show when the caller gave no name (the name is optional in book_inspection). */
const NAME_NOT_GIVEN = "—";

/** Hint for the agent after a phone number that does not parse (book_inspection, request_callback). */
const INVALID_PHONE_HINT = "Ask the caller to repeat the phone number, check the 8 digits, then read it back in the caller's groups.";

/** Google failures: the calendar-flavoured tools tell the caller the calendar is down; others a generic hiccup. */
export function googleFailure(e: unknown, calendar: boolean): Body {
  const kind = e instanceof GoogleError ? e.kind : "network";
  const message = e instanceof Error ? e.message.slice(0, 120) : "error";
  if (calendar) {
    return fail("calendar_down", say("calendar_down", { ru: {}, lv: {} }), "The calendar is not answering. Do not confirm any booking; offer a callback with request_callback.", {}, `${kind}: ${message}`);
  }
  return fail("internal_error", sayGeneric(), "Technical problem. Apologise and offer a callback with request_callback.", {}, `${kind}: ${message}`);
}

/** RU labels for one spoken list: the month only for the first slot and when it changes («…седьмого октября…; в четверг, восьмого, …»). */
const spokenListRu = (slots: readonly Slot[]): string[] => slotListRu(slots.map((s) => new Date(Date.parse(s.start))));

function slotsPhrase(slots: Slot[]): Say {
  const [a, b, c] = slots;
  const [r1, r2, r3] = spokenListRu(slots);
  if (a && b && c) return say("slots_offer", { ru: { slot1: r1!, slot2: r2!, slot3: r3! }, lv: { slot1: a.label_lv, slot2: b.label_lv, slot3: c.label_lv } });
  if (a && b) return say("slots_offer_two", { ru: { slot1: r1!, slot2: r2! }, lv: { slot1: a.label_lv, slot2: b.label_lv } });
  if (a) return say("slots_offer_one", { ru: { slot1: r1! }, lv: { slot1: a.label_lv } });
  return say("no_slots", { ru: {}, lv: {} });
}

// ---------- lookup_building ----------

export async function lookupBuilding(c: Ctx, input: ToolInput<"lookup_building">): Promise<Body> {
  prewarmToken(c.deps); // the next calls (get_slots / book) need a Google token
  const mode = numberMode(c.deps);
  const r = matchAddress(input.address, addressIndex());
  const b = r.building ? toBuilding(asRecord(r.building)) : null;
  const candidates = r.candidates.map((e) => toBuilding(asRecord(e)));
  const fields = { status: r.status, confidence: r.confidence, building: b, candidates, street: r.street };

  if (r.status === "found" && b) {
    const factsRu = buildingFacts(b, "ru", mode);
    const factsLv = buildingFacts(b, "lv", mode);
    if (factsRu && factsLv) {
      return ok(say("building_found", { ru: { address: ruAddress(c.deps, b.address), facts: factsRu }, lv: { address: b.address, facts: factsLv } }), "Say the sentence and wait for the caller to confirm the address. Speak only the facts in it.", fields);
    }
    return ok(say("building_confirm", { ru: { address: ruAddress(c.deps, b.address) }, lv: { address: b.address } }), "The building is known but has no facts that may be spoken: confirm the address, then ask floors, stairwells and apartments.", fields);
  }
  if (r.status === "confirm") {
    const list = b ? [b] : candidates;
    const ru = list.map((x) => ruAddress(c.deps, x.address)).join(" или ");
    const lv = list.map((x) => x.address).join(" vai ");
    return ok(say("building_confirm", { ru: { address: ru }, lv: { address: lv } }), "Ask the caller to confirm which address is meant. If the caller corrects it, call lookup_building again.", fields);
  }
  if (r.status === "need_house") {
    const street = r.street ?? "";
    return ok(say("building_need_house", { ru: { street: ruStreet(c.deps, street) }, lv: { street } }), "Ask for the house number, then call lookup_building again with the full address.", fields);
  }
  return ok(say("building_not_found", { ru: {}, lv: {} }), "The address is not in the list. Ask floors, stairwells and approximate apartments; do not invent building facts.", fields);
}

// ---------- quote_range ----------

export async function quoteRange(c: Ctx, input: ToolInput<"quote_range">): Promise<Body> {
  const q: QuoteInput = {
    floors: input.floors,
    stairwells: input.stairwells,
    apartments: input.apartments,
    scope: input.scope,
    horizontals: input.horizontals,
    sewer_outlet: input.sewer_outlet,
    pump_station: input.pump_station,
    options: input.options,
  };
  let quote;
  try {
    quote = parametricQuote(q);
  } catch (e) {
    return fail("invalid_input", sayGeneric(), "The numbers could not be priced; ask the caller to repeat floors, stairwells and apartments.", {}, e instanceof Error ? e.message.slice(0, 120) : "bad input");
  }
  const f = priceFigures(quote);
  const mode = numberMode(c.deps);
  const s = say("price_range", { ru: pricePlaceholders(f, "ru", mode), lv: pricePlaceholders(f, "lv", mode) });
  return ok(s, "Read the sentence exactly; never add, round or compute any number yourself. Offer the free inspection next.", {
    model_version: PRICE_MODEL_VERSION,
    range: { low: quote.range.low, base: quote.range.base, high: quote.range.high },
    per_apartment_gross: quote.per_apartment_gross,
    figures: { low_net: f.low_net, high_net: f.high_net, low_gross: f.low_gross, high_gross: f.high_gross, per_apt_gross: f.per_apt_gross },
  });
}

// ---------- get_slots ----------

const WEEKDAYS: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5 };

function busyWindow(now: Date): { from: Date; to: Date } {
  return { from: now, to: rigaLocalToUtc(horizonDate(now), "23:59") };
}

export async function getSlots(c: Ctx, input: ToolInput<"get_slots">): Promise<Body> {
  const now = c.deps.now();
  let busy: BusyInterval[];
  try {
    const w = busyWindow(now);
    busy = await freeBusy(c.deps, w.from, w.to);
  } catch (e) {
    return googleFailure(e, true);
  }
  const res = findSlots({
    now,
    busy,
    weekdays: input.weekday ? [WEEKDAYS[input.weekday]!] : undefined,
    dateFrom: input.date_from,
    dateTo: input.date_to,
    partOfDay: input.part_of_day,
  });
  const slots = res.offers.map(slotOut);
  return ok(slotsPhrase(slots), slots.length ? "Offer these times; when the caller chooses, pass the chosen slot's start unchanged to book_inspection." : "No free time: offer a callback with request_callback.", {
    today: { date: rigaYmd(now), label_ru: todayLabel(now, "ru"), label_lv: todayLabel(now, "lv") },
    office_open_now: officeOpenNow(now),
    slots,
    filter_relaxed: res.relaxed,
  });
}

// ---------- book_inspection ----------

function eventTexts(p: { isTest: boolean; address: string; floors: number; stairwells: number; apartments: number; roleRu: string; name: string; phone: string; notes?: string; unknown: string[]; priceTextRu: string | null; id: string; slotRu: string }): { summary: string; description: string } {
  const summary = `${p.isTest ? "[TEST] " : ""}Осмотр: ${p.address} · ${p.floors} эт., ${p.stairwells} под. [ДЕМО]`;
  const lines = [
    `Бесплатный осмотр: ${p.slotRu}`,
    `Адрес: ${p.address}`,
    `Дом: ${p.floors} эт., ${p.stairwells} под., ${p.apartments} кв.`,
    `Звонил(а): ${p.roleRu}, ${p.name}, ${p.phone}`,
  ];
  if (p.notes) lines.push(`Системы и заметки: ${p.notes}`);
  if (p.priceTextRu) lines.push(p.priceTextRu);
  if (p.unknown.length) lines.push(`Вопросы для инженера:\n${p.unknown.map((q) => `- ${q}`).join("\n")}`);
  lines.push(`ID заявки: ${p.id}`, "Записала ИИ-ассистент Анна");
  return { summary, description: lines.join("\n") };
}

export async function bookInspection(c: Ctx, input: ToolInput<"book_inspection">): Promise<Body> {
  const { deps } = c;
  const phone = normalizePhone(input.phone);
  if (!phone) return fail("invalid_phone", say("invalid_phone", { ru: {}, lv: {} }), INVALID_PHONE_HINT);
  const callerName = input.name?.trim() || undefined; // empty or blank = the caller gave none
  const nameText = callerName ?? NAME_NOT_GIVEN;

  const now = deps.now();
  let busy: BusyInterval[];
  try {
    const w = busyWindow(now);
    busy = await freeBusy(deps, w.from, w.to);
  } catch (e) {
    return googleFailure(e, true);
  }
  const eventId = await inspectionEventId(input.conversation_id);
  const bookingId = `B-${eventId.slice(0, 8).toUpperCase()}`;
  const isTest = isTestMarker(input.conversation_id, callerName);
  const entry = entryById(input.building_id);
  const address = entry ? displayAddress(asRecord(entry)) : input.address_spoken.trim();

  const check = checkSlot(input.slot_start, now, busy);
  if (!check.ok) {
    if (check.reason === "invalid_slot") {
      const alts = pickOffers(freeSlots(now, busy), 2).map(slotOut);
      return fail("invalid_slot", slotsPhrase(alts), "That time is not a valid inspection slot. Offer these instead, then call book_inspection with the chosen start.", { alternatives: alts });
    }
    // slot busy: it may be this very conversation's own event (idempotent replay)
    try {
      const existing = await getEvent(deps, eventId);
      if (existing && existing.status !== "cancelled" && sameInstant(existing.start?.dateTime, input.slot_start)) {
        return bookedOk(deps, bookingId, slotFromIso(input.slot_start), address, true);
      }
    } catch (e) {
      return googleFailure(e, true);
    }
    const alts = alternativesFor(input.slot_start, now, busy, 2).map(slotOut);
    const [a, b] = alts;
    const [r1, r2] = spokenListRu(alts);
    const s = a && b ? say("slot_taken", { ru: { alt1: r1!, alt2: r2! }, lv: { alt1: a.label_lv, alt2: b.label_lv } }) : slotsPhrase(alts);
    return fail("slot_taken", s, "The slot was taken. Offer the alternatives and call book_inspection again with the chosen start.", { alternatives: alts });
  }

  const slot = check.slot;
  const price = priceText({ floors: input.floors, stairwells: input.stairwells, apartments: input.apartments, scope: input.scope });
  const unknown = input.unknown_questions ?? [];
  const roleRu = ROLE_RU[input.caller_role] ?? input.caller_role;
  const texts = eventTexts({
    isTest, address, floors: input.floors, stairwells: input.stairwells, apartments: input.apartments, roleRu,
    name: nameText, phone, notes: input.notes, unknown, priceTextRu: price?.text ?? null, id: bookingId, slotRu: slot.text_ru,
  });
  const body: EventBody = { ...texts, startIso: slot.start, endIso: slot.end, conversationId: input.conversation_id, leadId: bookingId, isTest };

  let movedFromRu: string | undefined;
  try {
    const out = await insertEvent(deps, eventId, body);
    if (out.kind === "exists") {
      const existing = await getEvent(deps, eventId);
      if (!existing) return googleFailure(new GoogleError("http", "event vanished after 409"), true);
      if (existing.status !== "cancelled" && sameInstant(existing.start?.dateTime, slot.start)) {
        return bookedOk(deps, bookingId, slotOut(slot), address, true); // same slot: return the existing booking
      }
      // different slot: the slot was re-checked above (freeBusy) -> move the event
      const wasMs = existing.start?.dateTime ? Date.parse(existing.start.dateTime) : NaN;
      const was = Number.isFinite(wasMs) ? slotLabel(new Date(wasMs), "ru") : ""; // Telegram text: digits
      await patchEvent(deps, eventId, body);
      movedFromRu = was || "ранее записанное время";
    }
  } catch (e) {
    return googleFailure(e, true);
  }

  // Telegram (+ the Leads row for a new booking) after the answer
  const msg = bookingMessage({
    id: bookingId, isTest, address, floors: input.floors, stairwells: input.stairwells, apartments: input.apartments, roleRu,
    slotRu: slot.text_ru, name: nameText, phone, notes: input.notes, price, unknown, movedFromRu,
  });
  const jobs: Promise<unknown>[] = [sendTelegram(deps, msg, isTest)];
  if (!movedFromRu) {
    jobs.push(
      appendRow(
        deps,
        "Leads",
        rowOf("Leads", {
          timestamp: now.toISOString(), channel: c.channel, language: input.language, role: roleRu, address, building_id: input.building_id ?? "",
          floors: input.floors, apartments: input.apartments, stairwells: input.stairwells, scope: input.scope ?? "risers_complete",
          price_range: price?.short ?? "", name: nameText, phone, consent: CONTACT_BASIS, booked_slot: `${slot.date} ${slot.hm}`,
          status: "inspection_booked", notes: input.notes ?? "", lead_id: bookingId, conversation_id: input.conversation_id,
          calendar_event_id: eventId, unknown_questions: unknown.join(" | "), is_test: isTest ? "TRUE" : "",
        }),
      ),
    );
  }
  deps.waitUntil(Promise.allSettled(jobs));
  return bookedOk(deps, bookingId, slotOut(slot), address, false);
}

function bookedOk(deps: Deps, bookingId: string, slot: Slot, address: string, replayed: boolean): Body {
  const s = say("booking_ok", { ru: { slot: slot.label_ru, address: ruAddress(deps, address) }, lv: { slot: slot.label_lv, address } });
  return ok(s, "Read the sentence. Confirm to the caller only because ok is true; the read-back time is the confirmation. Then end politely.", { booking_id: bookingId, slot, address, replayed });
}

// ---------- works schedule ----------

const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v));
const nz = (v: unknown, d = 0): number => (Number.isFinite(Number(v)) && str(v) !== "" ? Number(v) : d);

export function toWorksRows(rows: Record<string, unknown>[]): WorksRow[] {
  return rows
    .filter((r) => str(r.building_id) !== "")
    .map((r) => ({
      building_id: str(r.building_id), address_lv: str(r.address_lv), stairwell: nz(r.stairwell), apt_from: nz(r.apt_from), apt_to: nz(r.apt_to),
      start_date: str(r.start_date), end_date: str(r.end_date), apts_per_day: nz(r.apts_per_day), window: str(r.window) || "09:00-17:00",
      foreman_label: str(r.foreman_label), status: str(r.status),
    }));
}

export function toAccessRows(rows: Record<string, unknown>[]): AccessRow[] {
  return rows
    .filter((r) => str(r.building_id) !== "")
    .map((r) => ({ building_id: str(r.building_id), apartment: nz(r.apartment), new_date: str(r.new_date), new_window: str(r.new_window), created_at: str(r.created_at) }));
}

function resolveWorksBuilding(input: { building_id?: string; address?: string }): string | null {
  if (input.building_id) return input.building_id;
  if (!input.address) return null;
  const m = matchAddress(input.address, addressIndex());
  return m.building ? m.building.id : null;
}

/** Text form (Telegram; RU digits) and the Latvian spoken form. */
const optionLabel = (date: string, window: string, lang: Lang) => `${dayLabel(date, lang)}, ${windowLabel(window, lang)}`;
/** Spoken RU: «в понедельник, двенадцатого октября, с девяти утра до часа дня». */
const optionSpokenRu = (date: string, window: string) => `${dayAtRu(date)}, ${windowSpokenRu(window)}`;

function worksNotFound(): Body {
  return ok(say("works_not_found", { ru: {}, lv: {} }), "No works schedule for this address and apartment. Offer a callback with request_callback; never guess a date.", {
    found: false, building_id: null, stairwell: null, date: null, window: null, rescheduled: false, options: [],
  });
}

export async function findWorksSchedule(c: Ctx, input: ToolInput<"find_works_schedule">): Promise<Body> {
  const buildingId = resolveWorksBuilding(input);
  if (!buildingId) return worksNotFound();
  let tabs;
  try {
    tabs = await readTabs(c.deps, ["Works", "Access"]);
  } catch (e) {
    return googleFailure(e, false);
  }
  const now = c.deps.now();
  const sched = apartmentSchedule(toWorksRows(tabs.Works ?? []), toAccessRows(tabs.Access ?? []), buildingId, input.apartment);
  if (!sched) return worksNotFound();
  const options = rescheduleOptions(sched, now).map((o) => ({ date: o.date, window: o.window, label_ru: optionSpokenRu(o.date, o.window), label_lv: optionLabel(o.date, o.window, "lv") }));
  const ru = { apartment: apartmentSpokenRu(input.apartment), stairwell: stairwellSpokenRu(sched.stairwell), date: dayAtRu(sched.current_date), window: windowSpokenRu(sched.current_window) };
  const lv = { apartment: input.apartment, stairwell: sched.stairwell, date: dayLabel(sched.current_date, "lv"), window: windowLabel(sched.current_window, "lv") };
  return ok(say("works_found", { ru, lv }), "Read the sentence. If the caller wants another time, offer the options and call reschedule_access with the chosen one.", {
    found: true, building_id: buildingId, stairwell: sched.stairwell, date: sched.current_date, window: sched.current_window, rescheduled: sched.rescheduled, options,
  });
}

export async function rescheduleAccess(c: Ctx, input: ToolInput<"reschedule_access">): Promise<Body> {
  const { deps } = c;
  let tabs;
  try {
    tabs = await readTabs(deps, ["Works", "Access"]);
  } catch (e) {
    return googleFailure(e, false);
  }
  const now = deps.now();
  const sched = apartmentSchedule(toWorksRows(tabs.Works ?? []), toAccessRows(tabs.Access ?? []), input.building_id, input.apartment);
  if (!sched) return fail("not_found", say("works_not_found", { ru: {}, lv: {} }), "No works schedule for this building and apartment. Offer a callback.");
  if (validateReschedule(sched, input.new_date, input.new_window, now)) {
    return fail("invalid_reschedule", say("invalid_reschedule", { ru: {}, lv: {} }), "That date or window is not allowed. Offer the options from find_works_schedule again.");
  }
  const isTest = isTestMarker(input.conversation_id);
  const accessId = `A-${(await sha256Hex(`${input.conversation_id}|access|${input.new_date}|${input.new_window}`)).slice(0, 6).toUpperCase()}`;
  try {
    await appendRow(deps, "Access", rowOf("Access", {
      access_id: accessId, created_at: now.toISOString(), building_id: input.building_id, apartment: input.apartment, new_date: input.new_date,
      new_window: input.new_window, conversation_id: input.conversation_id, is_test: isTest ? "TRUE" : "",
    }));
  } catch (e) {
    return googleFailure(e, false);
  }
  const msg = accessMessage({
    id: accessId, isTest, address: `${sched.row.address_lv} (ДЕМО)`, apartment: input.apartment, stairwell: sched.stairwell,
    fromRu: optionLabel(sched.current_date, sched.current_window, "ru"), toRu: optionLabel(input.new_date, input.new_window, "ru"),
  });
  deps.waitUntil(sendTelegram(deps, msg, isTest));
  const ru = { date: dayAtRu(input.new_date), window: windowSpokenRu(input.new_window) };
  const lv = { date: dayLabel(input.new_date, "lv"), window: windowLabel(input.new_window, "lv") };
  return ok(say("access_rescheduled", { ru, lv }), "Read the sentence and close the topic.", { access_id: accessId, date: input.new_date, window: input.new_window });
}

// ---------- request_callback ----------

export async function requestCallback(c: Ctx, input: ToolInput<"request_callback">): Promise<Body> {
  const { deps } = c;
  const phone = normalizePhone(input.phone);
  if (!phone) return fail("invalid_phone", say("invalid_phone", { ru: {}, lv: {} }), INVALID_PHONE_HINT);
  const now = deps.now();
  const isTest = isTestMarker(input.conversation_id, input.name);
  const id = `C-${(await sha256Hex(`${input.conversation_id}|callback|${input.reason}`)).slice(0, 6).toUpperCase()}`;
  const msg = callbackMessage({ id, isTest, reason: input.reason, summary: input.summary_ru, name: input.name, phone });
  const [sheet, tg] = await Promise.allSettled([
    appendRow(deps, "Callbacks", rowOf("Callbacks", {
      timestamp: now.toISOString(), callback_id: id, conversation_id: input.conversation_id, language: input.language, reason: input.reason,
      summary_ru: input.summary_ru, name: input.name ?? "", phone, consent: CONTACT_BASIS, status: "new", is_test: isTest ? "TRUE" : "",
    })),
    sendTelegram(deps, msg, isTest),
  ]);
  const tgOk = tg.status === "fulfilled" && tg.value.ok;
  if (sheet.status === "rejected" && !tgOk) return googleFailure(sheet.reason, false);
  return ok(say("callback_ok", { ru: {}, lv: {} }), "Read the sentence. The request is recorded; do not promise a specific time.", { callback_id: id });
}
