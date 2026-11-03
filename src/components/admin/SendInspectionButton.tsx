"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import {
  sendInspectionToTenant,
  type ActionResult,
} from "@/app/(admin)/admin/rentals/condition-actions";
import { Button } from "@/components/ui/Button";

/**
 * Hand the report over.
 *
 * Deliberately one-way and deliberately said so before it happens. Sending it
 * freezes her side, which is the point — a report both parties can keep
 * editing is not a record of anything — but it is also the kind of thing
 * nobody expects a button to do unless told.
 */
export function SendInspectionButton({
  reportId,
  unmarked,
}: {
  reportId: string;
  unmarked: number;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  if (unmarked > 0) {
    return (
      <p className="text-sm text-ink-soft">
        {unmarked} item{unmarked === 1 ? "" : "s"} still{" "}
        {unmarked === 1 ? "needs" : "need"} a mark. Once everything has one you
        can send it to them.
      </p>
    );
  }

  function send() {
    const fd = new FormData();
    fd.set("reportId", reportId);
    start(async () => {
      const outcome = await sendInspectionToTenant(fd);
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm text-ink-soft">
            Once it goes, you can&rsquo;t change your marks or notes. They
            can add theirs, and sign.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="button" disabled={pending} onClick={send}>
              <Send className="h-3.5 w-3.5" aria-hidden />
              Send it
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setConfirming(false)}
            >
              Not yet
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" type="button" onClick={() => setConfirming(true)}>
          <Send className="h-3.5 w-3.5" aria-hidden />
          Send it to them
        </Button>
      )}

      {result && (
        <p
          role="status"
          className={`text-sm ${result.ok ? "text-olive" : "text-burgundy"}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
