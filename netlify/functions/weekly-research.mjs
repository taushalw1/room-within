/**
 * The Monday morning hunt for grants and conferences.
 *
 * 13:00 UTC on Mondays is 06:00 in Alberta through the summer and 07:00 in
 * winter — the point is that it has run by the time she sits down, not that it
 * lands on a precise minute.
 *
 * Weekly, not daily: every run costs real money at the API, and funding
 * programs do not change hour to hour.
 */
export default async () => {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!base || !secret) {
    console.error("Missing NEXT_PUBLIC_SITE_URL or CRON_SECRET.");
    return new Response("Not configured", { status: 500 });
  }

  const response = await fetch(`${base}/api/cron/research`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await response.text();
  if (!response.ok) {
    console.error(`Weekly research failed: ${response.status} ${body}`);
    return new Response(body, { status: response.status });
  }

  console.log(`Weekly research: ${body}`);
  return new Response(body, { status: 200 });
};

export const config = {
  schedule: "0 13 * * 1",
};
