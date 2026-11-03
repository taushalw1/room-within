import { CONDITION_CHECKLIST } from "@/lib/condition";
import type { ConditionItemRow, ConditionRating, ConditionReportRow } from "./types";

/**
 * A tenancy with both inspections done, for the demo and for a clone with no
 * database behind it.
 *
 * The interesting part is deliberately not the agreement. Two items declined
 * during the tenancy, one improved, and on one of them the two sides saw it
 * differently and said so at the time. A sample where everybody agreed
 * teaches nothing about what the page is for.
 */

const LEASE = "c0000000-0000-4000-8000-00000000000a";
const MOVE_IN = "c1000000-0000-4000-8000-000000000001";
const MOVE_OUT = "c1000000-0000-4000-8000-000000000002";

export const sampleConditionReports: ConditionReportRow[] = [
  {
    id: MOVE_IN,
    lease_id: LEASE,
    unit_id: null,
    contact_id: "c2",
    kind: "move_in",
    inspected_on: "2025-09-01",
    tenant_present: true,
    status: "agreed",
    landlord_note: "Walked round together before the keys were handed over.",
    tenant_note: "Happy with all of this. The hall carpet mark was there already.",
    tenant_signature_event: null,
    created_at: "2025-09-01T09:00:00Z",
    updated_at: "2025-09-01T10:30:00Z",
  },
  {
    id: MOVE_OUT,
    lease_id: LEASE,
    unit_id: null,
    contact_id: "c2",
    kind: "move_out",
    inspected_on: "2026-11-28",
    tenant_present: true,
    status: "awaiting_tenant",
    landlord_note: "Walk-through on the morning of the 28th.",
    tenant_note: null,
    tenant_signature_event: null,
    created_at: "2026-11-28T09:00:00Z",
    updated_at: "2026-11-28T09:40:00Z",
  },
];

/** Everything good unless it says otherwise, which is the usual case. */
function build(
  reportId: string,
  overrides: Record<number, Partial<ConditionItemRow>>,
): ConditionItemRow[] {
  return CONDITION_CHECKLIST.map((line, index) => ({
    id: `${reportId}-${index}`,
    report_id: reportId,
    position: index + 1,
    area: line.area,
    item: line.item,
    rating: "good" as ConditionRating,
    note: null,
    photo_path: null,
    tenant_rating: "good" as ConditionRating,
    tenant_note: null,
    created_at: "2025-09-01T09:00:00Z",
    ...overrides[index],
  }));
}

export const sampleConditionItems: ConditionItemRow[] = [
  ...build(MOVE_IN, {
    // Floors: already marked when she moved in, and both sides said so.
    1: {
      rating: "fair",
      note: "Mark on the hall carpet by the door, about the size of a hand.",
      tenant_rating: "fair",
      tenant_note: "Agreed — it was there when I looked round.",
    },
    13: { rating: "fair", note: "Sealant around the bath is tired but sound." },
    // Replaced during the tenancy, so this one improves rather than declines.
    7: {
      rating: "poor",
      note: "Battery alarms, both past their date.",
      tenant_rating: "poor",
    },
  }),
  ...build(MOVE_OUT, {
    // Declined: this is the one a deposit argument would be about, and the
    // move-in report is what settles it.
    1: {
      rating: "poor",
      note: "The original mark has spread and there are two more by the window.",
      tenant_rating: "fair",
      tenant_note:
        "I don't think it's changed much. The one by the window was the radiator leaking.",
    },
    // Declined, and agreed.
    13: {
      rating: "damaged",
      note: "Sealant has come away along the back edge and there is black mould.",
      tenant_rating: "damaged",
      tenant_note: "Yes — I reported this in the spring.",
    },
    // Improved: she replaced it during the tenancy.
    7: {
      rating: "good",
      note: "New alarms fitted March 2026.",
      tenant_rating: "good",
    },
    16: {
      rating: "good",
      note: "Two keys and one fob back, as issued.",
      tenant_rating: "good",
    },
  }),
];
