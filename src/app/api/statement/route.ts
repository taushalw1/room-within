import { getCurrentUser } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase/server";
import { buildStatement, buildStatementPdf } from "@/lib/statement";
import { site } from "@/lib/site";
import type { InvoiceRow } from "@/lib/data/types";

/**
 * A statement of account, as a PDF.
 *
 *   /api/statement?contact=<id>&from=2026-01-01&to=2026-12-31
 *
 * Tausha may ask for anybody's. A signed-in tenant may ask only for their own
 * — and that is settled here by ignoring the contact they asked for and using
 * the one attached to their profile, rather than by comparing the two and
 * hoping the comparison is right.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const url = new URL(request.url);
  const asked = url.searchParams.get("contact");

  const contactId = user.role === "admin" ? (asked ?? user.contactId) : user.contactId;
  if (!contactId) return new Response("No account to report on", { status: 404 });

  const year = new Date().getFullYear();
  const from = url.searchParams.get("from") ?? `${year}-01-01`;
  const to = url.searchParams.get("to") ?? `${year}-12-31`;

  const supabase = getServiceSupabase();
  if (!supabase) return new Response("No database", { status: 503 });

  const [contactRes, invoiceRes, paymentRes] = await Promise.all([
    supabase.from("contacts").select("full_name").eq("id", contactId).maybeSingle(),
    supabase.from("invoice_balances").select("*").eq("contact_id", contactId),
    supabase
      .from("payments")
      .select("id, invoice_id, amount_cents, paid_at, method")
      .eq("contact_id", contactId),
  ]);

  const contact = contactRes.data as { full_name: string } | null;
  if (!contact) return new Response("Not found", { status: 404 });

  const statement = buildStatement({
    name: contact.full_name,
    from,
    to,
    invoices: (invoiceRes.data as InvoiceRow[]) ?? [],
    payments:
      (paymentRes.data as {
        id: string;
        invoice_id: string | null;
        amount_cents: number;
        paid_at: string;
        method: string | null;
      }[]) ?? [],
  });

  const pdf = await buildStatementPdf(statement, site.name);

  const safeName = contact.full_name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="statement-${safeName}-${from}-to-${to}.pdf"`,
      // Never cached by anything in between: it has somebody's money in it.
      "Cache-Control": "private, no-store",
    },
  });
}
