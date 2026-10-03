// M2 tool handlers: create_ticket and log_request. Same rules as handlers.ts (always an envelope, never throws for expected cases).
// Idempotency: the id is derived from conversation_id (+ type / kind), and the tab is read first; a re-sent call returns the
// stored result with replayed:true and writes / sends nothing. Test traffic (isTestMarker) is flagged and goes to the test chat only.
// Subrequest budget (cold token included): create_ticket 4 (token, batchGet Works+Tickets, append, Telegram), log_request 4.
import type { ToolInput } from "../contract";
import { PHRASES_M2, type PhraseKeyM2 } from "../copy/phrases_m2";
import { displayAddress, type BuildingRecord } from "../lib/buildings";
import { matchAddress } from "../lib/address";
import { fillTemplate } from "../lib/render";
import { looksLikeLeak, redactPhones } from "../lib/ticket";
import { appendRow, readTabs, rowOf, type TabData } from "../google/sheets";
import { requestMessage, ticketMessage } from "../notify/messages";
import { sendTelegram, type SendResult } from "../notify/telegram";
import { addressIndex, googleFailure, toWorksRows } from "./handlers";
import { ok, type Body, type Say } from "./envelope";
import type { Channel, Deps } from "./types";
import { isTestMarker, sha256Hex } from "./util";

interface Ctx {
  deps: Deps;
  channel: Channel;
}

function sayM2(key: PhraseKeyM2): Say {
  return { say_ru: fillTemplate(PHRASES_M2[key].ru, {}), say_lv: fillTemplate(PHRASES_M2[key].lv, {}) };
}

const isTrue = (v: unknown): boolean => String(v ?? "").toUpperCase() === "TRUE";
/** TRUE / FALSE / empty (unknown) <-> true / false / null */
const triState = (v: unknown): boolean | null => (String(v ?? "") === "" ? null : isTrue(v));
const tgDelivered = (r: PromiseSettledResult<SendResult>): boolean => r.status === "fulfilled" && (r.value.ok || r.value.reason === "skipped_test_without_test_chat");

// ---------- create_ticket ----------

function ticketSay(urgent: boolean, delivered: boolean, scgSite: boolean | null): Say {
  if (!urgent) return sayM2("ticket_ok");
  if (!delivered) return sayM2("ticket_alert_failed");
  return sayM2(scgSite === false ? "ticket_urgent_other" : "ticket_urgent");
}

const TICKET_HINT_NORMAL = "Read the sentence. The ticket is recorded. If the caller wants a callback, take the phone number and consent and call request_callback (reason ticket_followup). Do not promise a callback time.";
const TICKET_HINT_URGENT = "Read the sentence. The team has been alerted. Take the caller's phone number and consent and call request_callback (reason urgent_ticket). Do not promise a callback time or a live transfer.";
const TICKET_HINT_FAILED = "The ticket is recorded but the urgent alert could not be confirmed. Read the sentence, take the phone number and consent and call request_callback (reason urgent_ticket); do not promise a callback time.";

function ticketOk(s: Say, id: string, scgSite: boolean | null, escalated: boolean, replayed: boolean, delivered: boolean): Body {
  return ok(s, escalated ? (delivered ? TICKET_HINT_URGENT : TICKET_HINT_FAILED) : TICKET_HINT_NORMAL, { ticket_id: id, scg_site: scgSite, escalated, replayed });
}

