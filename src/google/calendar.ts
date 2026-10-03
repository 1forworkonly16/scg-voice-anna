// Google Calendar «SCG — Бесплатный осмотр» via REST. Service-account access: no attendees, no Meet links.
import type { BusyInterval } from "../lib/slots";
import type { Deps } from "../routes/types";
import { sha256Hex } from "../routes/util";
import { GoogleError } from "./errors";
import { assertOk, googleCall } from "./http";

const API = "https://www.googleapis.com/calendar/v3";
export const EVENT_TZ = "Europe/Riga";

export interface CalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export interface EventBody {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  conversationId: string;
  leadId: string;
  isTest: boolean;
}

function calId(deps: Deps): string {
  const id = deps.env.CALENDAR_ID?.trim();
  if (!id) throw new GoogleError("config", "CALENDAR_ID is not configured");
  return encodeURIComponent(id);
}

/** Event id = first 32 hex chars of SHA-256(`conversation_id|inspection`): a replay of the same booking is idempotent. */
export async function inspectionEventId(conversationId: string): Promise<string> {
  return (await sha256Hex(`${conversationId}|inspection`)).slice(0, 32);
}

/** Busy intervals of the calendar between two instants (one freeBusy call). */
export async function freeBusy(deps: Deps, from: Date, to: Date): Promise<BusyInterval[]> {
  const id = deps.env.CALENDAR_ID?.trim();
  if (!id) throw new GoogleError("config", "CALENDAR_ID is not configured");
  const r = await googleCall<{ calendars?: Record<string, { busy?: BusyInterval[]; errors?: unknown[] }> }>(deps, "POST", `${API}/freeBusy`, {
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    timeZone: EVENT_TZ,
    items: [{ id }],
  });
  const data = assertOk(r, "freeBusy");
  const cal = data.calendars?.[id];
  if (!cal || (cal.errors && cal.errors.length)) throw new GoogleError("http", "freeBusy returned calendar errors");
  return (cal.busy ?? []).map((b) => ({ start: b.start, end: b.end }));
}

function toEventResource(id: string | undefined, b: EventBody): Record<string, unknown> {
  return {
    ...(id ? { id } : {}),
    summary: b.summary,
    description: b.description,
    start: { dateTime: b.startIso, timeZone: EVENT_TZ },
    end: { dateTime: b.endIso, timeZone: EVENT_TZ },
    extendedProperties: { private: { conversation_id: b.conversationId, lead_id: b.leadId, is_test: b.isTest ? "true" : "false" } },
  };
}

export type InsertOutcome = { kind: "created"; event: CalendarEvent } | { kind: "exists" };

/** events.insert with a client-chosen id. 409 means the id already exists (replay). */
export async function insertEvent(deps: Deps, id: string, b: EventBody): Promise<InsertOutcome> {
  const r = await googleCall<CalendarEvent>(deps, "POST", `${API}/calendars/${calId(deps)}/events`, toEventResource(id, b));
  if (r.status === 409) return { kind: "exists" };
  return { kind: "created", event: assertOk(r, "events.insert") };
}

export async function getEvent(deps: Deps, id: string): Promise<CalendarEvent | null> {
  const r = await googleCall<CalendarEvent>(deps, "GET", `${API}/calendars/${calId(deps)}/events/${id}`);
  if (r.status === 404 || r.status === 410) return null;
  return assertOk(r, "events.get");
}

/** Moves an existing event to the new time (also revives a cancelled one). */
export async function patchEvent(deps: Deps, id: string, b: EventBody): Promise<CalendarEvent> {
  const res = toEventResource(undefined, b);
  const r = await googleCall<CalendarEvent>(deps, "PATCH", `${API}/calendars/${calId(deps)}/events/${id}`, { ...res, status: "confirmed" });
  return assertOk(r, "events.patch");
}

/** Same instant? (the two strings may carry different offsets) */
export function sameInstant(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = Date.parse(a);
  const y = Date.parse(b);
  return Number.isFinite(x) && x === y;
}

/** Upcoming events flagged is_test=true (for cleanup). */
export async function listTestEvents(deps: Deps, max = 40): Promise<CalendarEvent[]> {
  const q = `privateExtendedProperty=${encodeURIComponent("is_test=true")}&maxResults=${max}&showDeleted=false&singleEvents=true`;
  const r = await googleCall<{ items?: CalendarEvent[] }>(deps, "GET", `${API}/calendars/${calId(deps)}/events?${q}`);
  return assertOk(r, "events.list").items ?? [];
}

export async function deleteEvent(deps: Deps, id: string): Promise<boolean> {
  const r = await googleCall(deps, "DELETE", `${API}/calendars/${calId(deps)}/events/${id}`);
  return r.status === 204 || r.status === 200 || r.status === 404 || r.status === 410;
}
