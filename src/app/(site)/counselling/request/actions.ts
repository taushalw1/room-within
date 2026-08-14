"use server";

import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { notifyAdmin, sendCounsellingRequestAck } from "@/lib/email/send";

export type RequestResult =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent"; message: string };

const schema = z.object({
  fullName: z.string().min(2, "Please give your name."),
  email: z.string().email("That email address doesn't look right."),
  phone: z.string().max(40).optional().nullable(),
  preferredTimes: z.string().max(200).optional().nullable(),
  message: z.string().max(3000).optional().nullable(),
  consent: z.literal("on", {
    errorMap: () => ({ message: "Please tick the box so we can reply to you." }),
  }),
});

export async function submitCounsellingRequest(
  _prev: RequestResult | null,
  formData: FormData,
): Promise<RequestResult> {
  const parsed = schema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    preferredTimes: formData.get("preferredTimes"),
    message: formData.get("message"),
    consent: formData.get("consent"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  const v = parsed.data;

  const confirmation =
    "Thank you for reaching out. Tausha has your message and will be in touch personally within a couple of working days.";

  if (isDemoMode) {
    return {
      status: "sent",
      message: `${confirmation} (This is a preview, so nothing was actually sent.)`,
    };
  }

  const supabase = await getServerSupabase();
  if (!supabase) {
    return { status: "error", message: "This form isn't switched on yet." };
  }

  const { error } = await supabase.from("counselling_requests").insert({
    full_name: v.fullName,
    email: v.email,
    phone: v.phone || null,
    preferred_times: v.preferredTimes || null,
    message: v.message || null,
  });

  if (error) {
    return {
      status: "error",
      message: "Something went wrong sending that. Please try again, or email us directly.",
    };
  }

  await sendCounsellingRequestAck({ to: v.email, name: v.fullName });

  // Deliberately does not repeat what the person wrote — the message stays in
  // the admin area rather than sitting in an inbox.
  await notifyAdmin({
    subject: "New counselling enquiry",
    heading: "Someone has asked about counselling",
    bodyHtml: `<p><strong>${v.fullName}</strong> has sent an enquiry through the website. Open the admin area to read it.</p>`,
    ctaPath: "/admin/counselling#requests",
  });

  return { status: "sent", message: confirmation };
}
