"use client";

import { useState } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Result = { ok: boolean; message: string };

/**
 * A button that runs a server action and says what happened.
 *
 * Used for the routines that also run on a schedule — granting credits,
 * deciding sessions, working out standings. Having a button for each means the
 * rule can be watched doing its job instead of taken on trust, and every one
 * of them is safe to press twice.
 */
export function RunButton({
  action,
  label,
  icon: Icon,
  variant = "secondary",
}: {
  action: () => Promise<Result>;
  label: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [state, setState] = useState<
    { status: "idle" } | { status: "working" } | ({ status: "done" } & Result)
  >({ status: "idle" });

  async function run() {
    setState({ status: "working" });
    const result = await action();
    setState({ status: "done", ...result });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant={variant}
        type="button"
        onClick={run}
        disabled={state.status === "working"}
      >
        {state.status === "working" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : Icon ? (
          <Icon className="h-3.5 w-3.5" aria-hidden />
        ) : null}
        {label}
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
