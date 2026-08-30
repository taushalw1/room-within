import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getServiceSupabase } from "@/lib/supabase/server";
import {
  notifyAdmin,
  sendBookingConfirmed,
  sendDonationThanks,
} from "@/lib/email/send";
import { dateTimeRange, moneyExact } from "@/lib/format";

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
      // The name comes from our own form. Stripe Checkout doesn't ask for one
      // unless billing address collection is on, so customer_details is only a
      // fallback.
      const donorName =
        session.metadata?.donor_name || session.customer_details?.name || null;
      const donorEmail =
        session.customer_email ?? session.customer_details?.email ?? null;
      const amount = session.amount_total ?? 0;
      const anonymous = session.metadata?.anonymous === "true";
      const donorMessage = session.metadata?.message || null;

      await supabase.from("donations").insert({
        donor_name: donorName,
        email: donorEmail,
        amount_cents: amount,
        is_anonymous: anonymous,
        message: donorMessage,
        stripe_session_id: session.id,
      });

      // Thanking them is the whole point of taking the donation politely, so
      // it happens here rather than being left to Stripe's own receipt — which
      // is unbranded and only sent if receipt emails are switched on.
      if (donorEmail) {
        await sendDonationThanks({
          to: donorEmail,
          name: donorName,
          amountCents: amount,
        });
      }

      await notifyAdmin({
        subject: `Donation received — ${moneyExact(amount)}`,
        heading: "A donation has come in",
        bodyHtml: `
          <p style="margin:0 0 14px;"><strong>${moneyExact(amount)}</strong> from
          ${anonymous ? "someone who asked to stay anonymous" : (donorName ?? "someone who didn't leave a name")}.</p>
          ${donorEmail ? `<p style="margin:0 0 14px;">${donorEmail}</p>` : ""}
          ${donorMessage ? `<p style="margin:0 0 14px;">They wrote: ${donorMessage}</p>` : ""}
          <p style="margin:0;">They've been thanked already — no need to reply unless you'd like to.</p>`,
        ctaPath: "/admin/finance",
      });
    }
  }

  return new Response("ok", { status: 200 });
}
