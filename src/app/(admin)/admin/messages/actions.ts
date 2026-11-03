"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { sendTenantMessage } from "@/lib/email/send";
import { fill } from "@/lib/templates";
import { site } from "@/lib/site";
import { dateLong, moneyExact } from "@/lib/format";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = { ok: false, message: "Demo mode — nothing was sent." };

/* -------------------------------------------------------------------------- */
/*  Keeping the templates                                                     */
/* -------------------------------------------------------------------------- */

const templateSchema = z.object({
  name: z.string().trim().min(1, "Give it a name you'll recognise."),
  subject: z.string().trim().min(1, "It needs a subject line."),
  body: z.string().trim().min(10, "There's not much of a message there."),
});

export async function saveTemplate(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const id = formData.get("id");

  const { error } =
    typeof id === "string" && id
      ? await supabase.from("message_templates").update(parsed.data).eq("id", id)
      : await supabase.from("message_templates").insert(parsed.data);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/messages");
  return { ok: true, message: "Saved." };
}

/**
 * Put a template away.
 *
 * Marked inactive rather than deleted, so the log can still say which
 * template a message two years ago came from.
 */
export async function retireTemplate(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "That didn't come through." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { error } = await supabase
    .from("message_templates")
    .update({ is_active: false })
    .eq("id", id.data);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/messages");
  return { ok: true, message: "Put away. Anything already sent still says so." };
}

/* -------------------------------------------------------------------------- */
/*  Sending one                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What a given person's blanks fill in to.
 *
 * Gathered on the server from the records rather than taken from the form.
 * A balance typed into a browser is a balance somebody can mistype, and this
 * one goes into an email telling a tenant what they owe.
 */
async function valuesFor(contactId: string): Promise<Record<string, string>> {
  const supabase = await getServerSupabase();
  if (!supabase) return {};

  const [{ data: contact }, { data: leases }, { data: invoices }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id, full_name")
        .eq("id", contactId)
        .maybeSingle(),
      supabase
        .from("leases")
        .select("rent_cents, end_date, status, units(name)")
        .eq("contact_id", contactId)
        .eq("status", "active"),
      // The view, not the table: the balance and the state are derived there
      // from what has actually been paid, and a figure worked out here would
      // be a second opinion that could disagree with the rest of the app.
      supabase
        .from("invoice_balances")
        .select("balance_cents, due_date, state")
        .eq("contact_id", contactId)
        .in("state", ["outstanding", "overdue"])
        .order("due_date", { ascending: true }),
    ]);

  const name = (contact as { full_name: string } | null)?.full_name ?? "";

  const lease = (
    leases as unknown as
      | {
          rent_cents: number;
          end_date: string | null;
          units: { name: string } | { name: string }[] | null;
        }[]
      | null
  )?.[0];

  // Supabase types an embedded relation as an array even where at most one
  // row can come back.
  const unit = lease
    ? Array.isArray(lease.units)
      ? lease.units[0]
      : lease.units
    : null;

  const owing = (invoices as { balance_cents: number; due_date: string }[]) ?? [];
  const balance = owing.reduce((sum, i) => sum + i.balance_cents, 0);

  const values: Record<string, string> = {
    name,
    first_name: name.split(/\s+/)[0] ?? "",
    today: dateLong(new Date()),
    landlord: "Tausha",
    building: site.name,
  };

  if (unit?.name) values.unit = unit.name;
  if (lease?.rent_cents) values.rent = moneyExact(lease.rent_cents);
  if (lease?.end_date) values.lease_end = dateLong(lease.end_date);
  if (balance > 0) values.balance = moneyExact(balance);
  if (owing[0]?.due_date) values.due_date = dateLong(owing[0].due_date);

  return values;
}

async function demoValues(contactId: string): Promise<Record<string, string>> {
  const { getContacts } = await import("@/lib/data/admin");
  const contacts = await getContacts();
  const name = contacts.find((c) => c.id === contactId)?.full_name ?? "";

  return {
    name,
    first_name: name.split(/\s+/)[0] ?? "",
    today: dateLong(new Date()),
    landlord: "Tausha",
    building: site.name,
  };
}

/** What the message will say, for the preview, without sending anything. */
export async function previewForContact(
  contactId: string,
  subject: string,
  body: string,
): Promise<{
  subject: string;
  body: string;
  missing: string[];
  unknown: string[];
}> {
  await requireAdmin();

  // The demo has no leases or invoices to read, so only the blanks that can
  // be answered from the contact list are filled. The rest stay visible,
  // which is the right lesson for anybody poking at the demo: this is what
  // happens when there is nothing on file.
  const values = isDemoMode
    ? await demoValues(contactId)
    : await valuesFor(contactId);

  const s = fill(subject, values);
  const b = fill(body, values);

  return {
    subject: s.text,
    body: b.text,
    missing: [...new Set([...s.missing, ...b.missing])],
    unknown: [...new Set([...s.unknown, ...b.unknown])],
  };
}

const sendSchema = z.object({
  contactId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

/**
 * Send it.
 *
 * Filled in again here rather than trusting the text the browser posted. The
 * preview is a preview; what goes out is built on the server from the records
 * as they stand at the moment of sending, and a message with any blank left
 * in it is refused rather than sent with braces in it.
 */
export async function sendMessage(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = sendSchema.safeParse({
    contactId: formData.get("contactId"),
    templateId: formData.get("templateId") || undefined,
    subject: formData.get("subject"),
    body: formData.get("body"),
  });

  if (!parsed.success) return { ok: false, message: "Something's missing." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, email")
    .eq("id", parsed.data.contactId)
    .maybeSingle();

  const person = contact as { full_name: string; email: string | null } | null;

  if (!person) return { ok: false, message: "I can't find that person." };
  if (!person.email) {
    return {
      ok: false,
      message: `There's no email address on file for ${person.full_name}.`,
    };
  }

  const values = await valuesFor(parsed.data.contactId);
  const subject = fill(parsed.data.subject, values);
  const body = fill(parsed.data.body, values);

  const problems = [
    ...new Set([
      ...subject.missing,
      ...body.missing,
      ...subject.unknown,
      ...body.unknown,
    ]),
  ];

  if (problems.length > 0) {
    return {
      ok: false,
      message: `Nothing sent — I couldn't fill in ${problems
        .map((p) => `{{${p}}}`)
        .join(", ")}. Take it out or choose someone it applies to.`,
    };
  }

  const sent = await sendTenantMessage({
    to: person.email,
    subject: subject.text,
    body: body.text,
    heading: subject.text,
  });

  // Logged either way. A failed send that left no trace looks exactly like
  // never having tried, and that is how somebody goes unchased for a month.
  await supabase.from("messages_sent").insert({
    contact_id: parsed.data.contactId,
    to_email: person.email,
    to_name: person.full_name,
    template_id: parsed.data.templateId ?? null,
    subject: subject.text,
    body: body.text,
    delivered: sent.ok,
    failure: sent.ok ? null : sent.message,
    sent_by: admin.id,
  });

  revalidatePath("/admin/messages");

  return sent.ok
    ? { ok: true, message: `Sent to ${person.full_name}.` }
    : { ok: false, message: `Not sent: ${sent.message}` };
}
