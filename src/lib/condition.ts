/**
 * The move-in and move-out inspection: what gets looked at, and how the two
 * are compared.
 *
 * Pure helpers and the standard list. Nothing here touches the database, so
 * it can be used from a client component and checked without one.
 */

export type Rating = "good" | "fair" | "poor" | "damaged" | "missing" | "na";

export const RATINGS: { value: Rating; label: string; tone: "good" | "warn" | "bad" | "neutral" }[] =
  [
    { value: "good", label: "Good", tone: "good" },
    { value: "fair", label: "Fair wear", tone: "neutral" },
    { value: "poor", label: "Poor", tone: "warn" },
    { value: "damaged", label: "Damaged", tone: "bad" },
    { value: "missing", label: "Missing", tone: "bad" },
    { value: "na", label: "Not applicable", tone: "neutral" },
  ];

export const RATING_LABEL: Record<Rating, string> = Object.fromEntries(
  RATINGS.map((r) => [r.value, r.label]),
) as Record<Rating, string>;

/** Worse is higher. Used to tell a decline from an improvement. */
const SEVERITY: Record<Rating, number> = {
  na: 0,
  good: 1,
  fair: 2,
  poor: 3,
  damaged: 4,
  missing: 5,
};

/**
 * What changed between moving in and moving out.
 *
 * `na` on either side means there is nothing to compare rather than a change
 * of zero — a fixture that didn't exist at move-in and does now is not a
 * tenant's doing, and nor is the reverse without being looked at properly.
 */
export function change(
  before: Rating | null,
  after: Rating | null,
): "same" | "worse" | "better" | "unknown" {
  if (!before || !after) return "unknown";
  if (before === "na" || after === "na") return "unknown";
  if (SEVERITY[after] === SEVERITY[before]) return "same";
  return SEVERITY[after] > SEVERITY[before] ? "worse" : "better";
}

/**
 * Whether the two sides saw an item the same way.
 *
 * A disagreement is not a problem to be resolved by the software. It is the
 * single most valuable thing on the report, and all this does is make it
 * visible.
 */
export function disagrees(
  landlord: Rating | null,
  tenant: Rating | null,
): boolean {
  if (!landlord || !tenant) return false;
  return landlord !== tenant;
}

/**
 * The standard list, grouped as rooms.
 *
 * Kept deliberately short. A hundred-line form is one nobody fills in
 * honestly, and an inspection report with every line marked "good" because
 * the person was tired by line forty is worse than no report at all — it
 * reads as evidence and isn't.
 */
export const CONDITION_CHECKLIST: { area: string; item: string }[] = [
  { area: "Throughout", item: "Walls and ceilings" },
  { area: "Throughout", item: "Floors and floor coverings" },
  { area: "Throughout", item: "Doors, handles and locks" },
  { area: "Throughout", item: "Windows, sills and coverings" },
  { area: "Throughout", item: "Light fittings and switches" },
  { area: "Throughout", item: "Sockets and visible wiring" },
  { area: "Throughout", item: "Heating and radiators" },
  { area: "Throughout", item: "Smoke and carbon monoxide alarms" },

  { area: "Kitchen", item: "Cupboards, drawers and worktops" },
  { area: "Kitchen", item: "Sink, taps and drain" },
  { area: "Kitchen", item: "Cooker, hob and extractor" },
  { area: "Kitchen", item: "Fridge and freezer" },

  { area: "Bathroom", item: "Toilet, basin and taps" },
  { area: "Bathroom", item: "Bath or shower, and sealant" },
  { area: "Bathroom", item: "Tiles, grout and extractor fan" },

  { area: "The rest", item: "Furniture provided" },
  { area: "The rest", item: "Keys, fobs and remotes" },
  { area: "The rest", item: "Outside areas and parking" },
  { area: "The rest", item: "Storage or basement space" },
];

/** The areas, in the order they appear, without repeats. */
export function areasOf(items: { area: string }[]): string[] {
  return [...new Set(items.map((i) => i.area))];
}
