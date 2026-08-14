"use client";

import { useActionState } from "react";
import { Eye, EyeOff, Loader2, Ban } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { setEventStatus } from "@/app/(admin)/admin/events/actions";
import { cn } from "@/lib/cn";

export function EventStatusButtons({
  eventId,
  status,
}: {
  eventId: string;
  status: "draft" | "published" | "cancelled";
}) {
  const [result, action, pending] = useActionState(setEventStatus, null);

  const next =
    status === "published"
      ? { value: "draft", label: "Hide", icon: EyeOff }
      : { value: "published", label: "Publish", icon: Eye };

  const Icon = next.icon;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        <form action={action}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="status" value={next.value} />
          <Button
            size="sm"
            variant={next.value === "published" ? "primary" : "secondary"}
            type="submit"
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Icon className="h-3.5 w-3.5" aria-hidden />
            )}
            {next.label}
          </Button>
        </form>

        {status !== "cancelled" && (
          <form action={action}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="status" value="cancelled" />
            <Button size="sm" variant="ghost" type="submit" disabled={pending}>
              <Ban className="h-3.5 w-3.5" aria-hidden />
              Cancel
            </Button>
          </form>
        )}
      </div>

      {result && (
        <p
          role="status"
          className={cn(
            "text-xs",
            result.ok ? "text-olive" : "text-burgundy",
          )}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
