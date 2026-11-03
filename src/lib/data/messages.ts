import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { STARTER_TEMPLATES } from "@/lib/templates";
import type { MessageSentRow, MessageTemplateRow } from "./types";

/**
 * Saved messages and the record of what was sent.
 *
 * In demo mode the starters stand in for the real table, so the page can be
 * looked at — and so a fresh clone shows what templates are for rather than
 * an empty list that explains nothing.
 */

const demoTemplates: MessageTemplateRow[] = STARTER_TEMPLATES.map((t, i) => ({
  id: `m1000000-0000-4000-8000-00000000000${i}`,
  name: t.name,
  subject: t.subject,
  body: t.body,
  is_active: true,
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T09:00:00Z",
}));

export async function getMessageTemplates(): Promise<MessageTemplateRow[]> {
  if (isDemoMode) return demoTemplates;

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("message_templates")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return (data as MessageTemplateRow[]) ?? [];
}

export async function getSentMessages(limit = 50): Promise<MessageSentRow[]> {
  if (isDemoMode) {
    return [
      {
        id: "s1",
        contact_id: "c2",
        to_email: "sarah@example.com",
        to_name: "Sarah Kemp",
        template_id: demoTemplates[0].id,
        subject: "Rent for Office 2",
        body: "Hello Sarah,\n\nI don't think the rent for Office 2 has come through yet…",
        delivered: true,
        failure: null,
        sent_by: null,
        sent_at: "2026-11-04T16:20:00Z",
      },
    ];
  }

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("messages_sent")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(limit);

  return (data as MessageSentRow[]) ?? [];
}

/**
 * When each contact was last written to.
 *
 * Only successful sends count. A message that failed is not a message they
 * received, and treating it as one is how somebody goes unchased for a month
 * because the app believes it already spoke to them.
 */
export async function getLastContacted(): Promise<Map<string, string>> {
  const sent = await getSentMessages(500);
  const last = new Map<string, string>();

  for (const m of sent) {
    if (!m.contact_id || !m.delivered) continue;
    const existing = last.get(m.contact_id);
    if (!existing || m.sent_at > existing) last.set(m.contact_id, m.sent_at);
  }

  return last;
}
