"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { signingContext } from "@/lib/signing";
import { countInkPixels } from "@/lib/png-ink";

export type ActionResult = { ok: boolean; message: string };

const DEMO: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was signed.",
};

const SIG_BUCKET = "signatures";

// Roughly: more than a stray tap. A short drawn stroke across the pad lands
// around 700, a real signature in the thousands; a dot is a few dozen.
const INK_NEEDED = 150;

/**
 * Store the signature a person has just drawn.
 *
 * The image arrives as a data URL from a canvas. It is written with the
 * service key because the bucket has no policies, but only after
 * `requireUser` has established who is asking — and the row it attaches to is
 * keyed on their own profile id, which they cannot change.
 */
export async function saveSignature(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/portal");
  if (isDemoMode) return DEMO;

  const dataUrl = String(formData.get("image") ?? "");
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);

  if (!match) {
    return { ok: false, message: "That didn't come through — try drawing it again." };
  }

  const bytes = Buffer.from(match[1], "base64");

  if (bytes.byteLength > 2 * 1024 * 1024) {
    return { ok: false, message: "That's too large to store." };
  }

  // A blank canvas still produces a perfectly valid — and far from small —
  // PNG, so emptiness is decided by counting the pixels that were actually
  // drawn on. The browser knows this too and keeps the button greyed out, but
  // the browser is not what we trust.
  const ink = countInkPixels(bytes);
  if (ink === null) {
    return { ok: false, message: "That image didn't come through properly — try again." };
  }
  if (ink < INK_NEEDED) {
    return { ok: false, message: "That looks empty. Draw your signature and try again." };
  }

  const service = getServiceSupabase();
  const supabase = await getServerSupabase();
  if (!service || !supabase) {
    return { ok: false, message: "No connection just now." };
  }

  const path = `${user.id}/signature-${Date.now()}.png`;

  const { error: upErr } = await service.storage
    .from(SIG_BUCKET)
    .upload(path, bytes, { contentType: "image/png", upsert: false });

  if (upErr) return { ok: false, message: `Couldn't save it: ${upErr.message}` };

  const { ip, userAgent } = await signingContext();

  // Written through the user's own session, so the policy (profile_id =
  // auth.uid()) is what decides whether it lands.
  // Recorded, not judged. A photograph of a signature on paper is weaker
  // evidence than one drawn on the device in front of you, and anyone looking
  // at this later should be told which it was rather than left to assume.
  const source = formData.get("source") === "uploaded" ? "uploaded" : "drawn";

  const { error } = await supabase.from("signatures").upsert(
    {
      profile_id: user.id,
      contact_id: user.contactId,
      image_path: path,
      source,
      created_ip: ip,
      created_ua: userAgent,
    },
    { onConflict: "profile_id" },
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/portal");
  return {
    ok: true,
    message: "Saved. It'll be used whenever you sign something here.",
  };
}

/**
 * Sign a document.
 *
 * The text being signed is passed in and stored verbatim, then hashed by the
 * database. Nothing about the sealing — the hash, the chain, the timestamp —
 * is computed here, because anything this code could compute, somebody with
 * access to this code could fake.
 *
 * Note what is absent: there is no admin version of this function, and no way
 * to pass in a different signer. The row carries `signed_by: user.id` and the
 * insert policy refuses anything else.
 */
export async function signDocument(args: {
  documentType: "lease" | "move_out" | "condition_report" | "policy" | "other";
  documentId: string | null;
  documentTitle: string;
  documentText: string;
}): Promise<{
  ok: boolean;
  message: string;
  verifyCode?: string;
  eventId?: string;
}> {
  const user = await requireUser("/portal");
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { data: sig } = await supabase
    .from("signatures")
    .select("image_path, source")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!sig) {
    return {
      ok: false,
      message:
        "Add your signature to your profile first — it only takes a moment.",
    };
  }

  const { ip, userAgent } = await signingContext();

  const { data, error } = await supabase
    .from("signature_events")
    .insert({
      document_type: args.documentType,
      document_id: args.documentId,
      document_title: args.documentTitle,
      document_text: args.documentText,
      signed_by: user.id,
      signer_name: user.fullName ?? user.email ?? "Unknown",
      signer_email: user.email ?? "",
      signature_path: (sig as { image_path: string }).image_path,
      signature_source:
        (sig as { source: string | null }).source === "uploaded"
          ? "uploaded"
          : "drawn",
      ip,
      user_agent: userAgent,
      // These are set by the database trigger; the values sent are ignored.
      document_hash: "",
      record_hash: "",
      verify_code: "",
    })
    .select("id, verify_code")
    .single();

  if (error) return { ok: false, message: `Couldn't record that: ${error.message}` };

  revalidatePath("/portal");
  revalidatePath("/admin/rentals");

  const event = data as { id: string; verify_code: string };

  return {
    ok: true,
    message: "Signed and recorded.",
    verifyCode: event.verify_code,
    eventId: event.id,
  };
}
