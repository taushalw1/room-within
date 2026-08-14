"use client";

import { useCallback, useState } from "react";
import { Pencil } from "lucide-react";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { ContactForm } from "@/components/admin/ContactForm";
import { Badge, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { deleteContact } from "@/app/(admin)/admin/rentals/actions";
import { dateShort, money } from "@/lib/format";
import type { ContactRow as ContactRowType } from "@/lib/data/types";

export function ContactRow({
  contact,
  owed,
}: {
  contact: ContactRowType;
  owed: number;
}) {
  const [editing, setEditing] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <>
      <tr className={editing ? "bg-sage-pale/30" : undefined}>
        <Td>
          <span className="font-medium">{contact.full_name}</span>
          {contact.organisation && (
            <span className="block text-xs text-ink-faint">
              {contact.organisation}
            </span>
          )}
        </Td>
        <Td className="text-ink-soft">
          {contact.email && <span className="block text-xs">{contact.email}</span>}
          {contact.phone && <span className="block text-xs">{contact.phone}</span>}
          {!contact.email && !contact.phone && "—"}
        </Td>
        <Td>
          <span className="flex flex-wrap gap-1">
            {contact.tags.length === 0 ? (
              <span className="text-ink-faint">—</span>
            ) : (
              contact.tags.map((t) => (
                <Badge key={t} tone={t === "tenant" ? "good" : "neutral"}>
                  {t}
                </Badge>
              ))
            )}
          </span>
        </Td>
        <Td className="text-ink-soft">{dateShort(contact.created_at)}</Td>
        <Td
          align="right"
          className={owed > 0 ? "font-semibold text-burgundy" : "text-ink-faint"}
        >
          {owed > 0 ? money(owed) : "—"}
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
            <ConfirmAction
              id={contact.id}
              action={deleteContact}
              question={`Remove ${contact.full_name} completely? This can’t be undone.`}
            />
          </div>
        </Td>
      </tr>

      {editing && (
        <tr>
          <td colSpan={6} className="border-b border-tan/20 bg-sage-pale/20 p-5">
            <ContactForm
              contact={contact}
              onSaved={stopEditing}
              onCancel={stopEditing}
            />
          </td>
        </tr>
      )}
    </>
  );
}
