"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  addInstructor,
  buildStatements,
  deleteEquipment,
  endStorage,
  markStatementPaid,
  saveEquipment,
  saveStorage,
  updateInstructor,
} from "@/app/(admin)/admin/instructors/actions";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { Badge, Td } from "@/components/ui/Table";
import { dateShort, money, moneyExact } from "@/lib/format";
import type {
  ContactRow,
  EquipmentRow,
  InstructorRow,
  InstructorStatementRow,
  StorageRentalRow,
} from "@/lib/data/types";

const dollars = (cents: number) => (cents / 100).toFixed(2);

/* ------------------------------ Instructors ------------------------------- */

export function InstructorForm({
  instructor,
  contacts,
  onSaved,
  onCancel,
}: {
  instructor?: InstructorRow;
  contacts: ContactRow[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [result, action] = useActionState(
    instructor ? updateInstructor : addInstructor,
    null,
  );

  useEffect(() => {
    if (result?.ok) onSaved?.();
  }, [result, onSaved]);

  return (
    <form action={action} className="space-y-5">
      {instructor && (
        <input type="hidden" name="instructorId" value={instructor.id} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Their name">
          <input
            name="displayName"
            required
            defaultValue={instructor?.display_name}
            className={inputClass}
          />
        </Field>
        <Field label="Linked contact" hint="So their payouts sit with the rest of their record.">
          <select
            name="contactId"
            defaultValue={instructor?.contact_id ?? ""}
            className={inputClass}
          >
            <option value="">Not linked</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="What they teach">
        <input
          name="headline"
          defaultValue={instructor?.headline ?? ""}
          placeholder="Painting and mixed media"
          className={inputClass}
        />
      </Field>

      <Field label="A short bio for the website">
        <textarea
          name="bio"
          rows={3}
          defaultValue={instructor?.bio ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Agreement signed">
          <input
            name="agreementSignedOn"
            type="date"
            defaultValue={instructor?.agreement_signed_on ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Waiver signed">
          <input
            name="waiverSignedOn"
            type="date"
            defaultValue={instructor?.waiver_signed_on ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="rounded-[var(--radius-card)] border border-tan/30 bg-cream p-4">
        <p className="eyebrow !text-[0.6rem] text-bark">Money</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field
            label="Their share of the class fee"
            hint="Leave empty to use the standard split for everyone."
          >
            <input
              name="splitPercent"
              type="number"
              min="0"
              max="100"
              placeholder="standard"
              defaultValue={instructor?.split_percent ?? ""}
              className={inputClass}
            />
          </Field>
          <Field
            label="Guaranteed minimum per class"
            hint="Leave at 0 unless you mean to pay them even when almost nobody comes."
          >
            <input
              name="guaranteedPay"
              type="number"
              min="0"
              step="0.01"
              defaultValue={
                instructor ? dollars(instructor.guaranteed_pay_cents) : "0.00"
              }
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <Field label="Your notes">
        <textarea
          name="notes"
          rows={2}
          defaultValue={instructor?.notes ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <CheckField
        name="isActive"
        label="Still teaching here"
        defaultChecked={instructor?.is_active ?? true}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>
          {instructor ? "Save changes" : "Add the instructor"}
        </SubmitButton>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Feedback result={result} />
      </div>
    </form>
  );
}

export function InstructorRow({
  instructor,
  contacts,
  storage,
  sessionsDelivered,
  averageAttendance,
  reasons,
}: {
  instructor: InstructorRow;
  contacts: ContactRow[];
  storage: StorageRentalRow[];
  sessionsDelivered: number;
  averageAttendance: number;
  reasons: string[];
}) {
  const [editing, setEditing] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);

  const paperwork =
    instructor.agreement_signed_on && instructor.waiver_signed_on
      ? null
      : !instructor.agreement_signed_on && !instructor.waiver_signed_on
        ? "No agreement or waiver on file"
        : !instructor.agreement_signed_on
          ? "No agreement on file"
          : "No waiver on file";

  return (
    <>
      <tr className={editing ? "bg-sage-pale/30" : undefined}>
        <Td>
          <span className="font-medium">{instructor.display_name}</span>
          {instructor.headline && (
            <span className="block text-xs text-ink-faint">
              {instructor.headline}
            </span>
          )}
          {paperwork && (
            <span className="mt-1 block text-xs text-burgundy">{paperwork}</span>
          )}
        </Td>
        <Td align="right">{sessionsDelivered}</Td>
        <Td align="right">
          {sessionsDelivered ? averageAttendance.toFixed(1) : "—"}
        </Td>
        <Td align="right">
          {storage.length
            ? money(storage.reduce((s, r) => s + r.monthly_rate_cents, 0))
            : "—"}
        </Td>
        <Td align="right">
          <Badge tone={instructor.standing === "earned" ? "good" : "neutral"}>
            {instructor.standing === "earned" ? "earned" : "new"}
          </Badge>
          {instructor.standing !== "earned" && reasons.length > 0 && (
            <span className="mt-1 block text-xs text-ink-faint">
              {reasons.join(" · ")}
            </span>
          )}
        </Td>
        <Td align="right">
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {editing ? "Close" : "Edit"}
          </Button>
        </Td>
      </tr>

      {editing && (
        <tr>
          <td colSpan={6} className="border-b border-tan/20 bg-sage-pale/20 p-5">
            <InstructorForm
              instructor={instructor}
              contacts={contacts}
              onSaved={stopEditing}
              onCancel={stopEditing}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/* ------------------------------- Equipment -------------------------------- */

export function EquipmentForm({
  item,
  onSaved,
  onCancel,
}: {
  item?: EquipmentRow;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [result, action] = useActionState(saveEquipment, null);
  useEffect(() => {
    if (result?.ok) onSaved?.();
  }, [result, onSaved]);

  return (
    <form action={action} className="space-y-4">
      {item && <input type="hidden" name="equipmentId" value={item.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What is it">
          <input
            name="name"
            required
            defaultValue={item?.name}
            placeholder="Pottery wheel"
            className={inputClass}
          />
        </Field>
        <Field label="How many we have">
          <input
            name="quantity"
            type="number"
            min="1"
            defaultValue={item?.quantity ?? 1}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="A note about it">
        <input
          name="description"
          defaultValue={item?.description ?? ""}
          className={inputClass}
        />
      </Field>

      <Field
        label="Hire per session"
        hint="Charged to the instructor for each session that runs. This is the hub's income."
      >
        <input
          name="sessionRate"
          type="number"
          min="0"
          step="0.01"
          defaultValue={item ? dollars(item.session_rate_cents) : "0.00"}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{item ? "Save changes" : "Add it"}</SubmitButton>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Feedback result={result} />
      </div>
    </form>
  );
}

export function EquipmentRowItem({ item }: { item: EquipmentRow }) {
  const [editing, setEditing] = useState(false);
  const [, remove] = useActionState(deleteEquipment, null);
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <>
      <tr className={editing ? "bg-sage-pale/30" : undefined}>
        <Td>
          <span className="font-medium">{item.name}</span>
          {item.description && (
            <span className="block text-xs text-ink-faint">
              {item.description}
            </span>
          )}
        </Td>
        <Td align="right">{item.quantity}</Td>
        <Td align="right">{moneyExact(item.session_rate_cents)}</Td>
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
            <form action={remove}>
              <input type="hidden" name="equipmentId" value={item.id} />
              <button
                type="submit"
                className="text-ink-faint transition-colors hover:text-burgundy"
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </form>
          </div>
        </Td>
      </tr>

      {editing && (
        <tr>
          <td colSpan={4} className="border-b border-tan/20 bg-sage-pale/20 p-5">
            <EquipmentForm item={item} onSaved={stopEditing} onCancel={stopEditing} />
          </td>
        </tr>
      )}
    </>
  );
}

/* -------------------------------- Storage --------------------------------- */

export function StorageForm({
  instructors,
  rental,
  onSaved,
  onCancel,
}: {
  instructors: InstructorRow[];
  rental?: StorageRentalRow;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [result, action] = useActionState(saveStorage, null);
  useEffect(() => {
    if (result?.ok) onSaved?.();
  }, [result, onSaved]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-4">
      {rental && <input type="hidden" name="storageId" value={rental.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Whose">
          <select
            name="instructorId"
            required
            defaultValue={rental?.instructor_id ?? ""}
            className={inputClass}
          >
            <option value="">Choose…</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Where it is">
          <input
            name="label"
            required
            defaultValue={rental?.label}
            placeholder="Shelf 3, maker space"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="How much space">
          <select
            name="size"
            defaultValue={rental?.size ?? "shelf"}
            className={inputClass}
          >
            <option value="shelf">A shelf</option>
            <option value="locker">A locker</option>
            <option value="closet">A closet</option>
            <option value="corner">A corner</option>
            <option value="room">A room</option>
          </select>
        </Field>
        <Field label="Per month">
          <input
            name="monthlyRate"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={rental ? dollars(rental.monthly_rate_cents) : "40.00"}
            className={inputClass}
          />
        </Field>
        <Field label="From">
          <input
            name="startedOn"
            type="date"
            required
            defaultValue={rental?.started_on ?? today}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="A note">
        <input
          name="notes"
          defaultValue={rental?.notes ?? ""}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{rental ? "Save changes" : "Let the space"}</SubmitButton>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Feedback result={result} />
      </div>
      <p className="text-xs text-ink-faint">
        Billed every month whether or not any classes ran, and taken off their
        payout rather than invoiced.
      </p>
    </form>
  );
}

export function StorageRowItem({
  rental,
  instructorName,
  instructors,
}: {
  rental: StorageRentalRow;
  instructorName: string;
  instructors: InstructorRow[];
}) {
  const [editing, setEditing] = useState(false);
  const [, end] = useActionState(endStorage, null);
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <>
      <tr className={editing ? "bg-sage-pale/30" : undefined}>
        <Td>{instructorName}</Td>
        <Td>
          {rental.label}
          <span className="block text-xs text-ink-faint">{rental.size}</span>
        </Td>
        <Td align="right">{moneyExact(rental.monthly_rate_cents)}</Td>
        <Td align="right">
          {rental.ended_on ? (
            <Badge tone="neutral">ended {dateShort(rental.ended_on)}</Badge>
          ) : (
            <Badge tone="good">current</Badge>
          )}
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
            {!rental.ended_on && (
              <form action={end}>
                <input type="hidden" name="storageId" value={rental.id} />
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
          <td colSpan={5} className="border-b border-tan/20 bg-sage-pale/20 p-5">
            <StorageForm
              rental={rental}
              instructors={instructors}
              onSaved={stopEditing}
              onCancel={stopEditing}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/* ------------------------------- Statements -------------------------------- */

export function StatementBuilder({ defaultMonth }: { defaultMonth: string }) {
  const [result, action] = useActionState(buildStatements, null);

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 border-b border-tan/20 px-5 py-4"
    >
      <label className="block">
        <span className="eyebrow !text-[0.6rem] text-bark">Work out a month</span>
        <input
          type="month"
          name="period"
          defaultValue={defaultMonth}
          className="mt-1.5 rounded-[var(--radius-card)] border border-tan/40 bg-cream px-3 py-2 text-sm"
        />
      </label>
      <SubmitButton>Prepare statements</SubmitButton>
      <Feedback result={result} />
    </form>
  );
}


export function StatementRow({
  statement,
  instructorName,
}: {
  statement: InstructorStatementRow;
  instructorName: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, pay] = useActionState(markStatementPaid, null);

  return (
    <>
      <tr>
        <Td>
          <span className="font-medium">{instructorName}</span>
          <span className="block text-xs text-ink-faint">
            {statement.sessions_delivered} session
            {statement.sessions_delivered === 1 ? "" : "s"} taught
          </span>
        </Td>
        <Td align="right">{money(statement.class_revenue_cents)}</Td>
        <Td align="right">{money(statement.instructor_share_cents)}</Td>
        <Td align="right">
          {statement.equipment_cents ? `−${money(statement.equipment_cents)}` : "—"}
        </Td>
        <Td align="right">
          {statement.storage_cents ? `−${money(statement.storage_cents)}` : "—"}
        </Td>
        <Td align="right">
          <span className="font-medium text-olive-deep">
            {moneyExact(statement.net_payout_cents)}
          </span>
        </Td>
        <Td align="right">
          <div className="flex items-center justify-end gap-2">
            <Badge tone={statement.status === "paid" ? "good" : "warn"}>
              {statement.status === "paid"
                ? `paid ${statement.paid_on ? dateShort(statement.paid_on) : ""}`
                : "to pay"}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide" : "Detail"}
            </Button>
          </div>
        </Td>
      </tr>

      {open && (
        <tr>
          <td colSpan={7} className="border-b border-tan/20 bg-parchment/50 px-5 py-4">
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <Line label="Class fees taken, including subsidy" value={money(statement.class_revenue_cents)} />
              <Line label="Their share" value={money(statement.instructor_share_cents)} />
              {statement.guaranteed_cents > 0 && (
                <Line label="Topped up to their guarantee" value={money(statement.guaranteed_cents)} />
              )}
              <Line label="Equipment hire" value={`−${money(statement.equipment_cents)}`} />
              <Line label="Storage" value={`−${money(statement.storage_cents)}`} />
              <Line
                label="Their materials cost (recorded, not deducted)"
                value={money(statement.materials_cents)}
                muted
              />
              <Line
                label="Net to pay them"
                value={moneyExact(statement.net_payout_cents)}
                strong
              />
            </dl>

            {statement.status !== "paid" && (
              <form action={pay} className="mt-4 flex items-center gap-3">
                <input type="hidden" name="statementId" value={statement.id} />
                <SubmitButton>Mark paid</SubmitButton>
                <Feedback result={result} />
                <span className="text-xs text-ink-faint">
                  Once paid, the figures are fixed and won&rsquo;t be recalculated.
                </span>
              </form>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Line({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={muted ? "text-ink-faint" : "text-ink-soft"}>{label}</dt>
      <dd className={strong ? "font-medium text-olive-deep" : undefined}>
        {value}
      </dd>
    </div>
  );
}
