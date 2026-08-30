"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase/server";
import { linkContact } from "@/lib/profile";

export type ActionResult = { ok: boolean; message: string };

const schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Please give your name.")
    .max(80)
    .refine((v) => !v.includes("@"), {
      message: "That looks like an email address — your name is fine.",
    }),
  phone: z.string().trim().max(40).optional(),
  next: z.string().optional(),
});

/**
 * Saves the name someone gives on first sign-in.
 *
 * Written to both `profiles` (what the site greets them by) and `contacts`
 * (what Tausha sees in her lists), because they're separate records joined by
 * profiles.contact_id. Letting them drift would mean the website calls someone
 * Sarah while the rentals page still lists an email address.
 */
export async function saveName(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/welcome");

  const parsed = schema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const { fullName, phone } = parsed.data;

  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, message: "Couldn't save that just now." };

  const contactId = await linkContact(user.id, user.email);

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) return { ok: false, message: "Couldn't save that just now." };

  if (contactId) {
    await supabase
      .from("contacts")
      .update({
        full_name: fullName,
        ...(phone ? { phone } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId);
  }

  revalidatePath("/portal");

  const next = parsed.data.next;
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/portal";

  redirect(safeNext);
}
