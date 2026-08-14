"use client";

import { useCallback, useState } from "react";
import { Pencil } from "lucide-react";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";
import { ExpenseForm } from "@/components/admin/ExpenseForm";
import { Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { deleteExpense } from "@/app/(admin)/admin/finance/actions";
import { dateShort, moneyExact } from "@/lib/format";
import type { ExpenseRow as ExpenseRowType } from "@/lib/data/types";

export function ExpenseRow({
  expense,
  categories,
}: {
  expense: ExpenseRowType;
  categories: string[];
}) {
  const [editing, setEditing] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <>
      <tr className={editing ? "bg-sage-pale/30" : undefined}>
        <Td>{dateShort(expense.incurred_on)}</Td>
        <Td>{expense.vendor ?? "—"}</Td>
        <Td className="text-ink-soft">{expense.description ?? "—"}</Td>
        <Td>{expense.category}</Td>
        <Td align="right" className="font-semibold">
          {moneyExact(expense.amount_cents)}
        </Td>
        <Td align="right">
          <div className="flex flex-wrap justify-end gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {editing ? "Close" : "Edit"}
            </Button>
            <ConfirmDelete
              id={expense.id}
              action={deleteExpense}
              what={`this ${moneyExact(expense.amount_cents)} cost`}
            />
          </div>
        </Td>
      </tr>

      {editing && (
        <tr>
          <td colSpan={6} className="border-b border-tan/20 bg-sage-pale/20 p-5">
            <ExpenseForm
              existingCategories={categories}
              expense={expense}
              onSaved={stopEditing}
              onCancel={stopEditing}
            />
          </td>
        </tr>
      )}
    </>
  );
}
