import { getServiceSupabase } from "@/lib/supabase/server";

/**
 * Links to stored signature images.
 *
 * Same arrangement as maintenance photos: a private bucket with no policies,
 * read only through here, and only ever after the caller has established who
 * is asking. Signatures are the last thing that should sit behind a guessable
 * URL.
 */
export async function signatureUrl(
  path: string | null,
  seconds = 60 * 10,
): Promise<string | null> {
  if (!path) return null;

  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const { data } = await supabase.storage
    .from("signatures")
    .createSignedUrl(path, seconds);

  return data?.signedUrl ?? null;
}
