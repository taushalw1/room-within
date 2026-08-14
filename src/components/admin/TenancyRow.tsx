"use client";

import { useCallback, useState } from "react";
import { Pencil } from "lucide-react";
import { ConfirmAction, EndTenancyButton } from "@/components/admin/ConfirmAction";
import { LeaseForm } from "@/components/admin/LeaseForm";
import { Badge, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { deleteLease, endLease } from "@/app/(admin)/admin/rentals/actions";
import { dateShort, money } from "@/lib/format";
import type { ContactRow, LeaseRow, UnitRow } from "@/lib/data/types";

const ordinal = (n: number) =>
  n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";

/**
 * A unit and whoever is in it.
 *
 * "End tenancy" is the prominent action rather than delete: when someone moves
 * out the lease should stay on file with an end date, so their invoices and
 * payments still make sense. Delete is there for a lease entered by mistake,
 * and the action itself refuses if anything has been invoiced against it.
 */
export function TenancyRow({
  unit,
  lease,
  tenant,
  units,
}: {
  unit: UnitRow;
  lease?: LeaseRow;
  tenant?: ContactRow;
  units: UnitRow[];
}) {
  const [editing, setEditing] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);

  const tenantName = tenant?.full_name ?? "this tenant";

  return (
    <>
      <tr className={editing ? "bg-sage-pale/30" : undefined}>
        <Td>
          <span className="font-medium">{unit.name}</span>
          {unit.floor && (
            <span className="block text-xs text-ink-faint">
              {unit.floor} floor
            </span>
          )}
        </Td>
        <Td>
          <Badge>{unit.kind}</Badge>
        </Td>
        <Td>
          {tenant ? (
            <>
              {tenant.full_name}
              {tenant.organisation && (
                <span className="block text-xs text-ink-faint">
                  {tenant.organisation}
                </span>
              )}
              {lease && (
                <span className="block text-xs text-ink-faint">
                  since {dateShort(lease.start_date)}
                </span>
              )}
            </>
          ) : (
            <span className="text-ink-faint">Vacant</span>
          )}
        </Td>
        <Td align="right">
          {money(lease?.rent_cents ?? unit.monthly_rate_cents)}
          <span className="block text-xs text-ink-faint">/ month</span>
        </Td>
        <Td align="right">
          {lease ? (
            <span className="text-sm">
              {lease.due_day}
              <span className="text-xs text-ink-faint">
                {ordinal(lease.due_day)}
              </span>
            </span>
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </Td>
        <Td align="right">
          {lease ? (
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex flex-wrap justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  {editing ? "Close" : "Edit lease"}
                </Button>
                <EndTenancyButton
                  id={lease.id}
                  action={endLease}
                  question={`End ${tenantName}'s tenancy of ${unit.name} today? The lease and its payment history stay on file.`}
                />
              </div>
              <ConfirmAction
                id={lease.id}
                action={deleteLease}
                label="Delete lease"
                question={`Delete this lease outright? Only do this if it was entered by mistake — use "End tenancy" if they've moved out.`}
              />
            </div>
          ) : (
            <span className="text-xs text-ink-faint">
              Add a tenant above to let this unit
            </span>
          )}
        </Td>
      </tr>

      {editing && lease && (
        <tr>
          <td colSpan={6} className="border-b border-tan/20 bg-sage-pale/20 p-5">
            <LeaseForm
              lease={lease}
              units={units}
              tenantName={tenantName}
              onSaved={stopEditing}
              onCancel={stopEditing}
            />
          </td>
        </tr>
      )}
    </>
  );
}
