// Demo works plan (FICTIONAL «Parauga iela 7», ДЕМО): reset on demand, roll forward daily so the demo is always in the near future.
import { demoWorksRows } from "../lib/works";
import { rigaYmd } from "../lib/time";
import { clearBelowHeader, readTabs, rowOf, writeBelowHeader } from "../google/sheets";
import { toWorksRows } from "../routes/handlers";
import type { Deps } from "../routes/types";

/** Id of the fictional demo building in the address dataset (data/buildings, demo: true). */
export const DEMO_BUILDING_ID = "demo-parauga-iela-7";

export async function resetWorks(deps: Deps): Promise<{ stairwells: number; first_start: string }> {
  const today = rigaYmd(deps.now());
  const rows = demoWorksRows(today, DEMO_BUILDING_ID);
  await clearBelowHeader(deps, "Works");
  await clearBelowHeader(deps, "Access"); // reschedules refer to the old dates
  await writeBelowHeader(deps, "Works", rows.map((w) => rowOf("Works", { ...w, is_test: "" })));
  return { stairwells: rows.length, first_start: rows[0]!.start_date };
}

/** Daily cron: regenerate when the plan is missing or its first stairwell has already started (or starts today). */
export async function rollWorksForward(deps: Deps): Promise<{ action: "reset" | "kept"; first_start?: string }> {
  const today = rigaYmd(deps.now());
  const tabs = await readTabs(deps, ["Works"]);
  const demo = toWorksRows(tabs.Works ?? []).filter((w) => w.building_id === DEMO_BUILDING_ID);
  const first = demo.map((w) => w.start_date).sort()[0];
  if (first && first > today) return { action: "kept", first_start: first };
  const r = await resetWorks(deps);
  return { action: "reset", first_start: r.first_start };
}
