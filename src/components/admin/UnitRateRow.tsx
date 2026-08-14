"use client";

import { useCallback, useState } from "react";
import { Pencil } from "lucide-react";
import { UnitForm } from "@/components/admin/UnitForm";
import { Badge, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { money } from "@/lib/format";
import type { UnitRow } from "@/lib/data/types";

export function UnitRateRow({ unit }: { unit: UnitRow }) {
  const [editing, setEditing] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <>
      <tr className={editing ? "bg-sage-pale/30" : undefined}>
        <Td>
          <span className="font-medium">{unit.name}</span>
          {!unit.is_active && (
            <span className="ml-2 align-middle">
              <Badge tone="neutral">not available</Badge>
            </span>
          )}
          {unit.floor && (
            <span className="block text-xs text-ink-faint">
              {unit.floor} floor
            </span>
          )}
        </Td>
        <Td>
          <Badge>{unit.kind}</Badge>
        </Td>
        <Td align="right">{money(unit.monthly_rate_cents)}</Td>
        <Td align="right">
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {editing ? "Close" : "Edit"}
          </Button>
        </Td>
      </tr>

      {editing && (
        <tr>
          <td colSpan={4} className="border-b border-tan/20 bg-sage-pale/20 p-5">
            <UnitForm unit={unit} onSaved={stopEditing} onCancel={stopEditing} />
          </td>
        </tr>
      )}
    </>
  );
}
