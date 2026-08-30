import { getServiceSupabase } from "@/lib/supabase/server";
import { generateRentInvoices } from "@/lib/invoices";

/**
 * Raises the monthly rent invoices.
 *
 * Runs daily rather than on the 1st, deliberately: a missed run then costs
 * nothing, where a monthly schedule that failed silently would skip a month's
 * rent entirely and nobody would notice until the money didn't arrive.
 *
 * Safe to run repeatedly — a partial unique index on (lease_id, period_start)
 * refuses a second invoice for the same lease and month, so idempotency is
 * enforced by the database rather than by trusting this code.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret) {
    // Fail closed in production: this writes real invoices that trigger real
    // emails asking people for money.
    if (process.env.NODE_ENV === "production") {
      console.error("CRON_SECRET is not set — refusing to generate invoices.");
      return new Response("Not configured", { status: 503 });
    }
  } else if (auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return Response.json({ ok: false, reason: "no database" });

  const result = await generateRentInvoices(supabase);

  if (result.errors.length) console.error("Rent generation errors:", result.errors);
  console.log(
    `Rent generation: created ${result.created}, skipped ${result.skipped}, periods ${result.periods.join(", ")}`,
  );

  return Response.json({ ok: true, ...result });
}
