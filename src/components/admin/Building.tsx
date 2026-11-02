"use client";

import { useActionState, useState } from "react";
import { Check, Phone, Plus, Mail, FileText } from "lucide-react";
import {
  markTaskDone,
  retireContractor,
  saveContractor,
  saveRecurringTask,
  saveWarranty,
} from "@/app/(admin)/admin/building/actions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Table";
import { Feedback, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { dateShort, moneyExact } from "@/lib/format";
import { dueState } from "@/lib/building";
import type {
  ContractorRow,
  RecurringTaskRow,
  UnitRow,
  WarrantyRow,
} from "@/lib/data/types";

const today = () => new Date().toISOString().slice(0, 10);

/* --- Who she calls --------------------------------------------------------- */

function ContractorForm({
  contractor,
  onDone,
}: {
  contractor?: ContractorRow;
  onDone?: () => void;
}) {
  const [result, action] = useActionState(saveContractor, null);

  return (
    <form action={action} className="space-y-4">
      {contractor && <input type="hidden" name="id" value={contractor.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="name" required defaultValue={contractor?.name} className={inputClass} />
        </Field>
        <Field label="What they do" hint="Plumbing, electrical, snow, whatever you'd say on the phone.">
          <input name="trade" required defaultValue={contractor?.trade} className={inputClass} />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={contractor?.phone ?? ""} className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" defaultValue={contractor?.email ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field label="Anything worth knowing" hint="Hours, call-out charges, which door to use.">
        <textarea
          name="notes"
          rows={2}
          defaultValue={contractor?.notes ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>
      <Field
        label="How it went last time"
        hint="In your own words. More use in a year than a star rating."
      >
        <textarea
          name="howItWent"
          rows={2}
          defaultValue={contractor?.how_it_went ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{contractor ? "Save" : "Add them"}</SubmitButton>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Feedback result={result} />
      </div>
    </form>
  );
}

export function Contractors({ contractors }: { contractors: ContractorRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [retireResult, retire] = useActionState(retireContractor, null);

  const byTrade = contractors.reduce<Record<string, ContractorRow[]>>((acc, c) => {
    (acc[c.trade] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div>
      {contractors.length === 0 && !adding && (
        <p className="px-5 py-5 text-sm text-ink-soft">
          Nobody on the list yet. Add the people you already phone.
        </p>
      )}

      {Object.entries(byTrade).map(([trade, people]) => (
        <div key={trade}>
          <p className="eyebrow !text-[0.6rem] border-y border-tan/20 bg-parchment px-5 py-2 text-bark">
            {trade}
          </p>
          <ul className="divide-y divide-tan/20">
            {people.map((c) => (
              <li key={c.id} className="px-5 py-4">
                {editing === c.id ? (
                  <ContractorForm contractor={c} onDone={() => setEditing(null)} />
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium text-ink">{c.name}</p>
                      <div className="flex items-center gap-3 text-sm">
                        {c.phone && (
                          <a
                            href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`}
                            className="inline-flex items-center gap-1.5 text-olive-deep underline underline-offset-2"
                          >
                            <Phone className="h-3.5 w-3.5" aria-hidden />
                            {c.phone}
                          </a>
                        )}
                        {c.email && (
                          <a
                            href={`mailto:${c.email}`}
                            className="inline-flex items-center gap-1.5 text-olive-deep underline underline-offset-2"
                          >
                            <Mail className="h-3.5 w-3.5" aria-hidden />
                            Email
                          </a>
                        )}
                      </div>
                    </div>
                    {c.notes && <p className="text-sm text-ink-soft">{c.notes}</p>}
                    {c.how_it_went && (
                      <p className="text-sm italic text-bark">
                        Last time: {c.how_it_went}
                      </p>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditing(c.id)}
                        className="text-xs text-bark underline underline-offset-2"
                      >
                        Edit
                      </button>
                      <form action={retire}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="text-xs text-ink-faint underline underline-offset-2"
                        >
                          Take off the list
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="border-t border-tan/20 px-5 py-4">
        {adding ? (
          <ContractorForm onDone={() => setAdding(false)} />
        ) : (
          <>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add someone
            </Button>
            <Feedback result={retireResult} />
          </>
        )}
      </div>
    </div>
  );
}

/* --- Jobs that come round -------------------------------------------------- */

function TaskForm({
  task,
  units,
  contractors,
  onDone,
}: {
  task?: RecurringTaskRow;
  units: UnitRow[];
  contractors: ContractorRow[];
  onDone?: () => void;
}) {
  const [result, action] = useActionState(saveRecurringTask, null);

  return (
    <form action={action} className="space-y-4">
      {task && <input type="hidden" name="id" value={task.id} />}
      <Field label="The job">
        <input name="title" required defaultValue={task?.title} className={inputClass} />
      </Field>
      <Field label="What it involves" hint="Enough that somebody else could do it.">
        <textarea
          name="detail"
          rows={2}
          defaultValue={task?.detail ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How often" hint="In months.">
          <input
            name="everyMonths"
            type="number"
            min={1}
            max={60}
            required
            defaultValue={task?.every_months ?? 12}
            className={inputClass}
          />
        </Field>
        <Field label="Next due">
          <input
            name="nextDueOn"
            type="date"
            required
            defaultValue={task?.next_due_on ?? today()}
            className={inputClass}
          />
        </Field>
        <Field label="Where" hint="Leave blank for the whole building.">
          <input
            name="area"
            defaultValue={task?.area ?? ""}
            placeholder="Whole building"
            className={inputClass}
          />
        </Field>
        <Field label="Which unit, if it's just one">
          <select name="unitId" defaultValue={task?.unit_id ?? ""} className={inputClass}>
            <option value="">Not a single unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Who usually does it">
        <select
          name="contractorId"
          defaultValue={task?.contractor_id ?? ""}
          className={inputClass}
        >
          <option value="">Nobody in particular</option>
          {contractors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.trade}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{task ? "Save" : "Add the job"}</SubmitButton>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Feedback result={result} />
      </div>
    </form>
  );
}

function TaskRow({
  task,
  units,
  contractors,
}: {
  task: RecurringTaskRow;
  units: UnitRow[];
  contractors: ContractorRow[];
}) {
  const [result, action] = useActionState(markTaskDone, null);
  const [editing, setEditing] = useState(false);
  const due = dueState(task.next_due_on);
  const who = contractors.find((c) => c.id === task.contractor_id);

  if (editing) {
    return (
      <li className="px-5 py-4">
        <TaskForm
          task={task}
          units={units}
          contractors={contractors}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{task.title}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {task.area ?? units.find((u) => u.id === task.unit_id)?.name ?? "Whole building"}
            {" · every "}
            {task.every_months === 12
              ? "year"
              : task.every_months === 1
                ? "month"
                : `${task.every_months} months`}
            {who ? ` · ${who.name}` : ""}
            {task.last_done_on ? ` · last done ${dateShort(task.last_done_on)}` : ""}
          </p>
          {task.detail && (
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{task.detail}</p>
          )}
        </div>
        <Badge tone={due.tone === "bad" ? "bad" : due.tone === "warn" ? "warn" : "neutral"}>
          {due.label}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="doneOn" value={today()} />
          <Button size="sm" variant="ghost" type="submit">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Done today
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-bark underline underline-offset-2"
        >
          Edit
        </button>
        <Feedback result={result} />
      </div>
    </li>
  );
}

export function RecurringTasks({
  tasks,
  units,
  contractors,
}: {
  tasks: RecurringTaskRow[];
  units: UnitRow[];
  contractors: ContractorRow[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {tasks.length === 0 && (
        <p className="px-5 py-5 text-sm text-ink-soft">
          Nothing on the list yet. Gutters, furnace, smoke alarms — the jobs
          that come round whether or not anybody remembers them.
        </p>
      )}

      <ul className="divide-y divide-tan/20">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} units={units} contractors={contractors} />
        ))}
      </ul>

      <div className="border-t border-tan/20 px-5 py-4">
        {adding ? (
          <TaskForm units={units} contractors={contractors} onDone={() => setAdding(false)} />
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add a job
          </Button>
        )}
      </div>
    </div>
  );
}

/* --- What is still covered ------------------------------------------------- */

function WarrantyForm({
  warranty,
  units,
  onDone,
}: {
  warranty?: WarrantyRow;
  units: UnitRow[];
  onDone?: () => void;
}) {
  const [result, action] = useActionState(saveWarranty, null);

  return (
    <form action={action} className="space-y-4">
      {warranty && <input type="hidden" name="id" value={warranty.id} />}
      <Field label="What it is">
        <input
          name="item"
          required
          defaultValue={warranty?.item}
          placeholder="Furnace — Lennox, basement"
          className={inputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Who supplied or fitted it">
          <input name="supplier" defaultValue={warranty?.supplier ?? ""} className={inputClass} />
        </Field>
        <Field label="Their phone">
          <input
            name="supplierPhone"
            defaultValue={warranty?.supplier_phone ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Bought">
          <input
            name="purchasedOn"
            type="date"
            defaultValue={warranty?.purchased_on ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Cover runs out">
          <input
            name="expiresOn"
            type="date"
            defaultValue={warranty?.expires_on ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="What it cost">
          <div className="flex items-center gap-2">
            <span className="text-ink-soft">$</span>
            <input
              name="cost"
              type="number"
              step="0.01"
              min={0}
              defaultValue={
                warranty?.cost_cents == null ? "" : (warranty.cost_cents / 100).toFixed(2)
              }
              className={inputClass}
            />
          </div>
        </Field>
        <Field label="Which unit, if it's just one">
          <select name="unitId" defaultValue={warranty?.unit_id ?? ""} className={inputClass}>
            <option value="">Whole building</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="The paperwork"
        hint="A photo of the warranty card or the invoice. This is the bit nobody can find on the morning it breaks."
      >
        <input
          name="document"
          type="file"
          accept="image/*,application/pdf"
          className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-sage-pale file:px-3 file:py-1 file:text-xs`}
        />
      </Field>
      <Field label="Notes">
        <textarea
          name="notes"
          rows={2}
          defaultValue={warranty?.notes ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{warranty ? "Save" : "Add it"}</SubmitButton>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Feedback result={result} />
      </div>
    </form>
  );
}

export function Warranties({
  warranties,
  units,
  documentUrls,
}: {
  warranties: WarrantyRow[];
  units: UnitRow[];
  documentUrls: (string | null)[];
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div>
      {warranties.length === 0 && !adding && (
        <p className="px-5 py-5 text-sm text-ink-soft">
          Nothing recorded yet. The furnace, the roof, the water tank — anything
          with cover on it that would be expensive to replace.
        </p>
      )}

      <ul className="divide-y divide-tan/20">
        {warranties.map((w, i) => {
          const due = w.expires_on ? dueState(w.expires_on) : null;
          return (
            <li key={w.id} className="px-5 py-4">
              {editing === w.id ? (
                <WarrantyForm warranty={w} units={units} onDone={() => setEditing(null)} />
              ) : (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{w.item}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {w.supplier ?? "Supplier not recorded"}
                        {w.supplier_phone ? ` · ${w.supplier_phone}` : ""}
                        {w.unit_id
                          ? ` · ${units.find((u) => u.id === w.unit_id)?.name ?? ""}`
                          : ""}
                        {w.cost_cents != null ? ` · ${moneyExact(w.cost_cents)}` : ""}
                      </p>
                    </div>
                    {due && (
                      <Badge
                        tone={due.days < 0 ? "neutral" : due.tone === "bad" ? "bad" : due.tone === "warn" ? "warn" : "good"}
                      >
                        {due.days < 0
                          ? `cover ended ${dateShort(w.expires_on!)}`
                          : `covered until ${dateShort(w.expires_on!)}`}
                      </Badge>
                    )}
                  </div>
                  {w.notes && <p className="text-sm text-ink-soft">{w.notes}</p>}
                  <div className="flex items-center gap-3 pt-1">
                    {documentUrls[i] && (
                      <a
                        href={documentUrls[i] ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-olive-deep underline underline-offset-2"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        The paperwork
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditing(w.id)}
                      className="text-xs text-bark underline underline-offset-2"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="border-t border-tan/20 px-5 py-4">
        {adding ? (
          <WarrantyForm units={units} onDone={() => setAdding(false)} />
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add something
          </Button>
        )}
      </div>
    </div>
  );
}
