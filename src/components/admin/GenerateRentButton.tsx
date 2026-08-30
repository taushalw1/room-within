"use client";

import { useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { generateRentNow } from "@/app/(admin)/admin/rentals/actions";
import { cn } from "@/lib/cn";

/**
 * Raise this month's rent by hand.
 *
 * It happens nightly anyway; this is for when Tausha has just added a tenant
 * and wants their first invoice now rather than tomorrow. Pressing it twice is
 * harmless — the database refuses a second invoice for the same month.
 */
export function GenerateRentButton() {
  const [state, setState] = useState<
    { status: "idle" } | { status: "working" } | { status: "done"; ok: boolean; message: string }
  >({ status: "idle" });

  async function run() {
    setState({ status: "working" });
    const result = await generateRentNow();
    setState({ status: "done", ok: result.ok, message: result.message });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant="secondary"
        onClick={run}
        disabled={state.status === "working"}
      >
        {state.status === "working" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
        )}
        Raise this month&rsquo;s rent
      </Button>

      {state.status === "done" && (
        <p
          role="status"
          className={cn("text-sm", state.ok ? "text-olive" : "text-burgundy")}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
