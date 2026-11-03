"use client";

import { useActionState, useState, useTransition } from "react";
import { Lock, LockOpen, UserCheck } from "lucide-react";
import {
  setAccountantAccess,
  setBooksLock,
  type ActionResult,
} from "@/app/(admin)/admin/settings/actions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Table";
import { Feedback, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { dateLong } from "@/lib/format";

/**
 * Closing a year, and letting the accountant look at it.
 *
 * The two belong together: the point of a read-only login is that somebody
 * can check a year, and the point of closing one is that what they checked
 * stops moving afterwards.
 */
export function BooksAccess({
  lockedBefore,
  people,
}: {
  lockedBefore: string | null;
  people: { profileId: string; name: string; email: string | null; role: string }[];
}) {
  const [lockResult, lockAction] = useActionState<ActionResult | null, FormData>(
    setBooksLock,
    null,
  );

  return (
    <div className="space-y-6 px-5 py-5">
      {/* ---------- Closing a year ---------- */}
      <form action={lockAction} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {lockedBefore ? (
            <Badge tone="good">
              <Lock className="h-3 w-3" aria-hidden />
              closed to {dateLong(lockedBefore)}
            </Badge>
          ) : (
            <Badge tone="neutral">
              <LockOpen className="h-3 w-3" aria-hidden />
              nothing closed
            </Badge>
          )}
        </div>

        <Field
          label="Close the books up to"
          hint="Once a year has gone to your accountant and been filed, close it. Nothing dated before this can be added, edited or deleted — including by accident."
        >
          <input
            type="date"
            name="lockedBefore"
            defaultValue={lockedBefore ?? ""}
            className={inputClass}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>
            <Lock className="h-4 w-4" aria-hidden />
            {lockedBefore ? "Change it" : "Close the books"}
          </SubmitButton>
          <Feedback result={lockResult} />
        </div>

        <p className="text-xs text-ink-faint">
          Clear the date and save to reopen. A genuine late correction does
          happen — the point is that it has to be deliberate.
        </p>
      </form>

      {/* ---------- The accountant ---------- */}
      <div className="border-t border-tan/20 pt-5">
        <p className="eyebrow !text-[0.6rem] text-bark">Who can see the books</p>
        <p className="mt-1 text-sm text-ink-soft">
          A read-only login at <code className="text-xs">/books</code>. They see
          the figures and can download them; they cannot change anything, and
          they never see tenants, counselling or repairs.
        </p>

        <div className="mt-3 space-y-1.5">
          {people.length === 0 ? (
            <p className="text-sm text-ink-faint">
              Nobody has an account yet besides you.
            </p>
          ) : (
            people.map((p) => <PersonRow key={p.profileId} person={p} />)
          )}
        </div>
      </div>
    </div>
  );
}

function PersonRow({
  person,
}: {
  person: { profileId: string; name: string; email: string | null; role: string };
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const isAccountant = person.role === "accountant";
  const isOwner = person.role === "admin";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-tan/25 bg-cream px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-ink">{person.name}</p>
        {person.email && (
          <p className="text-xs text-ink-faint">{person.email}</p>
        )}
        {result && (
          <p
            role="status"
            className={`text-xs ${result.ok ? "text-olive" : "text-burgundy"}`}
          >
            {result.message}
          </p>
        )}
      </div>

      {isOwner ? (
        <Badge tone="info">that&rsquo;s you</Badge>
      ) : (
        <Button
          size="sm"
          variant={isAccountant ? "ghost" : "secondary"}
          type="button"
          disabled={pending}
          onClick={() => {
            const fd = new FormData();
            fd.set("profileId", person.profileId);
            fd.set("grant", isAccountant ? "no" : "yes");
            start(async () => setResult(await setAccountantAccess(fd)));
          }}
        >
          <UserCheck className="h-3.5 w-3.5" aria-hidden />
          {isAccountant ? "Take access away" : "Let them see the books"}
        </Button>
      )}
    </div>
  );
}
