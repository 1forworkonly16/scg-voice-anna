// SINGLE SOURCE of the tool contract (zod v4). Worker handlers parse requests with these schemas and build
// responses that satisfy them; src/contract/elevenlabs.ts derives the ElevenLabs webhook-tool JSON from the same objects.
// Every response is HTTP 200 with the envelope {ok, v, say_ru, say_lv, hint, ...}; 401 only for a bad x-scg-key.
import { z } from "zod";
import { OPTIONS, SCOPES } from "../lib/quote";
import { ACCESS_WINDOWS } from "../lib/works";

export const CONTRACT_VERSION = 1 as const;
export const LANGUAGES = ["ru", "lv", "en"] as const;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// ---------- shared request fields ----------
const requestBase = {
  conversation_id: z.string().min(1).max(200).describe("Conversation id. Filled automatically by the platform; never ask the caller."),
  language: z.enum(LANGUAGES).describe("Language the caller is speaking right now: ru, lv or en."),
};

const floors = z.number().int().min(1).max(40).describe("Number of floors above ground, e.g. 9.");
const stairwells = z.number().int().min(1).max(30).describe("Number of stairwells (entrances), e.g. 4.");
const apartments = z.number().int().min(1).max(2000).describe("Total number of apartments in the building, e.g. 144.");
const phone = z.string().min(6).max(24).describe("Caller phone number exactly as dictated, digits with optional +371.");
const consent = z.boolean().describe("true only after the caller has clearly agreed that SCG stores the contact details and calls back.");

// ---------- shared response parts ----------
export const SlotSchema = z.object({
  start: z.string().describe("ISO 8601 start with Europe/Riga offset; pass it back unchanged to book_inspection."),
  label_ru: z.string(),
  label_lv: z.string(),
});
export type Slot = z.infer<typeof SlotSchema>;

export const FactFieldSchema = z.string().describe("Contract field name: floors, stairwells, apartments, year, ... Only floors / stairwells / apartments may be spoken.");

export const BuildingSchema = z.object({
  id: z.string(),
  address: z.string(),
  floors: z.number().int().nullable(),
  stairwells: z.number().int().nullable(),
  apartments: z.number().int().nullable(),
  /** Only these fields may be spoken as facts. */
  sourced: z.array(FactFieldSchema),
});
export type Building = z.infer<typeof BuildingSchema>;

