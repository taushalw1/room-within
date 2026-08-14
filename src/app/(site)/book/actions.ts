"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getRoomBySlug } from "@/lib/data/public";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { getStripe } from "@/lib/stripe";
import { quoteBooking } from "@/lib/pricing";
import { notifyAdmin, sendBookingReceived } from "@/lib/email/send";
import { dateTimeRange } from "@/lib/format";

export type BookingResult =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "requested"; message: string }
  | { status: "redirect"; url: string };

const schema = z.object({
  roomSlug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time."),
  hours: z.coerce.number().min(0.5).max(12),
  name: z.string().min(2, "Please give your name."),
  email: z.string().email("That email address doesn't look right."),
  phone: z.string().max(40).optional().nullable(),
  title: z.string().min(2, "What should we call this booking?"),
  purpose: z.string().max(2000).optional().nullable(),
  attendees: z.coerce.number().int().min(1).max(500).optional(),
  showOnCalendar: z.coerce.boolean().optional(),
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function requestBooking(
  _prev: BookingResult | null,
  formData: FormData,
): Promise<BookingResult> {
  const parsed = schema.safeParse({
    roomSlug: formData.get("roomSlug"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    hours: formData.get("hours"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    title: formData.get("title"),
    purpose: formData.get("purpose"),
    attendees: formData.get("attendees") || undefined,
    showOnCalendar: formData.get("showOnCalendar") === "on",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  const v = parsed.data;
  const room = await getRoomBySlug(v.roomSlug);
  if (!room) return { status: "error", message: "That room isn't available." };

  const start = new Date(`${v.date}T${v.startTime}:00`);
  const end = new Date(start.getTime() + v.hours * 3_600_000);

  if (Number.isNaN(start.getTime())) {
    return { status: "error", message: "That date and time didn't make sense." };
  }
  if (start < new Date()) {
    return { status: "error", message: "That time is in the past." };
  }

  const quote = quoteBooking(room, start, end);
  const when = dateTimeRange(start, end);

  if (isDemoMode) {
    return {
      status: "requested",
      message:
        `This is a preview, so nothing was actually booked — but this is exactly what would happen. ` +
        `${room.name}, ${when}, ${(quote.totalCents / 100).toFixed(2)} including GST.`,
    };
  }

  const supabase = await getServerSupabase();
  if (!supabase) {
    return { status: "error", message: "Bookings aren't switched on yet." };
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      room_id: room.id,
      booker_name: v.name,
      booker_email: v.email,
      booker_phone: v.phone || null,
      title: v.title,
      purpose: v.purpose || null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      attendees: v.attendees ?? null,
      status: "pending",
      total_cents: quote.totalCents,
      is_paid: false,
      is_public: Boolean(v.showOnCalendar),
    })
    .select("id")
    .single();

  if (error) {
    // 23P01 is Postgres' exclusion-constraint violation — the room is taken.
    // The database is what guarantees this, so two people clicking at the same
    // moment can't both get the slot.
    if (error.code === "23P01") {
      return {
        status: "error",
        message:
          "Someone just took that time. Please pick another slot — the calendar below is up to date.",
      };
    }
    return { status: "error", message: `Couldn't save that: ${error.message}` };
  }

  revalidatePath("/book");

  // Rooms Tausha vets are never charged up front — she confirms first.
  if (room.requires_approval) {
    await sendBookingReceived({
      to: v.email,
      name: v.name,
      roomName: room.name,
      when,
      needsApproval: true,
    });
    await notifyAdmin({
      subject: `Room request — ${room.name}`,
      heading: "A new room request",
      bodyHtml: `<p><strong>${v.name}</strong> (${v.email}) asked for <strong>${room.name}</strong> on ${when}.</p><p>${v.title}</p>`,
      ctaPath: "/admin/bookings",
    });

    return {
      status: "requested",
      message:
        "Thank you — your request has been sent. Tausha will confirm it shortly, usually within a day, and you'll get an email either way.",
    };
  }

  // Instant-book rooms go straight to payment.
  const stripe = getStripe();
  if (!stripe) {
    await sendBookingReceived({
      to: v.email,
      name: v.name,
      roomName: room.name,
      when,
      needsApproval: true,
    });
    return {
      status: "requested",
      message:
        "Thank you — your booking is in. Tausha will be in touch about payment.",
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: v.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: quote.totalCents,
          product_data: {
            name: `${room.name} — ${when}`,
            description: `${quote.basis} rate, including GST`,
          },
        },
      },
    ],
    success_url: `${SITE_URL}/book/thank-you?booking=${booking.id}`,
    cancel_url: `${SITE_URL}/book?room=${room.slug}&cancelled=1`,
    metadata: { booking_id: booking.id, kind: "booking" },
  });

  await supabase
    .from("bookings")
    .update({ stripe_session_id: session.id })
    .eq("id", booking.id);

  if (!session.url) {
    return { status: "error", message: "Couldn't open the payment page." };
  }

  return { status: "redirect", url: session.url };
}
