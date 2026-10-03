// SINGLE SOURCE of the Google Sheet «SCG Leads» layout. The Worker writes rows in exactly this column order and
// WP5's provisioning script writes these header rows. Dependency-free on purpose (importable from node scripts).
// RAW writes; `is_test` is ALWAYS the last column ("TRUE" for test rows, empty otherwise).

/** Brief A's 20 lead columns in order, then the voice extras. */
export const LEADS_HEADERS = [
  "timestamp",
  "channel",
  "language",
  "role",
  "address",
  "building_id",
  "floors",
  "apartments",
  "stairwells",
  "scope",
  "price_range",
  "decision_stage",
  "timing",
  "name",
  "phone",
  "email",
  "consent",
  "booked_slot",
  "status",
  "notes",
  // voice extras
  "lead_id",
  "conversation_id",
  "calendar_event_id",
  "unknown_questions",
  "is_test",
] as const;

/** Post-call webhook rows: summary + criteria, never a transcript. */
export const CALLS_HEADERS = [
  "timestamp",
  "conversation_id",
  "agent_id",
  "language",
  "duration_s",
  "status",
  "call_successful",
  "summary",
  "criteria_json",
  "data_json",
  "is_test",
] as const;

/** Demo works plan (FICTIONAL building, ДЕМО). */
export const WORKS_HEADERS = [
  "building_id",
  "address_lv",
  "stairwell",
  "apt_from",
  "apt_to",
  "start_date",
  "end_date",
  "apts_per_day",
  "window",
  "foreman_label",
  "status",
  "is_test",
] as const;

export const ACCESS_HEADERS = [
  "access_id",
  "created_at",
  "building_id",
  "apartment",
  "new_date",
  "new_window",
  "conversation_id",
  "is_test",
] as const;

export const CALLBACKS_HEADERS = [
  "timestamp",
  "callback_id",
  "conversation_id",
  "language",
  "reason",
  "summary_ru",
  "name",
  "phone",
  "consent",
  "status",
  "is_test",
] as const;

export const SHEET_TABS = {
  Leads: LEADS_HEADERS,
  Calls: CALLS_HEADERS,
  Works: WORKS_HEADERS,
  Access: ACCESS_HEADERS,
  Callbacks: CALLBACKS_HEADERS,
} as const;

export type TabName = keyof typeof SHEET_TABS;
export const TAB_NAMES = Object.keys(SHEET_TABS) as TabName[];

/** 1 -> A, 26 -> Z, 27 -> AA */
export function columnLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** Header-row range of a tab, e.g. "Leads!A1:Y1". */
export function headerRange(tab: TabName): string {
  return `${tab}!A1:${columnLetter(SHEET_TABS[tab].length)}1`;
}
