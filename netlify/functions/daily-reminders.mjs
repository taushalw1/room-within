/**
 * Daily rent-reminder run.
 *
 * Netlify's equivalent of a cron job. It doesn't do the work itself — it calls
 * the app's own /api/cron/reminders route, so there is one implementation of
 * the reminder logic rather than two that can drift apart.
 *
 * The schedule is UTC: 15:00 is 9am in Alberta during summer, 8am in winter.
 *
 * Requires CRON_SECRET to be set in Netlify's environment variables, matching
 * the one the route checks. Without it the route refuses the call, which is
 * the point — the URL alone shouldn't be enough to trigger a send.
 */
export default async () => {
  // Netlify provides URL (the site's main address) at runtime.
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!base) {
    console.error("No site URL available — cannot call the reminder route.");
    return new Response("Missing site URL", { status: 500 });
  }

  if (!secret) {
    console.error("CRON_SECRET is not set — the reminder route will refuse this.");
    return new Response("Missing CRON_SECRET", { status: 500 });
  }

  const response = await fetch(`${base}/api/cron/reminders`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await response.text();

  if (!response.ok) {
    console.error(`Reminder run failed: ${response.status} ${body}`);
    return new Response(body, { status: response.status });
  }

  // Shows up in the function log, so you can see what went out and when.
  console.log(`Reminder run: ${body}`);
  return new Response(body, { status: 200 });
};

export const config = {
  schedule: "0 15 * * *",
};
