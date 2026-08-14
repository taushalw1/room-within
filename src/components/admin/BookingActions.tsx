"use client";

import { useActionState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  approveBooking,
  declineBooking,
  type ActionResult,
} from "@/app/(admin)/admin/bookings/actions";
import { cn } from "@/lib/cn";

export function BookingDecision({ bookingId }: { bookingId: string }) {
  const [approveResult, approve, approving] = useActionState(
    approveBooking,
    null,
  );
  const [declineResult, decline, declining] = useActionState(
    declineBooking,
    null,
  );
  const result: ActionResult | null = approveResult ?? declineResult;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <form action={approve}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <Button size="sm" type="submit" disabled={approving || declining}>
            {approving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden />
            )}
            Confirm
          </Button>
        </form>

        <form action={decline}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <Button
            size="sm"
            variant="secondary"
            type="submit"
            disabled={approving || declining}
          >
            {declining ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <X className="h-3.5 w-3.5" aria-hidden />
            )}
            Decline
          </Button>
        </form>
      </div>

      {result && (
        <p
          role="status"
          className={cn(
            "mt-2 text-xs",
            result.ok ? "text-olive" : "text-burgundy",
          )}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
