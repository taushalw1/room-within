"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { sendBookingConfirmed } from "@/lib/email/send";
import { dateTimeRange } from "@/lib/format";

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
