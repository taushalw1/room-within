"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { moveInRenter } from "@/app/(admin)/admin/rentals/move-in-actions";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { money } from "@/lib/format";
import type { UnitRow, WaitingListRow } from "@/lib/data/types";

const today = () => new Date().toISOString().slice(0, 10);

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-tan/25 bg-cream">
      <div className="border-b border-tan/20 bg-parchment px-5 py-3">
        <p className="eyebrow !text-[0.6rem] text-bark">{title}</p>
        {hint && <p className="mt-1 text-xs leading-relaxed text-ink-faint">{hint}</p>}
      </div>
      <div className="space-y-4 px-5 py-5">{children}</div>
    </section>
  );
}

/**
 * Everything about a new renter, on one screen.
 *
 * It is one screen rather than a wizard because a move-in happens once, with
 * keys in one hand and a person standing there, and anything pushed to "later"
 * is never done. The emergency contact is the clearest case: never wanted on
 * the day, always wanted at eleven at night.
 *
 * The rent and deposit fill themselves in from the room's asking rate, so the
 * common case is a name, a date and a tick.
 */
export function MoveInForm({
  units,
  waiting,
}: {
  units: UnitRow[];
  waiting: WaitingListRow[];
}) {
  const [result, action] = useActionState(moveInRenter, null);
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [rent, setRent] = useState(
    units[0] ? (units[0].monthly_rate_cents / 100).toFixed(2) : "",
  );
  const [deposit, setDeposit] = useState(
    units[0] ? (units[0].monthly_rate_cents / 100).toFixed(2) : "",
  );
  const [fromWaiting, setFromWaiting] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const unit = units.find((u) => u.id === unitId);

  /** Pick a room: the asking rate becomes the rent, and a month the deposit. */
  function chooseUnit(id: string) {
    setUnitId(id);
    const chosen = units.find((u) => u.id === id);
    if (!chosen) return;
    const asking = (chosen.monthly_rate_cents / 100).toFixed(2);
    setRent(asking);
    setDeposit(asking);
  }

  /** Somebody already on the waiting list: fill in what is known about them. */
  function chooseWaiting(id: string) {
    setFromWaiting(id);
    const person = waiting.find((w) => w.id === id);
    if (!person) return;
    setName(person.full_name);
    setEmail(person.email ?? "");
    setPhone(person.phone ?? "");
  }

  if (units.length === 0) {
    return (
      <p className="px-5 py-5 text-sm text-ink-soft">
        Every room has somebody in it. End a tenancy first, or add a room on the
        settings page.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="fromWaitingList" value={fromWaiting} />

      {waiting.length > 0 && (
        <Group
          title="Already on the waiting list?"
          hint="Pick them and the rest fills itself in. They'll come off the list when this is saved."
        >
          <Field label="Who">
            <select
              value={fromWaiting}
              onChange={(e) => chooseWaiting(e.target.value)}
              className={inputClass}
            >
              <option value="">Nobody — this is someone new</option>
              {waiting.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name}
                  {w.budget_cents != null ? ` — up to ${money(w.budget_cents)}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </Group>
      )}

      <Group title="Who they are">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              name="fullName"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Email" hint="Invoices, reminders and their sign-in link go here.">
            <input
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Phone">
            <input
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Business name, if it's a business">
            <input name="organisation" className={inputClass} />
          </Field>
        </div>
        <Field label="Anyone else living or working there" hint="In plain words — a partner, children, a dog, a colleague two days a week.">
          <textarea name="otherOccupants" rows={2} className={`${inputClass} resize-y`} />
        </Field>
      </Group>

      <Group title="The tenancy">
        <Field label="Which room">
          <select
            name="unitId"
            required
            value={unitId}
            onChange={(e) => chooseUnit(e.target.value)}
            className={inputClass}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {money(u.monthly_rate_cents)} a month asking
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Starts">
            <input
              name="startDate"
              type="date"
              required
              defaultValue={today()}
              className={inputClass}
            />
          </Field>
          <Field label="Ends" hint="Leave blank for month to month.">
            <input name="endDate" type="date" className={inputClass} />
          </Field>
          <Field label="Rent a month">
            <div className="flex items-center gap-2">
              <span className="text-ink-soft">$</span>
              <input
                name="rent"
                type="number"
                step="0.01"
                min="0"
                required
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                className={inputClass}
              />
            </div>
          </Field>
          <Field label="Due on the" hint="Day of the month.">
            <input
              name="dueDay"
              type="number"
              min={1}
              max={28}
              defaultValue={1}
              className={inputClass}
            />
          </Field>
        </div>

        {unit?.description && (
          <p className="text-xs leading-relaxed text-ink-faint">{unit.description}</p>
        )}
      </Group>

      <Group
        title="The deposit"
        hint="Recording it now is what makes the end of the tenancy honest — a deposit nobody wrote down is one nobody can prove was taken, and that hurts the tenant."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How much">
            <div className="flex items-center gap-2">
              <span className="text-ink-soft">$</span>
              <input
                name="deposit"
                type="number"
                step="0.01"
                min="0"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                className={inputClass}
              />
            </div>
          </Field>
        </div>
        <CheckField
          name="depositTaken"
          label="I have the deposit"
          hint="Ticking this opens their deposit record with this amount held. Leave it if the money hasn't arrived yet."
          defaultChecked
        />
      </Group>

      <Group
        title="Things you'll want later"
        hint="None of this is wanted today. All of it is wanted at an awkward moment."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Emergency contact">
            <input name="emergencyName" className={inputClass} />
          </Field>
          <Field label="Their phone">
            <input name="emergencyPhone" type="tel" className={inputClass} />
          </Field>
          <Field label="Who they are to them" hint="Mother, brother, friend.">
            <input name="emergencyRelationship" className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Keys handed over" hint="Keys, fobs and remotes. Counted back at the end.">
            <input name="keysIssued" type="number" min={0} className={inputClass} />
          </Field>
          <Field label="Vehicle" hint="Make and colour is enough.">
            <input name="vehicle" className={inputClass} />
          </Field>
          <Field label="Parking stall">
            <input name="parkingStall" className={inputClass} />
          </Field>
        </div>

        <Field label="Anything else worth writing down">
          <textarea name="notes" rows={2} className={`${inputClass} resize-y`} />
        </Field>
      </Group>

      <Group title="And then">
        <CheckField
          name="raiseFirstInvoice"
          label="Raise their first rent invoice"
          hint="Dated from the day the tenancy starts. Reminders then look after themselves."
          defaultChecked
        />
        <CheckField
          name="sendWelcomeEmail"
          label="Send them a welcome email"
          hint="How to sign in and see their own tenancy, repairs and invoices."
          defaultChecked
        />
      </Group>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton>
          <UserPlus className="h-4 w-4" aria-hidden />
          Move them in
        </SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}
