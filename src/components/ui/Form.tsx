"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** Shared control styling, so every form on the admin side matches. */
export const inputClass =
  "w-full rounded-[var(--radius-card)] border border-tan/40 bg-cream px-3.5 py-2.5 " +
  "text-[0.95rem] text-ink placeholder:text-ink-faint";

export type FormResult = { ok: boolean; message: string } | null;

/**
 * Label + control + optional hint. Uses a wrapping <label> so the whole thing
 * is clickable without needing to invent matching ids.
 */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="eyebrow !text-[0.6rem] text-bark">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

/** A field whose control is a checkbox — laid out beside the text instead. */
export function CheckField({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 text-sm text-ink-soft">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-olive)]"
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-ink-faint">{hint}</span>}
      </span>
    </label>
  );
}

/** Submit button that shows a spinner while the server action is running. */
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

export function Feedback({ result }: { result: FormResult }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={cn("text-sm", result.ok ? "text-olive" : "text-burgundy")}
    >
      {result.message}
    </p>
  );
}
