"use client";

import { useCallback, useState } from "react";
import { Pencil } from "lucide-react";
import { RoomForm } from "@/components/admin/RoomForm";
import { Badge, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { money } from "@/lib/format";
import type { RoomRow } from "@/lib/data/types";

export function RoomRateRow({ room }: { room: RoomRow }) {
  const [editing, setEditing] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <>
      <tr className={editing ? "bg-sage-pale/30" : undefined}>
        <Td>
          <span className="font-medium">{room.name}</span>
          {!room.is_bookable && (
            <span className="ml-2 align-middle">
              <Badge tone="neutral">hidden</Badge>
            </span>
          )}
          {room.capacity ? (
            <span className="block text-xs text-ink-faint">
              Seats {room.capacity}
            </span>
          ) : null}
        </Td>
        <Td align="right">{money(room.hourly_rate_cents)}</Td>
        <Td align="right">
          {room.half_day_rate_cents ? money(room.half_day_rate_cents) : "—"}
        </Td>
        <Td align="right">
          {room.full_day_rate_cents ? money(room.full_day_rate_cents) : "—"}
        </Td>
        <Td align="right">{room.min_hours}h</Td>
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
          <td colSpan={6} className="border-b border-tan/20 bg-sage-pale/20 p-5">
            <RoomForm room={room} onSaved={stopEditing} onCancel={stopEditing} />
          </td>
        </tr>
      )}
    </>
  );
}
