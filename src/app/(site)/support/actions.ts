"use server";

import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { site } from "@/lib/site";

export type DonateResult =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "redirect"; url: string };

const schema = z.object({
  amount: z.coerce
    .number()
    .min(5, "The smallest donation we can take is $5.")
    .max(50000, "For a gift this size, please get in touch directly — we'd like to thank you properly."),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email("That email address doesn't look right."),
  message: z.string().trim().max(500).optional(),
  anonymous: z.coerce.boolean().optional(),
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4300";

/**
 * Sends someone to Stripe to donate.
 *
 * The donation is only recorded once Stripe confirms payment through the
 * webhook — never here, and never from the thank-you page, which anyone can
 * navigate to directly.
 */
export async function startDonation(
  _prev: DonateResult | null,
  formData: FormData,
): Promise<DonateResult> {
  const parsed = schema.safeParse({
    amount: formData.get("amount"),
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
    anonymous: formData.get("anonymous") === "on",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  const v = parsed.data;
  const stripe = getStripe();

  if (!stripe) {
    return {
      status: "error",
      message: `Card donations aren't switched on yet. Please email ${site.email} and we'll arrange it — and thank you.`,
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: v.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: Math.round(v.amount * 100),
          product_data: {
            name: "Donation to Room Within Community",
            description: "Towards purchasing and restoring the 1905 building.",
          },
        },
      },
    ],
    success_url: `${SITE_URL}/support/thank-you`,
    cancel_url: `${SITE_URL}/support?cancelled=1`,
    metadata: {
      kind: "donation",
      anonymous: v.anonymous ? "true" : "false",
      message: (v.message ?? "").slice(0, 400),
      donor_name: v.name ?? "",
    },
  });

  if (!session.url) {
    return { status: "error", message: "Couldn't open the payment page." };
  }

  return { status: "redirect", url: session.url };
}
