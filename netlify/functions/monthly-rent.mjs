/**
 * Raises the monthly rent invoices.
 *
 * Runs at 14:00 UTC — an hour before the reminder job, so any invoice raised
 * today is already in place when reminders are worked out.
 *
 * Like the reminders, this calls the app's own route rather than doing the
 * work itself, so there's one implementation of the rules.
 */
export default async () => {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!base || !secret) {
    console.error("Missing NEXT_PUBLIC_SITE_URL or CRON_SECRET.");
    return new Response("Not configured", { status: 500 });
  }

  const response = await fetch(`${base}/api/cron/invoices`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await response.text();
  if (!response.ok) {
    console.error(`Rent generation failed: ${response.status} ${body}`);
    return new Response(body, { status: response.status });
  }

  console.log(`Rent generation: ${body}`);
  return new Response(body, { status: 200 });
};

export const config = {
  schedule: "0 14 * * *",
};
