"use client";

import { useCallback, useState } from "react";
import { Pencil } from "lucide-react";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { EventForm } from "@/components/admin/EventForm";
import { EventStatusButtons } from "@/components/admin/EventStatusButtons";
import { Badge, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { deleteEvent } from "@/app/(admin)/admin/events/actions";
import { dateTimeRange } from "@/lib/format";
import type { EventRow as EventRowType, RoomRow } from "@/lib/data/types";

/**
 * One row of the events table, with its edit form tucked underneath.
 *
 * Editing opens a full-width row in place rather than navigating away, so the
 * rest of the list stays visible — useful when the change being made is
 * "move this to the same time as that other one".
 */
export function EventRow({
  event,
  rooms,
}: {
  event: EventRowType;
  rooms: RoomRow[];
}) {
  const [editing, setEditing] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <>
      <tr className={editing ? "bg-sage-pale/30" : undefined}>
        <Td>{dateTimeRange(event.starts_at, event.ends_at)}</Td>
        <Td>
          <span className="font-medium">{event.title}</span>
          {event.host_name && (
            <span className="block text-xs text-ink-faint">
              {event.host_name}
            </span>
          )}
        </Td>
        <Td className="text-ink-soft">
          {event.location ?? "—"}
          {!event.is_at_building && (
            <span className="block text-xs text-ink-faint">
              elsewhere in the community
            </span>
          )}
        </Td>
        <Td align="right">
          <Badge
            tone={
              event.status === "published"
                ? "good"
                : event.status === "cancelled"
                  ? "bad"
                  : "warn"
            }
          >
            {event.status}
          </Badge>
        </Td>
        <Td align="right">
          <div className="flex flex-col items-end gap-1.5">
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
                id={event.id}
                action={deleteEvent}
                question={`Delete "${event.title}"? This can’t be undone.`}
              />
            </div>
            <EventStatusButtons eventId={event.id} status={event.status} />
          </div>
        </Td>
      </tr>

      {editing && (
        <tr>
          <td colSpan={5} className="border-b border-tan/20 bg-sage-pale/20 p-5">
            <EventForm
              rooms={rooms}
              event={event}
              onSaved={stopEditing}
              onCancel={stopEditing}
            />
          </td>
        </tr>
      )}
    </>
  );
}
