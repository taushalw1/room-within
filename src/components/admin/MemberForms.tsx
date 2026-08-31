"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import {
  adjustCredits,
  cancelMembership,
  saveMembership,
} from "@/app/(admin)/admin/members/actions";
import {
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { Badge, Td } from "@/components/ui/Table";
import { dateShort, moneyExact } from "@/lib/format";
import type {
  ContactRow,
  CreditSettings,
  MembershipRow,
} from "@/lib/data/types";
import type { CreditBalance } from "@/lib/credits";

const dollars = (cents: number) => (cents / 100).toFixed(2);

export function MembershipForm({
  membership,
  contacts,
  settings,
  onSaved,
  onCancel,
}: {
  membership?: MembershipRow;
  contacts: ContactRow[];
  settings: CreditSettings;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [result, action] = useActionState(saveMembership, null);
  const [plan, setPlan] = useState<"individual" | "family">(
    membership?.plan ?? "individual",
  );

  useEffect(() => {
    if (result?.ok) onSaved?.();
  }, [result, onSaved]);

  const preset =
    plan === "family"
      ? { price: settings.family_price_cents, credits: settings.family_credits }
      : {
          price: settings.individual_price_cents,
          credits: settings.individual_credits,
        };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-5">
      {membership && (
        <input type="hidden" name="membershipId" value={membership.id} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Who">
          <select
            name="contactId"
            required
            defaultValue={membership?.contact_id ?? ""}
            className={inputClass}
          >
            <option value="">Choose…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Which plan">
          <select
            name="plan"
            className={inputClass}
            value={plan}
            onChange={(e) => setPlan(e.target.value as "individual" | "family")}
          >
            <option value="individual">Individual</option>
            <option value="family">Family — one shared pool</option>
          </select>
        </Field>
      </div>

      {plan === "family" && (
        <Field
          label="The household"
          hint="Everyone in it draws from the same pool of credits."
        >
          <input
            name="householdName"
            defaultValue={membership?.household_name ?? ""}
            placeholder="The Vandenberg family"
            className={inputClass}
          />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Per month">
          <input
            name="monthlyPrice"
            type="number"
            min="0"
            step="0.01"
            required
            key={`price-${plan}`}
            defaultValue={dollars(
              membership?.monthly_price_cents ?? preset.price,
            )}
            className={inputClass}
          />
        </Field>
        <Field label="Credits a month">
          <input
            name="creditsPerMonth"
            type="number"
            min="0"
            required
            key={`credits-${plan}`}
            defaultValue={membership?.credits_per_month ?? preset.credits}
            className={inputClass}
          />
        </Field>
        <Field label="Started">
          <input
            name="startedOn"
            type="date"
            required
            defaultValue={membership?.started_on ?? today}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Your notes">
        <input
          name="notes"
          defaultValue={membership?.notes ?? ""}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>
          {membership ? "Save changes" : "Add the membership"}
        </SubmitButton>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Feedback result={result} />
      </div>
      <p className="text-xs text-ink-faint">
        Credits roll over for {settings.rollover_months} month
        {settings.rollover_months === 1 ? "" : "s"} and then expire.
      </p>
    </form>
  );
}

export function MembershipRowItem({
  membership,
  memberName,
  balance,
  contacts,
  settings,
}: {
  membership: MembershipRow;
  memberName: string;
  balance: CreditBalance;
  contacts: ContactRow[];
  settings: CreditSettings;
}) {
  const [editing, setEditing] = useState(false);
  const [, cancel] = useActionState(cancelMembership, null);
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <>
      <tr className={editing ? "bg-sage-pale/30" : undefined}>
        <Td>
          <span className="font-medium">
            {membership.household_name ?? memberName}
          </span>
          {membership.household_name && (
            <span className="block text-xs text-ink-faint">{memberName}</span>
          )}
        </Td>
        <Td>
          <Badge tone={membership.plan === "family" ? "info" : "neutral"}>
            {membership.plan}
          </Badge>
        </Td>
        <Td align="right">{moneyExact(membership.monthly_price_cents)}</Td>
        <Td align="right">
          <span className="font-medium">{balance.available}</span>
          {balance.expiringSoon > 0 && (
            <span className="block text-xs text-burgundy">
              {balance.expiringSoon} expiring this month
            </span>
          )}
        </Td>
        <Td align="right">
          <Badge
            tone={
              membership.status === "active"
                ? "good"
                : membership.status === "paused"
                  ? "warn"
                  : "neutral"
            }
          >
            {membership.status === "cancelled" && membership.cancelled_on
              ? `left ${dateShort(membership.cancelled_on)}`
              : membership.status}
          </Badge>
        </Td>
        <Td align="right">
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {editing ? "Close" : "Edit"}
            </Button>
            {membership.status === "active" && (
              <form action={cancel}>
                <input
                  type="hidden"
                  name="membershipId"
                  value={membership.id}
                />
                <Button size="sm" variant="ghost" type="submit">
                  End it
                </Button>
              </form>
            )}
          </div>
        </Td>
      </tr>

      {editing && (
        <tr>
          <td colSpan={6} className="border-b border-tan/20 bg-sage-pale/20 p-5">
            <MembershipForm
              membership={membership}
              contacts={contacts}
              settings={settings}
              onSaved={stopEditing}
              onCancel={stopEditing}
            />
            <div className="mt-6 border-t border-tan/20 pt-4">
              <AdjustCredits membership={membership} settings={settings} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AdjustCredits({
  membership,
  settings,
}: {
  membership: MembershipRow;
  settings: CreditSettings;
}) {
  const [result, action] = useActionState(adjustCredits, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="membershipId" value={membership.id} />
      <p className="eyebrow !text-[0.6rem] text-bark">Add or remove credits</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="How many"
          hint={`A positive number sells them extra credits at ${moneyExact(settings.extra_credit_cents)} each.`}
        >
          <input
            name="delta"
            type="number"
            required
            placeholder="2"
            className={inputClass}
          />
        </Field>
        <Field label="Why" className="sm:col-span-2">
          <input
            name="note"
            placeholder="Bought two extra credits"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Apply</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}
