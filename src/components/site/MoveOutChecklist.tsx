"use client";

import { useActionState, useState } from "react";
import { Check, PenLine, ShieldCheck } from "lucide-react";
import {
  finishMoveOut,
  setForwarding,
  tickMoveOutItem,
} from "@/app/(site)/portal/move-out-actions";
import { Button } from "@/components/ui/Button";
import { Feedback, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MoveOutItemRow, MoveOutRow } from "@/lib/data/types";

/**
 * One line of the clean-out list.
 *
 * Saving happens the moment the box is ticked. A list of seventeen jobs done
 * over a week is not something anyone will remember to press Save on, and a
 * tick that didn't save is worse than no list at all.
 */
function Item({ item }: { item: MoveOutItemRow }) {
  const [result, action] = useActionState(tickMoveOutItem, null);
  const [done, setDone] = useState(item.done_by_tenant);
  const [note, setNote] = useState(item.tenant_note ?? "");
  const [noteOpen, setNoteOpen] = useState(Boolean(item.tenant_note));

  return (
    <li className="px-5 py-4">
      <form action={action} className="space-y-2">
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="moveOutId" value={item.move_out_id} />
        <input type="hidden" name="done" value={done ? "yes" : "no"} />
        <input type="hidden" name="note" value={note} />

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => {
              setDone(e.target.checked);
              // The hidden field is read from the form, so the submit has to
              // happen after React has written the new value into the DOM.
              requestAnimationFrame(() =>
                e.target.form?.requestSubmit(),
              );
            }}
            className="mt-1 h-5 w-5 shrink-0 accent-olive"
          />
          <span>
            <span
              className={cn(
                "font-medium",
                done ? "text-ink-soft line-through" : "text-ink",
              )}
            >
              {item.title}
            </span>
            {item.detail && (
              <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">
                {item.detail}
              </span>
            )}
          </span>
        </label>

        {noteOpen ? (
          <div className="pl-8">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={(e) => e.target.form?.requestSubmit()}
              placeholder="Anything worth saying about this one"
              className={`${inputClass} text-sm`}
            />
          </div>
        ) : (
          <div className="pl-8">
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="text-xs text-bark underline underline-offset-2"
            >
              Add a note
            </button>
          </div>
        )}

        {result && !result.ok && (
          <div className="pl-8">
            <Feedback result={result} />
          </div>
        )}
      </form>
    </li>
  );
}

/** Where the deposit and the stray post should go. */
function Forwarding({ moveOut }: { moveOut: MoveOutRow }) {
  const [result, action] = useActionState(setForwarding, null);

  return (
    <form action={action} className="space-y-4 px-5 py-5">
      <input type="hidden" name="moveOutId" value={moveOut.id} />
      <Field
        label="Where should we send things after you've gone"
        hint="Your deposit, and anything that arrives here with your name on it."
      >
        <textarea
          name="address"
          rows={3}
          defaultValue={moveOut.forwarding_address ?? ""}
          className={`${inputClass} resize-y`}
        />
      </Field>
      <Field label="An email that will still work">
        <input
          name="email"
          type="email"
          defaultValue={moveOut.forwarding_email ?? ""}
          className={inputClass}
        />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton>Save</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}

/**
 * The whole thing, as a tenant sees it.
 *
 * Signing is deliberately the last thing and deliberately not blocked by
 * unfinished lines. Somebody who has run out of time should be able to say so
 * honestly and have that recorded, rather than be pushed into ticking boxes
 * that aren't true to get out of the building.
 */
export function MoveOutChecklist({
  moveOut,
  items,
  hasSignature,
  verifyCode,
}: {
  moveOut: MoveOutRow;
  items: MoveOutItemRow[];
  hasSignature: boolean;
  verifyCode: string | null;
}) {
  const [result, action] = useActionState(finishMoveOut, null);

  const done = items.filter((i) => i.done_by_tenant).length;
  const outstanding = items.length - done;
  const signed = moveOut.status !== "open";

  const areas = items.reduce<Record<string, MoveOutItemRow[]>>((acc, item) => {
    (acc[item.area] ??= []).push(item);
    return acc;
  }, {});

  if (signed) {
    return (
      <div>
        <div className="space-y-3 px-5 py-5">
          <p className="flex items-start gap-2 text-[0.95rem] leading-relaxed text-ink-soft">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden />
            <span>
              You signed this on {dateShort(moveOut.updated_at)}.
              {verifyCode && (
                <>
                  {" "}
                  Your reference is{" "}
                  <strong className="font-mono text-ink">{verifyCode}</strong> —
                  worth keeping somewhere.
                </>
              )}
            </span>
          </p>
          <p className="text-sm text-ink-soft">
            {done} of {items.length} done.
            {outstanding > 0 &&
              ` You said ${outstanding} ${outstanding === 1 ? "was" : "were"} not.`}
          </p>
        </div>
        <div className="border-t border-tan/20">
          <Forwarding moveOut={moveOut} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-tan/20 bg-sage-pale/30 px-5 py-4">
        <p className="text-[0.95rem] leading-relaxed text-ink-soft">
          Leaving on <strong className="text-ink">{dateShort(moveOut.leaving_on)}</strong>.
          Work through this whenever suits — it saves as you go. When you&rsquo;re
          finished, sign at the bottom.
        </p>
        <p className="mt-2 text-sm text-bark">
          {done} of {items.length} done
        </p>
      </div>

      {Object.entries(areas).map(([area, areaItems]) => (
        <div key={area}>
          <p className="eyebrow !text-[0.6rem] border-b border-tan/20 bg-parchment px-5 py-2 text-bark">
            {area}
          </p>
          <ul className="divide-y divide-tan/20">
            {areaItems.map((item) => (
              <Item key={item.id} item={item} />
            ))}
          </ul>
        </div>
      ))}

      <Forwarding moveOut={moveOut} />

      <div className="border-t border-tan/20 bg-parchment px-5 py-5">
        {hasSignature ? (
          <form action={action} className="space-y-3">
            <input type="hidden" name="moveOutId" value={moveOut.id} />
            <p className="text-sm leading-relaxed text-ink-soft">
              Signing records the list exactly as it stands now, with the time
              and the device you signed on. It can&rsquo;t be changed afterwards
              — by you or by anyone else — which is what makes it worth
              something if there&rsquo;s ever a disagreement.
            </p>
            {outstanding > 0 && (
              <p className="text-sm leading-relaxed text-burgundy">
                {outstanding} {outstanding === 1 ? "line is" : "lines are"} not
                ticked. You can still sign — it will say so plainly, which is
                better than it being found later.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">
                <PenLine className="h-4 w-4" aria-hidden />
                Sign the clean-out list
              </Button>
              <Feedback result={result} />
            </div>
          </form>
        ) : (
          <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-bark" aria-hidden />
            Add your signature further up this page first, then come back and
            sign this.
          </p>
        )}
      </div>
    </div>
  );
}
