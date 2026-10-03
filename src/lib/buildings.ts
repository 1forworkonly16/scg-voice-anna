// Maps a building record (WP1's riga_buildings_search.json shape, or the test fixture shape) to the contract's Building.
// `sourced` is normalised from the brief-00 schema names to contract names: floors_above -> floors,
// stairwells_guess -> stairwells, year_commissioned -> year; every other name passes through unchanged.
export type FactField = "floors" | "stairwells" | "apartments";

export interface BuildingRecord {
  id: string;
  address_lv?: string;
  street_lv?: string;
  house?: string;
  korpuss?: string | null;
  floors?: number | null;
  stairwells?: number | null;
  apartments?: number | null;
  sourced?: readonly string[];
  demo?: boolean;
  label?: string | null;
}

export interface SpeakableBuilding {
  id: string;
  address: string;
  floors: number | null;
  stairwells: number | null;
  apartments: number | null;
  /** Contract names; only floors / stairwells / apartments are ever spoken. */
  sourced: string[];
}

const SCHEMA_TO_CONTRACT: Record<string, string> = {
  floors_above: "floors",
  stairwells_guess: "stairwells",
  year_commissioned: "year",
};

export function speakableFields(sourced: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const n of sourced ?? []) {
    const c = SCHEMA_TO_CONTRACT[n] ?? n;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** «Ilūkstes iela 16» / «Tirzas iela 3 k-2» (no city), from explicit parts or from address_lv. */
export function displayAddress(r: BuildingRecord): string {
  if (r.street_lv && r.house) {
    const house = r.house.replace(/\s*k-?\d+$/i, "");
    return `${r.street_lv} ${house}${r.korpuss ? ` k-${r.korpuss}` : ""}`;
  }
  return (r.address_lv ?? "").split(",")[0]!.trim();
}

/** Only sourced numbers leave the Worker: an unsourced floors/stairwells/apartments value is returned as null, so the agent cannot use it (WP8 t04). */
export function toBuilding(r: BuildingRecord): SpeakableBuilding {
  const sourced = speakableFields(r.sourced);
  const only = (field: string, v: number | null | undefined) => (sourced.includes(field) ? (v ?? null) : null);
  return {
    id: r.id,
    address: displayAddress(r),
    floors: only("floors", r.floors),
    stairwells: only("stairwells", r.stairwells),
    apartments: only("apartments", r.apartments),
    sourced,
  };
}