export async function createTicket(c: Ctx, input: ToolInput<"create_ticket">): Promise<Body> {
  const { deps } = c;
  const now = deps.now();
  const isTest = isTestMarker(input.conversation_id);
  const description = redactPhones(input.description.trim());
  // A leak is always urgent: the model's own urgency is trusted upwards only.
  const leak = input.type === "leak" || looksLikeLeak(description);
  const urgent = input.urgency === "urgent" || leak;
  const id = `T-${(await sha256Hex(`${input.conversation_id}|ticket|${input.type}|${urgent ? "urgent" : "normal"}`)).slice(0, 6).toUpperCase()}`;

  // building + SCG-site check; Sheets trouble must not lose an urgent alert, so a failed read only means "unknown"
  const m = matchAddress(input.address, addressIndex());
  const found = m.status === "found" && m.building ? m.building : null;
  const address = found ? displayAddress(found as unknown as BuildingRecord) : input.address.trim();
  let tabs: TabData | null = null;
  try {
    tabs = await readTabs(deps, ["Works", "Tickets"]);
  } catch {
    tabs = null;
  }
  const scgSite: boolean | null = !found || !tabs ? null : toWorksRows(tabs.Works ?? []).some((w) => w.building_id === found.id);

  const prior = (tabs?.Tickets ?? []).find((r) => String(r.ticket_id) === id && String(r.conversation_id) === input.conversation_id);
  if (prior) {
    return ticketOk(ticketSay(isTrue(prior.escalated), true, triState(prior.scg_site)), id, triState(prior.scg_site), isTrue(prior.escalated), true, true);
  }

  const msg = ticketMessage({ id, isTest, type: input.type, escalated: urgent, address, apartment: input.apartment, scgSite, description });
  const [sheet, tg] = await Promise.allSettled([
    appendRow(deps, "Tickets", rowOf("Tickets", {
      timestamp: now.toISOString(), ticket_id: id, conversation_id: input.conversation_id, language: input.language, type: input.type,
      urgency: urgent ? "urgent" : "normal", escalated: urgent ? "TRUE" : "FALSE", address, building_id: found?.id ?? "", apartment: input.apartment ?? "",
      scg_site: scgSite === null ? "" : scgSite ? "TRUE" : "FALSE", description, status: urgent ? "escalated" : "new", is_test: isTest ? "TRUE" : "",
    })),
    sendTelegram(deps, msg, isTest),
  ]);
  const delivered = tgDelivered(tg);
  if (sheet.status === "rejected" && !delivered) return googleFailure(sheet.reason, false);
  return ticketOk(ticketSay(urgent, delivered, scgSite), id, scgSite, urgent, false, delivered);
}

// ---------- log_request ----------

export async function logRequest(c: Ctx, input: ToolInput<"log_request">): Promise<Body> {
  const { deps } = c;
  const now = deps.now();
  const isTest = isTestMarker(input.conversation_id);
  const summary = redactPhones(input.summary_ru.trim());
  const id = `R-${(await sha256Hex(`${input.conversation_id}|request|${input.kind}`)).slice(0, 6).toUpperCase()}`;
  const say = sayM2(input.kind === "emergency_referral" ? "request_emergency_referral" : "request_ok");
  const hint =
    input.kind === "emergency_referral"
      ? "Read the sentence. This is not an SCG client: do not promise a visit or a transfer; offer a free inspection booking (book_inspection) only if the caller wants one."
      : "Read the sentence. The request is recorded; if the caller wants a callback, take the phone number and consent and call request_callback. Do not promise a callback time.";

  let tabs: TabData | null = null;
  try {
    tabs = await readTabs(deps, ["Requests"]);
  } catch {
    tabs = null;
  }
  if ((tabs?.Requests ?? []).some((r) => String(r.request_id) === id && String(r.conversation_id) === input.conversation_id)) {
    return ok(say, hint, { request_id: id, replayed: true });
  }

  const msg = requestMessage({ id, isTest, kind: input.kind, summary });
  const [sheet, tg] = await Promise.allSettled([
    appendRow(deps, "Requests", rowOf("Requests", {
      timestamp: now.toISOString(), request_id: id, conversation_id: input.conversation_id, language: input.language, kind: input.kind,
      summary_ru: summary, status: "new", is_test: isTest ? "TRUE" : "",
    })),
    sendTelegram(deps, msg, isTest),
  ]);
  if (sheet.status === "rejected" && !tgDelivered(tg)) return googleFailure(sheet.reason, false);
  return ok(say, hint, { request_id: id, replayed: false });
}