export const ERROR_CODES = [
  "invalid_input",
  "invalid_slot",
  "slot_taken",
  "invalid_phone",
  "consent_required",
  "calendar_down",
  "not_found",
  "invalid_reschedule",
  "internal_error",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

const envelopeBase = {
  v: z.literal(CONTRACT_VERSION),
  say_ru: z.string().describe("Sentence to read to the caller in Russian."),
  say_lv: z.string().describe("Sentence to read to the caller in Latvian."),
  hint: z.string().describe("Short English instruction for the agent about what to do next."),
};

export const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  ...envelopeBase,
  error: z.object({ code: z.enum(ERROR_CODES), message: z.string().optional() }),
  /** slot_taken: the two closest free slots. */
  alternatives: z.array(SlotSchema).max(2).optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

const success = <T extends z.ZodRawShape>(shape: T) => z.object({ ok: z.literal(true), ...envelopeBase, ...shape });

// ---------- tools ----------
export const lookupBuildingInput = z.object({
  ...requestBase,
  address: z.string().min(1).max(300).describe("The address exactly as the caller said it, e.g. 'Илукстес 16' or 'Tirzes iela 3 k-2'."),
});
export const lookupBuildingOutput = success({
  status: z.enum(["found", "confirm", "need_house", "not_found"]),
  confidence: z.number().min(0).max(1),
  building: BuildingSchema.nullable(),
  candidates: z.array(BuildingSchema).max(3),
  street: z.string().nullable(),
});

export const quoteRangeInput = z.object({
  ...requestBase,
  floors,
  stairwells,
  apartments,
  scope: z.enum(SCOPES).optional().describe("Work scope. Default risers_complete (water + sewer risers). heating_risers is a separate scope."),
  horizontals: z.boolean().optional().describe("Include basement horizontal pipes (default true)."),
  sewer_outlet: z.boolean().optional().describe("Include sewer outlet replacement (default false)."),
  pump_station: z.boolean().optional().describe("Include a booster pump station (default false)."),
  options: z.array(z.enum(OPTIONS)).optional().describe("Optional extras: opt_sound_fire_wrap, opt_new_towel_rail."),
});
const money = z.object({ net: z.number().int(), gross: z.number().int() });
export const quoteRangeOutput = success({
  model_version: z.string(),
  range: z.object({ low: money, base: money, high: money }),
  per_apartment_gross: z.number().int(),
  /** The only numbers Anna may speak (already rounded by code). */
  figures: z.object({
    low_net: z.number().int(),
    high_net: z.number().int(),
    low_gross: z.number().int(),
    high_gross: z.number().int(),
    per_apt_gross: z.number().int(),
  }),
});

export const getSlotsInput = z.object({
  ...requestBase,
  weekday: z.enum(["mon", "tue", "wed", "thu", "fri"]).optional().describe("Only offer this weekday, if the caller asked for one."),
  date_from: z.string().regex(YMD).optional().describe("Earliest acceptable date, YYYY-MM-DD, if the caller gave one."),
  date_to: z.string().regex(YMD).optional().describe("Latest acceptable date, YYYY-MM-DD, if the caller gave one."),
  part_of_day: z.enum(["morning", "afternoon"]).optional().describe("morning or afternoon, if the caller prefers one."),
});
export const getSlotsOutput = success({
  today: z.object({ date: z.string(), label_ru: z.string(), label_lv: z.string() }),
  office_open_now: z.boolean(),
  slots: z.array(SlotSchema).max(3),
  /** True when the caller's filter left fewer than 3 slots and others were added. */
  filter_relaxed: z.boolean(),
});

export const CALLER_ROLES = ["owner", "manager", "board_member", "tenant", "other"] as const;
export const bookInspectionInput = z.object({
  ...requestBase,
  slot_start: z.string().min(10).describe("The 'start' value of the slot the caller chose, copied unchanged from get_slots."),
  address_spoken: z.string().min(1).max(300).describe("Building address as the caller said it."),
  floors,
  stairwells,
  apartments,
  caller_role: z.enum(CALLER_ROLES).describe("Who is calling: owner, manager, board_member, tenant or other."),
  name: z.string().min(1).max(100).describe("Caller's name for the booking."),
  phone,
  consent,
  building_id: z.string().max(100).optional().describe("Building id from lookup_building, if it was found."),
  scope: z.enum(SCOPES).optional().describe("Work scope the caller is interested in, if discussed."),
  notes: z.string().max(500).optional().describe("Short qualification notes in Russian (systems, access, wishes). No phone numbers or names."),
  unknown_questions: z.array(z.string().max(300)).max(5).optional().describe("Caller questions Anna could not answer, to pass to the engineer."),
});
export const bookInspectionOutput = success({
  booking_id: z.string(),
  slot: SlotSchema,
  address: z.string(),
  /** True when the same conversation re-sent the same booking (idempotent replay). */
  replayed: z.boolean(),
});

export const findWorksScheduleInput = z.object({
  ...requestBase,
  apartment: z.number().int().min(1).max(2000).describe("The caller's apartment number."),
  address: z.string().max(300).optional().describe("Building address as spoken (use this or building_id)."),
  building_id: z.string().max(100).optional().describe("Building id from lookup_building (use this or address)."),
});
export const worksOptionSchema = z.object({ date: z.string(), window: z.string(), label_ru: z.string(), label_lv: z.string() });
export const findWorksScheduleOutput = success({
  found: z.boolean(),
  building_id: z.string().nullable(),
  stairwell: z.number().int().nullable(),
  date: z.string().nullable(),
  window: z.string().nullable(),
  rescheduled: z.boolean(),
  options: z.array(worksOptionSchema).max(3),
});

export const rescheduleAccessInput = z.object({
  ...requestBase,
  building_id: z.string().min(1).max(100).describe("Building id returned by find_works_schedule."),
  apartment: z.number().int().min(1).max(2000).describe("The caller's apartment number."),
  new_date: z.string().regex(YMD).describe("New date YYYY-MM-DD, one of the options offered by find_works_schedule."),
  new_window: z.enum(ACCESS_WINDOWS).describe("New access window, one of the options offered."),
});
export const rescheduleAccessOutput = success({
  access_id: z.string(),
  date: z.string(),
  window: z.string(),
});

export const requestCallbackInput = z.object({
  ...requestBase,
  reason: z.string().min(1).max(120).describe("Why a human should call: e.g. human_requested, complaint, quote_details, unknown_question."),
  summary_ru: z.string().min(1).max(600).describe("Two or three sentences in Russian summarising the call for the manager. No names or phone numbers."),
  phone,
  consent,
  name: z.string().max(100).optional().describe("Caller's name, if given."),
});
export const requestCallbackOutput = success({
  callback_id: z.string(),
});

// ---------- M2 ----------
export const TICKET_TYPES = ["complaint", "warranty", "maintenance", "leak"] as const;
export const TICKET_URGENCIES = ["normal", "urgent"] as const;
export const createTicketInput = z.object({
  ...requestBase,
  type: z.enum(TICKET_TYPES).describe("complaint (damage, mess, noise), warranty (a problem after works), maintenance (service request) or leak (water is leaking now or after the works)."),
  urgency: z.enum(TICKET_URGENCIES).describe("urgent if water is leaking or flooding now, otherwise normal. A leak is always treated as urgent."),
  description: z.string().min(1).max(600).describe("One to three sentences in Russian: what happened, which system, access. No names and no phone numbers."),
  address: z.string().min(1).max(300).describe("Building address as the caller said it."),
  apartment: z.number().int().min(1).max(2000).optional().describe("The caller's apartment number, if given."),
});
export const createTicketOutput = success({
  ticket_id: z.string(),
  /** TRUE when the building is a known SCG works site, FALSE when it is not on the list, null when the address could not be matched or the list was unreachable. */
  scg_site: z.boolean().nullable(),
  /** True when a leak or urgent ticket sent the «СРОЧНО» alert to the team. */
  escalated: z.boolean(),
  /** True when the same conversation re-sent the same ticket (idempotent replay); nothing is written or sent again. */
  replayed: z.boolean(),
});

export const REQUEST_KINDS = ["b2b", "job_candidate", "emergency_referral", "admin_message", "other"] as const;
export const logRequestInput = z.object({
  ...requestBase,
  kind: z.enum(REQUEST_KINDS).describe("b2b (company or project inquiry, e.g. Sweden/Norway), job_candidate (applicant), emergency_referral (emergency at a building that is not an SCG client), admin_message (supplier, sales, office message) or other."),
  summary_ru: z.string().min(1).max(600).describe("Two or three sentences in Russian: who (company or trade, not a person's name), what, when. No names and no phone numbers."),
});
export const logRequestOutput = success({
  request_id: z.string(),
  /** True when the same conversation re-sent the same request (idempotent replay). */
  replayed: z.boolean(),
});

// ---------- registry ----------
export const TOOLS = {
  lookup_building: {
    description: "Find the caller's building in the SCG address list from the address as spoken. Returns status found/confirm/need_house/not_found and only sourced facts. Read say_ru / say_lv aloud.",
    timeoutSecs: 8,
    input: lookupBuildingInput,
    output: lookupBuildingOutput,
  },
  quote_range: {
    description: "Compute the indicative price range for a building from floors, stairwells and apartments. Never calculate prices yourself; read say_ru / say_lv aloud.",
    timeoutSecs: 8,
    input: quoteRangeInput,
    output: quoteRangeOutput,
  },
  get_slots: {
    description: "Get up to three free times for the free inspection, with today's date in Riga time. Read say_ru / say_lv aloud; never compute dates yourself.",
    timeoutSecs: 8,
    input: getSlotsInput,
    output: getSlotsOutput,
  },
  book_inspection: {
    description: "Book the free inspection after the caller chose a slot and gave name, phone and consent. Confirm to the caller only when ok is true.",
    timeoutSecs: 10,
    input: bookInspectionInput,
    output: bookInspectionOutput,
  },
  find_works_schedule: {
    description: "For a resident of a building under works: find the stairwell and the date and time window when access to the apartment is needed, plus up to three alternatives.",
    timeoutSecs: 8,
    input: findWorksScheduleInput,
    output: findWorksScheduleOutput,
  },
  reschedule_access: {
    description: "Move the access date and window for a resident's apartment to one of the offered options.",
    timeoutSecs: 8,
    input: rescheduleAccessInput,
    output: rescheduleAccessOutput,
  },
  request_callback: {
    description: "Hand over to a human: record a callback request when the caller wants a person or the question is outside what Anna may answer. Needs phone and consent.",
    timeoutSecs: 8,
    input: requestCallbackInput,
    output: requestCallbackOutput,
  },
  create_ticket: {
    description: "Record a service ticket from a resident or maintenance client (complaint, warranty case, maintenance request or leak). A leak or urgent ticket alerts the team at once. Read say_ru / say_lv aloud; confirm only when ok is true.",
    timeoutSecs: 8,
    input: createTicketInput,
    output: createTicketOutput,
  },
  log_request: {
    description: "Log a non-sales request for the team: B2B inquiry, job candidate, emergency at a non-client building, or an admin message. Read say_ru / say_lv aloud.",
    timeoutSecs: 8,
    input: logRequestInput,
    output: logRequestOutput,
  },
} as const;

export type ToolName = keyof typeof TOOLS;
export const TOOL_NAMES = Object.keys(TOOLS) as ToolName[];

export type ToolInput<N extends ToolName> = z.infer<(typeof TOOLS)[N]["input"]>;
export type ToolSuccess<N extends ToolName> = z.infer<(typeof TOOLS)[N]["output"]>;
/** Full response type: success or error envelope. */
export type ToolResponse<N extends ToolName> = ToolSuccess<N> | ErrorResponse;

/** Validates a response against the tool's success or error schema (used by tests and by handlers in dev). */
export function parseResponse<N extends ToolName>(name: N, body: unknown): ToolResponse<N> {
  const o = body as { ok?: unknown };
  if (o && o.ok === false) return ErrorResponseSchema.parse(body);
  return TOOLS[name].output.parse(body) as ToolResponse<N>;
}
