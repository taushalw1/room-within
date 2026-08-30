import { getServiceSupabase } from "@/lib/supabase/server";
import { sendWelcome } from "@/lib/email/send";

/**
 * Send the welcome email, but only ever once per person.
 *
 * Sign-in is passwordless, so there's no "sign up" event to hook — the account
 * appears the first time someone follows an emailed link. This claims the
 * welcome by stamping `welcomed_at` *before* sending, and only for a row where
 * it's still null. Two sign-ins racing each other therefore produce one email,
 * not two.
 *
 * Failures are swallowed deliberately: a welcome email that doesn't send is
 * not a reason to stop someone signing in.
 */
export async function sendWelcomeOnce(userId: string) {
  const supabase = getServiceSupabase();
  if (!supabase) return;

  try {
    // Claim it. The `is null` guard is what makes this single-shot.
    const { data, error } = await supabase
      .from("profiles")
      .update({ welcomed_at: new Date().toISOString() })
      .eq("id", userId)
      .is("welcomed_at", null)
      .select("email, full_name")
      .maybeSingle();

    if (error || !data?.email) return; // already welcomed, or no address

    const result = await sendWelcome({
      to: data.email as string,
      name: (data.full_name as string) ?? null,
    });

    // Sending failed — release the claim so the next sign-in tries again.
    if (!result.ok) {
      await supabase
        .from("profiles")
        .update({ welcomed_at: null })
        .eq("id", userId);
    }
  } catch {
    // Never let this break the sign-in flow.
  }
}
