// Google Sheets «SCG Leads» via REST. Writes use valueInputOption=RAW; tabs and column order come from sheet_schema.ts.
import type { Deps } from "../routes/types";
import { GoogleError } from "./errors";
import { assertOk, googleCall } from "./http";
import { SHEET_TABS, columnLetter, type TabName } from "./sheet_schema";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

export type Cell = string | number | boolean;
export type Row = Cell[];

function sheetId(deps: Deps): string {
  const id = deps.env.SHEET_ID?.trim();
  if (!id) throw new GoogleError("config", "SHEET_ID is not configured");
  return encodeURIComponent(id);
}

/** Appends one row. Row order = SHEET_TABS[tab]; use rowOf() to build it from named fields. */
export async function appendRow(deps: Deps, tab: TabName, row: Row): Promise<void> {
  const url = `${API}/${sheetId(deps)}/values/${tab}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  assertOk(await googleCall(deps, "POST", url, { values: [row] }), `append ${tab}`);
}

/** Appends several rows to one tab in one call. */
export async function appendRows(deps: Deps, tab: TabName, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  const url = `${API}/${sheetId(deps)}/values/${tab}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  assertOk(await googleCall(deps, "POST", url, { values: rows }), `append ${tab}`);
}

/** Builds a row in header order from named fields; missing fields become "". */
export function rowOf<T extends TabName>(tab: T, fields: Partial<Record<(typeof SHEET_TABS)[T][number], Cell | null | undefined>>): Row {
  const f = fields as Record<string, Cell | null | undefined>;
  return (SHEET_TABS[tab] as readonly string[]).map((h) => f[h] ?? "");
}

export type TabData = Record<string, Record<string, unknown>[]>;

/** Reads the data rows (below the header) of several tabs in ONE call, as objects keyed by header name. */
export async function readTabs(deps: Deps, tabs: TabName[]): Promise<TabData> {
  const ranges = tabs.map((t) => `ranges=${encodeURIComponent(`${t}!A2:${columnLetter(SHEET_TABS[t].length)}`)}`).join("&");
  const url = `${API}/${sheetId(deps)}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE`;
  const data = assertOk(await googleCall<{ valueRanges?: { values?: unknown[][] }[] }>(deps, "GET", url), "batchGet");
  const out: TabData = {};
  tabs.forEach((t, i) => {
    const headers = SHEET_TABS[t] as readonly string[];
    out[t] = (data.valueRanges?.[i]?.values ?? []).map((cells) => {
      const o: Record<string, unknown> = {};
      headers.forEach((h, j) => {
        o[h] = cells[j] ?? "";
      });
      return o;
    });
  });
  return out;
}

/** Header rows of tabs (health check). */
export async function readHeaders(deps: Deps, tabs: TabName[]): Promise<Record<string, string[]>> {
  const ranges = tabs.map((t) => `ranges=${encodeURIComponent(`${t}!A1:${columnLetter(SHEET_TABS[t].length)}1`)}`).join("&");
  const url = `${API}/${sheetId(deps)}/values:batchGet?${ranges}`;
  const data = assertOk(await googleCall<{ valueRanges?: { values?: unknown[][] }[] }>(deps, "GET", url), "batchGet headers");
  const out: Record<string, string[]> = {};
  tabs.forEach((t, i) => {
    out[t] = (data.valueRanges?.[i]?.values?.[0] ?? []).map(String);
  });
  return out;
}

/** Clears everything below the header of a tab. */
export async function clearBelowHeader(deps: Deps, tab: TabName): Promise<void> {
  const range = encodeURIComponent(`${tab}!A2:${columnLetter(SHEET_TABS[tab].length)}`);
  assertOk(await googleCall(deps, "POST", `${API}/${sheetId(deps)}/values/${range}:clear`, {}), `clear ${tab}`);
}

/** Overwrites the data rows of a tab starting at row 2 (RAW). */
export async function writeBelowHeader(deps: Deps, tab: TabName, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  const range = encodeURIComponent(`${tab}!A2`);
  assertOk(await googleCall(deps, "PUT", `${API}/${sheetId(deps)}/values/${range}?valueInputOption=RAW`, { values: rows }), `write ${tab}`);
}

/**
 * Deletes every row whose last column (`is_test`) is TRUE in the given tabs. Returns rows deleted per tab.
 * Calls: 1 batchGet + 1 spreadsheets.get (gids) + 1 batchUpdate (only if something to delete).
 */
export async function deleteTestRows(deps: Deps, tabs: TabName[]): Promise<Record<string, number>> {
  const data = await readTabs(deps, tabs);
  const targets: { tab: string; indexes: number[] }[] = [];
  for (const t of tabs) {
    const indexes: number[] = [];
    (data[t] ?? []).forEach((r, i) => {
      if (String(r.is_test).toUpperCase() === "TRUE") indexes.push(i + 1); // 0-based sheet row index: header is row 0
    });
    if (indexes.length) targets.push({ tab: t, indexes });
  }
  const result: Record<string, number> = Object.fromEntries(tabs.map((t) => [t, 0]));
  if (!targets.length) return result;
  const meta = assertOk(
    await googleCall<{ sheets?: { properties?: { sheetId?: number; title?: string } }[] }>(deps, "GET", `${API}/${sheetId(deps)}?fields=sheets.properties(sheetId,title)`),
    "spreadsheets.get",
  );
  const gid = new Map((meta.sheets ?? []).map((s) => [s.properties?.title, s.properties?.sheetId]));
  const requests: unknown[] = [];
  for (const { tab, indexes } of targets) {
    const id = gid.get(tab);
    if (id === undefined) continue;
    // bottom-up so earlier deletions do not shift later indexes
    for (const idx of [...indexes].sort((a, b) => b - a)) {
      requests.push({ deleteDimension: { range: { sheetId: id, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 } } });
    }
    result[tab] = indexes.length;
  }
  if (requests.length) assertOk(await googleCall(deps, "POST", `${API}/${sheetId(deps)}:batchUpdate`, { requests }), "batchUpdate");
  return result;
}
