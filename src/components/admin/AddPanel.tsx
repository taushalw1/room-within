"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Card } from "@/components/ui/Table";
import { cn } from "@/lib/cn";

/**
 * A "＋ Add something" button that opens a form in place.
 *
 * Deliberately not a modal: a dialog that traps focus and covers the table
 * behind it is more to explain and more to get wrong than a panel that simply
 * appears where you clicked.
 */
export function AddPanel({
  label,
  title,
  description,
  children,
  className,
}: {
  /** Text on the closed button, e.g. "Add a tenant" */
  label: string;
  /** Heading once open — defaults to the label */
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)]",
          "border border-dashed border-tan/50 bg-parchment/40 px-5 py-4",
          "eyebrow !text-[0.62rem] text-bark transition-colors",
          "hover:border-olive/50 hover:bg-sage-pale/40 hover:text-olive-deep",
          className,
        )}
      >
        <Plus className="h-4 w-4" aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <Card className={cn("border-olive/30", className)}>
      <div className="flex items-start justify-between gap-4 border-b border-tan/20 px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-olive-deep">
            {title ?? label}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-ink-soft">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded p-1.5 text-ink-faint transition-colors hover:bg-linen hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="px-5 py-5">{children}</div>
    </Card>
  );
}
