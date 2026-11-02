import { getServiceSupabase } from "@/lib/supabase/server";

/**
 * Photos and receipts for maintenance reports.
 *
 * The bucket is private and has no storage policies at all, so nothing reaches
 * it with a user key. Everything goes through here with the service key, and
 * every caller has already checked who is asking. A path that leaks is worth
 * nothing on its own, and one renter can never reach another's photo.
 */

export const BUCKET = "maintenance";

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

export type UploadResult =
  | { ok: true; path: string | null }
  | { ok: false; message: string };

/**
 * Store a file and return its path.
 *
 * An empty file input means "no photo", not an error — most reports won't have
 * one, and a leaking tap is still worth telling somebody about.
 */
export async function storeFile(
  file: File | null,
  folder: string,
  name: string,
): Promise<UploadResult> {
  if (!file || file.size === 0) return { ok: true, path: null };

  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      message: "That photo is too big — anything under 10MB is fine.",
    };
  }

  if (!ALLOWED.has(file.type)) {
    return {
      ok: false,
      message: "That file type isn't one we can take. A photo or a PDF works.",
    };
  }

  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, message: "No storage connection." };

  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : (file.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");

  const path = `${folder}/${name}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  return { ok: true, path };
}

/**
 * A link to a stored file that works for a short while.
 *
 * Short-lived on purpose: a signed URL that lasted forever would be a public
 * URL with extra steps, and these are photos of the inside of people's homes.
 */
export async function signedUrl(
  path: string | null,
  seconds = 60 * 10,
): Promise<string | null> {
  if (!path) return null;

  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, seconds);

  return data?.signedUrl ?? null;
}

export async function removeFile(path: string | null): Promise<void> {
  if (!path) return;
  const supabase = getServiceSupabase();
  if (!supabase) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
