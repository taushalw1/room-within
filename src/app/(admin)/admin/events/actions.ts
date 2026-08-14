"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; message: string };

const DEMO_RESULT: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was saved. Connect the database to add real events.",
};

const schema = z
  .object({
    title: z.string().trim().min(2, "Give the event a name."),
    description: z.string().trim().max(4000).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    allDay: z.coerce.boolean().optional(),
    atBuilding: z.coerce.boolean().optional(),
    roomId: z.string().optional(),
    location: z.string().trim().max(200).optional(),
    hostName: z.string().trim().max(120).optional(),
    contactEmail: z
      .string()
      .trim()
      .email("That email address doesn't look right.")
      .optional()
      .or(z.literal("")),
    category: z.string().trim().max(60).optional(),
    externalUrl: z
      .string()
      .trim()
      .url("That web address doesn't look right.")
      .optional()
      .or(z.literal("")),
    publish: z.coerce.boolean().optional(),
  })
  .refine((v) => v.allDay || (v.startTime && v.endTime), {
    message: "Give a start and finish time, or tick 'all day'.",
  });

/** Turn "Beginner Sewing Circle" into "beginner-sewing-circle". */
function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "") // strip accents left behind by NFKD
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function addEvent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const parsed = schema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    allDay: formData.get("allDay") === "on",
    atBuilding: formData.get("atBuilding") === "on",
    roomId: formData.get("roomId") || undefined,
    location: formData.get("location"),
    hostName: formData.get("hostName"),
    contactEmail: formData.get("contactEmail"),
    category: formData.get("category"),
    externalUrl: formData.get("externalUrl"),
    publish: formData.get("publish") === "on",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const v = parsed.data;

  const startsAt = v.allDay
    ? new Date(`${v.date}T00:00:00`)
    : new Date(`${v.date}T${v.startTime}:00`);
  const endsAt = v.allDay
    ? new Date(`${v.date}T23:59:00`)
    : new Date(`${v.date}T${v.endTime}:00`);

  if (endsAt <= startsAt) {
    return { ok: false, message: "The finish time needs to be after the start." };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  // Slugs are unique, so add a suffix rather than failing on a repeat name —
  // "Thursday Coffee Group" happens every week.
  const base = slugify(v.title) || "event";
  let slug = base;
  const { data: clash } = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (clash) slug = `${base}-${v.date.replace(/-/g, "").slice(4)}`;

  const { error } = await supabase.from("events").insert({
    title: v.title,
    slug,
    description: v.description || null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    all_day: Boolean(v.allDay),
    location: v.location || null,
    is_at_building: Boolean(v.atBuilding),
    room_id: v.atBuilding && v.roomId ? v.roomId : null,
    host_name: v.hostName || null,
    contact_email: v.contactEmail || null,
    category: v.category || "community",
    external_url: v.externalUrl || null,
    status: v.publish ? "published" : "draft",
  });

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  revalidatePath("/admin/events");
  revalidatePath("/calendar");
  revalidatePath("/");

  return {
    ok: true,
    message: v.publish
      ? "Added, and it's now on the community calendar."
      : "Saved as a draft — publish it when you're ready.",
  };
}

/** Publish, unpublish, or cancel an event that's already been created. */
export async function setEventStatus(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO_RESULT;

  const id = String(formData.get("eventId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !["draft", "published", "cancelled"].includes(status)) {
    return { ok: false, message: "That didn't work." };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No database connection." };

  const { error } = await supabase
    .from("events")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/events");
  revalidatePath("/calendar");
  revalidatePath("/");

  return {
    ok: true,
    message:
      status === "published"
        ? "It's on the community calendar."
        : status === "cancelled"
          ? "Marked as cancelled."
          : "Taken off the calendar.",
  };
}
