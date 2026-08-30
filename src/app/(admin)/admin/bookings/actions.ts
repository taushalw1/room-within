"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { sendBookingConfirmed } from "@/lib/email/send";
import { dateTimeRange } from "@/lib/format";
import { z } from "zod";
import { quoteBooking } from "@/lib/pricing";

export type ActionResult = { ok: boolean; message: string };

const DEMO_RESULT: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was changed.",
};

async function setBookingStatus(
  bookingId: string,
  status: "confirmed" | "cancelled",
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { data: booking, error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId)
    .select("*, rooms:room_id (name)")
    .single();

  if (error) return { ok: false, message: error.message };

  if (status === "confirmed" && booking) {
    const room = booking.rooms as { name: string } | null;
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

  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  revalidatePath("/calendar");

  return {
    ok: true,
    message:
      status === "confirmed"
        ? "Confirmed, and the booker has been emailed."
        : "Booking declined.",
  };
}

export async function approveBooking(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return setBookingStatus(String(formData.get("bookingId") ?? ""), "confirmed");
}

export async function declineBooking(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return setBookingStatus(String(formData.get("bookingId") ?? ""), "cancelled");
}

/* ---------------------------------------------------------------------------
   Editing a booking
   --------------------------------------------------------------------------- */

const editSchema = z.object({
  bookingId: z.string().min(1),
  roomId: z.string().min(1, "Choose a room."),
  title: z.string().trim().min(2, "What should this booking be called?"),
  purpose: z.string().trim().max(2000).optional(),
  date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "Choose a date."),
  startTime: z.string().regex(/^[0-9]{2}:[0-9]{2}$/, "Choose a start time."),
  hours: z.coerce.number().min(0.5).max(12),
  attendees: z.coerce.number().int().min(1).max(500).optional(),
  bookerName: z.string().trim().min(2, "Who is it for?"),
  bookerEmail: z.string().trim().email("That email address doesn't look right."),
  bookerPhone: z.string().trim().max(40).optional(),
  isPublic: z.coerce.boolean().optional(),
  reprice: z.coerce.boolean().optional(),
  adminNotes: z.string().trim().max(2000).optional(),
});

/**
 * Change a booking — most often moving it to a different time.
 *
 * The price is left alone unless asked: someone who has already paid, or been
 * quoted, shouldn't find the figure has moved because Tausha shifted them by
 * an hour as a favour.
 */
export async function updateBooking(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = editSchema.safeParse({
    bookingId: formData.get("bookingId"),
    roomId: formData.get("roomId"),
    title: formData.get("title"),
    purpose: formData.get("purpose"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    hours: formData.get("hours"),
    attendees: formData.get("attendees") || undefined,
    bookerName: formData.get("bookerName"),
    bookerEmail: formData.get("bookerEmail"),
    bookerPhone: formData.get("bookerPhone"),
    isPublic: formData.get("isPublic") === "on",
    reprice: formData.get("reprice") === "on",
    adminNotes: formData.get("adminNotes"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const v = parsed.data;
  const starts = new Date(`${v.date}T${v.startTime}:00`);
  const ends = new Date(starts.getTime() + v.hours * 3_600_000);

  if (Number.isNaN(starts.getTime())) {
    return { ok: false, message: "That date and time didn't make sense." };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const update: Record<string, unknown> = {
    room_id: v.roomId,
    title: v.title,
    purpose: v.purpose || null,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    attendees: v.attendees ?? null,
    booker_name: v.bookerName,
    booker_email: v.bookerEmail,
    booker_phone: v.bookerPhone || null,
    is_public: Boolean(v.isPublic),
    admin_notes: v.adminNotes || null,
  };

  if (v.reprice) {
    const { data: room } = await supabase
      .from("rooms")
      .select("hourly_rate_cents, half_day_rate_cents, full_day_rate_cents, min_hours")
      .eq("id", v.roomId)
      .single();

    if (room) {
      update.total_cents = quoteBooking(
        room as Parameters<typeof quoteBooking>[0],
        starts,
        ends,
      ).totalCents;
    }
  }

  const { error } = await supabase
    .from("bookings")
    .update(update)
    .eq("id", v.bookingId);

  if (error) {
    // 23P01 is the exclusion constraint: the room is taken at that time. The
    // database is what guarantees this, so it can't be sidestepped here.
    if (error.code === "23P01") {
      return {
        ok: false,
        message:
          "That room is already booked over part of that time. Pick another slot, or cancel the other booking first.",
      };
    }
    return { ok: false, message: `Couldn't save that: ${error.message}` };
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/calendar");
  revalidatePath("/book");
  revalidatePath("/admin");

  return {
    ok: true,
    message: v.reprice
      ? "Booking updated and repriced. Let them know if the amount changed."
      : "Booking updated. The price is unchanged — tick 'recalculate' if it should move.",
  };
}
