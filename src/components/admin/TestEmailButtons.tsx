"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { sendTestEmail } from "@/app/(admin)/admin/settings/actions";
import { cn } from "@/lib/cn";

/**
 * Sends each real template to the signed-in admin, so Tausha can see exactly
 * what a tenant receives before anyone else does.
 */
const TEMPLATES = [
  { value: "welcome", label: "Welcome", hint: "New account" },
  { value: "reminder", label: "Rent due soon", hint: "3 days before" },
  { value: "overdue", label: "Rent overdue", hint: "7 days late" },
  { value: "booking", label: "Booking confirmed", hint: "After payment" },
  { value: "counselling", label: "Counselling reply", hint: "Enquiry received" },
];

export function TestEmailButtons({ address }: { address: string | null }) {
  const [result, action, pending] = useActionState(sendTestEmail, null);

  return (
    <div>
      <p className="text-sm text-ink-soft">
        Send yourself a copy of any of these to see what people actually
        receive. They go to{" "}
        <strong className="text-ink">{address ?? "your account address"}</strong>{" "}
        with example details filled in — nobody else is emailed.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <form key={t.value} action={action}>
            <input type="hidden" name="template" value={t.value} />
            <Button
              size="sm"
              variant="secondary"
              type="submit"
              disabled={pending}
              title={t.hint}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden />
              )}
              {t.label}
            </Button>
          </form>
        ))}
      </div>

      {result && (
        <p
          role="status"
          className={cn(
            "mt-3 text-sm",
            result.ok ? "text-olive" : "text-burgundy",
          )}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
