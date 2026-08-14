import { differenceInCalendarDays } from "date-fns";
import { getServiceSupabase } from "@/lib/supabase/server";
import { sendInvoiceReminder } from "@/lib/email/send";

/**
 * Daily reminder run. Triggered by Vercel Cron (see vercel.json).
 *
 * The schedule:
 *   3 days before due   → "coming up"
 *   on the due date     → "due today"
 *   3, 7 and 14 days late → escalating reminders
 *
 * `reminder_log` has a unique constraint on (invoice_id, kind), so a given
 * reminder can only ever be sent once — even if this route runs twice in a
 * day, or someone triggers it by hand.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ReminderKind =
  | "upcoming"
  | "due_today"
  | "overdue_3"
  | "overdue_7"
  | "overdue_14";

function kindForDaysOverdue(daysOverdue: number): ReminderKind | null {
  if (daysOverdue >= 14) return "overdue_14";
  if (daysOverdue >= 7) return "overdue_7";
  if (daysOverdue >= 3) return "overdue_3";
  if (daysOverdue === 0) return "due_today";
  if (daysOverdue === -3) return "upcoming";
  return null;
}

export async function GET(request: Request) {
  // Vercel Cron sends this header; a secret keeps the URL from being useful
  // to anyone who finds it.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return Response.json({ ok: false, reason: "no database" });

  const { data: invoices, error } = await supabase
    .from("invoice_balances")
    .select("*, contacts:contact_id (full_name, email)")
    .in("state", ["outstanding", "overdue"]);

  if (error) return Response.json({ ok: false, error: error.message });

  const today = new Date();
  let sent = 0;
  let skipped = 0;

  for (const invoice of invoices ?? []) {
    const contact = invoice.contacts as { full_name: string; email: string | null };
    if (!contact?.email) {
      skipped++;
      continue;
    }

    const daysOverdue = differenceInCalendarDays(
      today,
      new Date(invoice.due_date as string),
    );
    const kind = kindForDaysOverdue(daysOverdue);
    if (!kind) {
      skipped++;
      continue;
    }

    // Claim this reminder first. If the insert conflicts, it has already gone
    // out — so we never send twice, even if two runs overlap.
    const { error: claimError } = await supabase.from("reminder_log").insert({
      invoice_id: invoice.id,
      kind,
      to_email: contact.email,
    });

    if (claimError) {
      skipped++;
      continue;
    }

    const result = await sendInvoiceReminder({
      to: contact.email,
      name: contact.full_name,
      invoiceNumber: (invoice.number as string) ?? "",
      description: (invoice.description as string) ?? "Amount owing",
      dueDate: invoice.due_date as string,
      balanceCents: invoice.balance_cents as number,
      daysOverdue: Math.max(0, daysOverdue),
    });

    if (result.ok) {
      sent++;
    } else {
      // Sending failed — release the claim so tomorrow's run tries again.
      await supabase
        .from("reminder_log")
        .delete()
        .eq("invoice_id", invoice.id)
        .eq("kind", kind);
      skipped++;
    }
  }

  return Response.json({ ok: true, sent, skipped });
}
