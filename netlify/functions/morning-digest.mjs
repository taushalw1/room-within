/**
 * The morning note, and the late-fee run that precedes it.
 *
 * Like the other scheduled functions, this does no work itself — it calls the
 * app's own /api/cron/digest route, so there is one implementation rather
 * than two that drift.
 *
 * 13:00 UTC is 7am in Alberta in summer and 6am in winter. Early on purpose:
 * it should be sitting there when she first looks at her phone, not arrive
 * part-way through the morning when the day has already been decided.
 */
export default async () => {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!base) {
    console.error("No site URL available — cannot call the digest route.");
    return new Response("Missing site URL", { status: 500 });
  }

  if (!secret) {
    console.error("CRON_SECRET is not set — the digest route will refuse this.");
    return new Response("Missing CRON_SECRET", { status: 500 });
  }

  const response = await fetch(`${base}/api/cron/digest`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await response.text();

  if (!response.ok) {
    console.error(`Morning digest failed: ${response.status} ${body}`);
    return new Response(body, { status: response.status });
  }

  console.log(`Morning digest: ${body}`);
  return new Response(body, { status: 200 });
};

export const config = {
  schedule: "0 13 * * *",
};
