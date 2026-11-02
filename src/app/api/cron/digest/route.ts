import { site } from "@/lib/site";
import { getServiceSupabase } from "@/lib/supabase/server";
import { buildDigest, digestAsText } from "@/lib/digest";
import { getDigestSettings } from "@/lib/data/settings";
import { applyLateFees } from "@/lib/late-fees";
import { sendMorningDigest } from "@/lib/email/send";

/**
 * The morning run.
 *
 * Late fees are charged first and the digest is built afterwards, so a fee
 * raised this morning appears in the same email rather than turning up
 * tomorrow with no explanation.
 *
 * Nothing is sent on a quiet day. An email that says "nothing to report"
 * every morning is an email that stops being read, and the one morning it
 * matters it will be deleted with the rest.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("CRON_SECRET is not set — refusing to run the morning digest.");
      return new Response("Not configured", { status: 503 });
    }
  } else if (auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return Response.json({ ok: false, reason: "no database" });

  const fees = await applyLateFees(supabase);

  const settings = await getDigestSettings();
  if (!settings.enabled) {
    return Response.json({ ok: true, sent: false, reason: "digest turned off", fees });
  }

  const digest = await buildDigest(supabase);

  // `?force=1` so the run can be checked without waiting for a day that
  // happens to have something in it.
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (digest.quiet && !force) {
    return Response.json({ ok: true, sent: false, reason: "quiet day", fees });
  }

  const overdueWord =
    digest.money.overdueCount === 0
      ? "Nothing is overdue."
      : `${money(digest.money.overdueCents)} is overdue across ${digest.money.overdueCount} ${
          digest.money.overdueCount === 1 ? "invoice" : "invoices"
        }.`;

  const moneyLines = [
    overdueWord,
    digest.money.dueTodayCount > 0
      ? `${money(digest.money.dueTodayCents)} falls due today.`
      : "Nothing falls due today.",
    ...(digest.money.paidYesterdayCents > 0
      ? [`${money(digest.money.paidYesterdayCents)} came in yesterday.`]
      : []),
    ...(fees.charged > 0
      ? [`${fees.charged} late ${fees.charged === 1 ? "fee" : "fees"} charged, ${money(fees.total_cents)}.`]
      : []),
  ];

  const needsHer =
    digest.repairs.filter((r) => r.urgent).length +
    digest.building.filter((b) => b.urgent).length +
    digest.leases.filter((l) => l.urgent).length +
    digest.moveOuts.filter((m) => m.urgent).length;

  const result = await sendMorningDigest({
    to: process.env.ADMIN_EMAIL ?? site.email,
    date: digest.date,
    headline:
      needsHer > 0
        ? `Good morning. ${needsHer} ${needsHer === 1 ? "thing needs" : "things need"} you today.`
        : "Good morning. Nothing is urgent today.",
    money: moneyLines,
    sections: [
      { title: "Today", lines: digest.today },
      { title: "Repairs waiting", lines: digest.repairs },
      { title: "The building", lines: digest.building },
      { title: "Tenancies ending", lines: digest.leases },
      { title: "Move-outs", lines: digest.moveOuts },
    ],
    text: digestAsText(digest),
  });

  return Response.json({ ok: result.ok, sent: result.ok, fees, message: result.message });
}
