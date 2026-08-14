import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getServiceSupabase } from "@/lib/supabase/server";
import { sendBookingConfirmed } from "@/lib/email/send";
import { dateTimeRange } from "@/lib/format";

/**
 * Stripe webhook.
 *
 * This is the only place a booking is marked paid. The browser redirect to the
 * thank-you page is not proof of payment — a visitor can navigate straight to
 * that URL — so payment state is only ever written from a signature-verified
 * webhook.
 *
 * Runs with the service key because Stripe arrives with no user session.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return new Response("Stripe not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return new Response(`Signature check failed: ${message}`, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return new Response("No database", { status: 503 });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const kind = session.metadata?.kind;

    if (kind === "booking") {
      const bookingId = session.metadata?.booking_id;
      if (!bookingId) return new Response("ok", { status: 200 });

      const { data: booking } = await supabase
        .from("bookings")
        .update({ is_paid: true, status: "confirmed" })
        .eq("id", bookingId)
        .select("*, rooms:room_id (name)")
        .single();

      if (booking) {
        const room = booking.rooms as { name: string } | null;

        // Record the money against a contact, creating one if this is a new face.
        const email = (booking.booker_email as string).toLowerCase();
        let contactId = booking.contact_id as string | null;

        if (!contactId) {
          const { data: existing } = await supabase
            .from("contacts")
            .select("id")
            .ilike("email", email)
            .maybeSingle();

          if (existing) {
            contactId = existing.id as string;
          } else {
            const { data: created } = await supabase
              .from("contacts")
              .insert({
                full_name: booking.booker_name,
                email: booking.booker_email,
                phone: booking.booker_phone,
                tags: ["booking"],
              })
              .select("id")
              .single();
            contactId = (created?.id as string) ?? null;
          }

          if (contactId) {
            await supabase
              .from("bookings")
              .update({ contact_id: contactId })
              .eq("id", bookingId);
          }
        }

        if (contactId) {
          const amount = session.amount_total ?? (booking.total_cents as number);

          const { data: invoice } = await supabase
            .from("invoices")
            .insert({
              contact_id: contactId,
              booking_id: bookingId,
              kind: "booking",
              description: `${room?.name ?? "Room"} — ${booking.title}`,
              due_date: new Date().toISOString().slice(0, 10),
              amount_cents: amount,
              status: "paid",
              stripe_payment_intent_id:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : null,
            })
            .select("id")
            .single();

          await supabase.from("payments").insert({
            invoice_id: invoice?.id ?? null,
            contact_id: contactId,
            amount_cents: amount,
            method: "stripe",
            stripe_payment_intent_id:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
          });
        }

        await sendBookingConfirmed({
          to: booking.booker_email as string,
          name: booking.booker_name as string,
          roomName: room?.name ?? "your room",
          when: dateTimeRange(
            booking.starts_at as string,
            booking.ends_at as string,
          ),
        });
      }
    }

    if (kind === "donation") {
      await supabase.from("donations").insert({
        donor_name: session.customer_details?.name ?? null,
        email: session.customer_details?.email ?? null,
        amount_cents: session.amount_total ?? 0,
        is_anonymous: session.metadata?.anonymous === "true",
        message: session.metadata?.message ?? null,
        stripe_session_id: session.id,
      });
    }
  }

  return new Response("ok", { status: 200 });
}
