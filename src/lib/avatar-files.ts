import { getServiceSupabase } from "@/lib/supabase/server";

const BUCKET = "avatars";

/**
 * A link to somebody's profile picture that works for a while.
 *
 * Longer-lived than the signature and repair-photo links, because these are
 * meant to appear next to every message in a thread and a link that expires
 * mid-conversation would leave a page full of broken faces. An hour is still
 * far short of "a public URL with extra steps".
 */
export async function avatarUrl(
  path: string | null,
  seconds = 60 * 60,
): Promise<string | null> {
  if (!path) return null;

  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, seconds);

  return data?.signedUrl ?? null;
}

/** Several at once, for a list of people. */
export async function avatarUrls(
  paths: (string | null)[],
  seconds = 60 * 60,
): Promise<(string | null)[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return paths.map(() => null);

  const wanted = paths.filter((p): p is string => Boolean(p));
  if (wanted.length === 0) return paths.map(() => null);

  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(wanted, seconds);

  const byPath = new Map(
    (data ?? []).map((row) => [row.path, row.signedUrl ?? null]),
  );

  return paths.map((p) => (p ? (byPath.get(p) ?? null) : null));
}

/** Remove one, when it is being replaced. */
export async function removeAvatar(path: string | null): Promise<void> {
  if (!path) return;
  const supabase = getServiceSupabase();
  if (!supabase) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
