import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Table";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServiceSupabase } from "@/lib/supabase/server";

export const metadata = { robots: { index: false, follow: false } };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function CounsellingSubscribePage() {
  const admin = await requireAdmin();

  let token = "demo-token-not-a-real-secret-000000";

  if (!isDemoMode) {
    const supabase = getServiceSupabase();
    if (supabase) {
      const { data: existing } = await supabase
        .from("calendar_tokens")
        .select("token")
        .eq("owner_id", admin.id)
        .eq("kind", "counselling")
        .maybeSingle();

      if (existing) {
        token = existing.token as string;
      } else {
        const { data: created } = await supabase
          .from("calendar_tokens")
          .insert({ owner_id: admin.id, kind: "counselling" })
          .select("token")
          .single();
        token = (created?.token as string) ?? token;
      }
    }
  }

  const feed = `${SITE_URL}/api/calendar/counselling/${token}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/admin/counselling"
        className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-olive-deep"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to counselling
      </Link>

      <header>
        <h1 className="text-3xl">Your schedule in Google Calendar</h1>
        <p className="mt-2 text-ink-soft">
          Subscribe once and your sessions appear alongside everything else in
          your calendar, updating on their own.
        </p>
      </header>

      <Card>
        <CardHeader title="Your private calendar address" />
        <div className="px-5 py-5">
          <p className="break-all rounded-[var(--radius-card)] bg-parchment px-4 py-3 font-mono text-xs text-olive-deep">
            {feed}
          </p>

          <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
            <li>Copy the address above.</li>
            <li>
              Open Google Calendar on a computer. Beside &ldquo;Other
              calendars&rdquo;, click <strong>+</strong> then{" "}
              <strong>From URL</strong>.
            </li>
            <li>
              Paste it in, click <strong>Add calendar</strong>, and it&rsquo;ll
              start appearing.
            </li>
          </ol>
        </div>
      </Card>

      <Card className="border-burgundy/25 bg-blush/30">
        <div className="flex gap-4 px-5 py-5">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-burgundy" aria-hidden />
          <div className="text-sm text-ink-soft">
            <h2 className="font-display text-base font-semibold text-burgundy">
              Treat this address like a password
            </h2>
            <p className="mt-2">
              This feed includes your clients&rsquo; names. Google
              can&rsquo;t send a password when it checks a calendar, so the
              secret has to sit in the web address itself — anyone who has the
              full address can read your schedule.
            </p>
            <p className="mt-2">
              Don&rsquo;t forward it, don&rsquo;t paste it into a shared
              document, and don&rsquo;t add it to a calendar other people can
              see. If it ever gets out, ask Claude to{" "}
              <em>&ldquo;reset my counselling calendar link&rdquo;</em> — the
              old address stops working immediately.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
