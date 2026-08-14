import Stripe from "stripe";

/**
 * Stripe client.
 *
 * Returns null when the secret key isn't set, so the booking flow degrades to
 * "request received, Tausha will invoice you" rather than failing outright.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Pin nothing here — the installed SDK's default API version is what its
  // types are generated against, so letting it choose keeps the two in step.
  return new Stripe(key);
}

export const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
