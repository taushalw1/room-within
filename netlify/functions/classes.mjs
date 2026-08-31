/**
 * The self-running class rules: confirm or cancel sessions, and hand out each
 * month's credits.
 *
 * Runs at 13:00 UTC — before the rent job and the reminders, so a class
 * cancelled this morning is already cancelled by the time anybody is emailed
 * about money.
 *
 * Calls the app's own route rather than doing the work here, so there is one
 * implementation of the rules.
 */
export default async () => {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!base || !secret) {
    console.error("Missing NEXT_PUBLIC_SITE_URL or CRON_SECRET.");
    return new Response("Not configured", { status: 500 });
  }

  const response = await fetch(`${base}/api/cron/classes`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await response.text();
  if (!response.ok) {
    console.error(`Class routine failed: ${response.status} ${body}`);
    return new Response(body, { status: response.status });
  }

  console.log(`Class routine: ${body}`);
  return new Response(body, { status: 200 });
};

export const config = {
  schedule: "0 13 * * *",
};
