"use client";

import { useCallback, useState } from "react";
import { Pencil } from "lucide-react";
import { BookingForm } from "@/components/admin/BookingForm";
import { Badge, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { dateTimeRange, money } from "@/lib/format";
import type { BookingRow as BookingRowType, RoomRow } from "@/lib/data/types";

export function BookingRow({
  booking,
  roomName,
  rooms,
}: {
  booking: BookingRowType;
  roomName: string;
  rooms: RoomRow[];
}) {
  const [editing, setEditing] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <>
      <tr className={editing ? "bg-sage-pale/30" : undefined}>
        <Td>{dateTimeRange(booking.starts_at, booking.ends_at)}</Td>
        <Td>{roomName}</Td>
        <Td>
          {booking.title}
          {booking.is_public && (
            <span className="ml-2 align-middle">
              <Badge tone="info">on calendar</Badge>
            </span>
          )}
        </Td>
        <Td>
          {booking.booker_name}
          <span className="block text-xs text-ink-faint">
            {booking.booker_email}
          </span>
        </Td>
        <Td align="right">{money(booking.total_cents)}</Td>
        <Td align="right">
          <Badge tone={booking.is_paid ? "good" : "warn"}>
            {booking.is_paid ? "paid" : "unpaid"}
          </Badge>
        </Td>
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
          <td colSpan={7} className="border-b border-tan/20 bg-sage-pale/20 p-5">
            <BookingForm
              booking={booking}
              rooms={rooms}
              onSaved={stopEditing}
              onCancel={stopEditing}
            />
          </td>
        </tr>
      )}
    </>
  );
}
