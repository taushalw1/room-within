"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServiceSupabase } from "@/lib/supabase/server";
import { removeAvatar } from "@/lib/avatar-files";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was changed.",
};

const BUCKET = "avatars";
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Store the square the person framed for themselves.
 *
 * The cropping, the zoom and the shrinking to 512 across all happen in the
 * browser, so what arrives here is already the finished picture — not a 12
 * megapixel photograph that has to be processed on a server and would be slow
 * to send from a phone on village broadband.
 *
 * Because of that, the size limit here is a backstop against something
 * unexpected rather than the thing that protects the upload.
 */
export async function saveAvatar(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/portal");
  if (isDemoMode) return DEMO;

  const dataUrl = String(formData.get("image") ?? "");
  const match = dataUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);

  if (!match) {
    return { ok: false, message: "That didn't come through — try again." };
  }

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.byteLength > MAX_BYTES) {
    return { ok: false, message: "That picture is too large." };
  }

  const service = getServiceSupabase();
  if (!service) return { ok: false, message: "No connection just now." };

  // What is there now, so it can be cleared up once the new one is safely in.
  const { data: existing } = await service
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  const contentType = match[1] === "png" ? "image/png" : "image/jpeg";
  const path = `${user.id}/avatar-${Date.now()}.${match[1] === "png" ? "png" : "jpg"}`;

  const { error: upErr } = await service.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });

  if (upErr) return { ok: false, message: `Couldn't save it: ${upErr.message}` };

  // `profiles` has no update policy — deliberately, since one would let a
  // person set their own role. So this goes through the service key, keyed to
  // the id `requireUser` established, exactly as the name form does.
  const { error } = await service
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", user.id);

  if (error) {
    await removeAvatar(path);
    return { ok: false, message: error.message };
  }

  await removeAvatar((existing as { avatar_path: string | null } | null)?.avatar_path ?? null);

  revalidatePath("/portal");
  return { ok: true, message: "That's your picture now." };
}

/** Take it down again. */
export async function clearAvatar(): Promise<ActionResult> {
  const user = await requireUser("/portal");
  if (isDemoMode) return DEMO;

  const service = getServiceSupabase();
  if (!service) return { ok: false, message: "No connection just now." };

  const { data: existing } = await service
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await service
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", user.id);

  if (error) return { ok: false, message: error.message };

  await removeAvatar((existing as { avatar_path: string | null } | null)?.avatar_path ?? null);

  revalidatePath("/portal");
  return { ok: true, message: "Removed." };
}
