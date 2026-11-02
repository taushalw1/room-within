"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { getMoveOut } from "@/lib/data/move-out";
import { notifyAdmin } from "@/lib/email/send";
import { signDocument } from "./signature-actions";
import type { MoveOutItemRow } from "@/lib/data/types";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was changed.",
};
const NO_DB: ActionResult = { ok: false, message: "No connection just now." };

function refresh(id: string) {
  revalidatePath("/portal");
  revalidatePath("/admin/rentals");
  revalidatePath(`/admin/rentals/move-out/${id}`);
}

/**
 * Tick one line of the clean-out list.
 *
 * The tenant sends only the tick and their own note. The verdict and the
 * charge are Tausha's columns and are never written from here — a policy
 * cannot restrict which columns an update touches, so this is the place that
 * keeps that promise.
 */
export async function tickMoveOutItem(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser("/portal");
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      itemId: z.string().min(1),
      moveOutId: z.string().min(1),
      done: z.enum(["yes", "no"]),
      note: z.string().trim().max(500).optional(),
    })
    .safeParse({
      itemId: formData.get("itemId"),
      moveOutId: formData.get("moveOutId"),
      done: formData.get("done"),
      note: formData.get("note"),
    });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("move_out_items")
    .update({
      done_by_tenant: parsed.data.done === "yes",
      tenant_note: parsed.data.note || null,
    })
    .eq("id", parsed.data.itemId);

  if (error) return { ok: false, message: error.message };

  refresh(parsed.data.moveOutId);
  return { ok: true, message: "Saved." };
}

/** Where to send the deposit, and anything that arrives after they've gone. */
export async function setForwarding(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser("/portal");
  if (isDemoMode) return DEMO;

  const parsed = z
    .object({
      moveOutId: z.string().min(1),
      address: z.string().trim().max(500).optional(),
      email: z.string().trim().email("That email doesn't look right.").or(z.literal("")),
    })
    .safeParse({
      moveOutId: formData.get("moveOutId"),
      address: formData.get("address"),
      email: formData.get("email") ?? "",
    });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await getServerSupabase();
  if (!supabase) return NO_DB;

  const { error } = await supabase
    .from("move_outs")
    .update({
      forwarding_address: parsed.data.address || null,
      forwarding_email: parsed.data.email || null,
    })
    .eq("id", parsed.data.moveOutId);

  if (error) return { ok: false, message: error.message };

  refresh(parsed.data.moveOutId);
  return { ok: true, message: "Saved." };
}

/**
 * The words that get signed.
 *
 * Built from the list as it actually stands, line by line, including the ones
 * they said they hadn't done and anything they wrote. The hash covers this
 * text, so what is sealed is the real state of the flat on the day — not a
 * summary written afterwards, and not a generic form.
 */
function declarationText(
  leavingOn: string,
  items: MoveOutItemRow[],
  name: string,
): string {
  const lines = items.map((item) => {
    const mark = item.done_by_tenant ? "done" : "NOT DONE";
    const note = item.tenant_note ? ` — ${item.tenant_note}` : "";
    return `[${mark}] ${item.area}: ${item.title}${note}`;
  });

  const outstanding = items.filter((i) => !i.done_by_tenant).length;

  return [
    `Clean-out declaration — Room Within Community`,
    ``,
    `I, ${name}, am leaving on ${leavingOn}. I have been through the`,
    `clean-out list and the following is a true account of it on the day I`,
    `signed this.`,
    ``,
    ...lines,
    ``,
    outstanding === 0
      ? `Every line is done.`
      : `${outstanding} ${outstanding === 1 ? "line is" : "lines are"} not done, and I understand the cost of putting those right may be taken from my deposit.`,
    ``,
    `I understand that fair wear and tear is expected and is not charged for,`,
    `and that anything deducted will be itemised and evidenced.`,
  ].join("\n");
}

/**
 * Finish the clean-out and sign for it.
 *
 * Signing is what turns a checklist into something that settles an argument,
 * so it happens here rather than being an extra step they might not take.
 */
export async function finishMoveOut(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/portal");
  if (isDemoMode) return DEMO;

  const moveOutId = String(formData.get("moveOutId") ?? "");
  if (!moveOutId) return { ok: false, message: "Nothing to sign." };

  const found = await getMoveOut(moveOutId);
  if (!found) return { ok: false, message: "That move-out isn't there." };

  const name = user.fullName ?? user.email ?? "the tenant";
  const text = declarationText(found.moveOut.leaving_on, found.items, name);

  const signed = await signDocument({
    documentType: "move_out",
    documentId: moveOutId,
    documentTitle: `Clean-out declaration — leaving ${found.moveOut.leaving_on}`,
    documentText: text,
  });

  if (!signed.ok || !signed.eventId) return { ok: false, message: signed.message };

  // Stamped with the service key, not by the tenant: the row this points at is
  // the one we just created a moment ago under their own session, so it cannot
  // be made to point at somebody else's signature.
  const service = getServiceSupabase();
  if (service) {
    await service
      .from("move_outs")
      .update({ status: "tenant_done", tenant_signature_event: signed.eventId })
      .eq("id", moveOutId);
  }

  const outstanding = found.items.filter((i) => !i.done_by_tenant).length;

  await notifyAdmin({
    subject: `${name} has signed the clean-out list`,
    heading: "A clean-out list has been signed",
    bodyHtml: [
      `<p>${name} is leaving on ${found.moveOut.leaving_on} and has been through the clean-out list.</p>`,
      outstanding === 0
        ? `<p>Every line is marked done.</p>`
        : `<p><strong>${outstanding} ${outstanding === 1 ? "line is" : "lines are"} not done.</strong> Worth reading their notes before the walk-through.</p>`,
      `<p>Reference <strong>${signed.verifyCode}</strong>.</p>`,
    ].join(""),
    ctaPath: `/admin/rentals/move-out/${moveOutId}`,
  });

  refresh(moveOutId);
  return {
    ok: true,
    message: `Signed. Your reference is ${signed.verifyCode} — keep it.`,
  };
}
