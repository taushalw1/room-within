import { headers } from "next/headers";

/**
 * Where a signature actually came from.
 *
 * Read from the request on the server, never sent up by the browser. A page
 * can claim anything about itself; a proxy header is at least recorded by
 * something the signer doesn't control.
 *
 * This is the evidence that distinguishes "signed on their phone, at home" from
 * "typed in by the landlord on her laptop": the two produce different
 * addresses and different devices, and both are written at the moment of
 * signing by the database, not by the form.
 */
export async function signingContext(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  const h = await headers();

  // Netlify and most proxies put the real client address first in this list.
  const forwarded = h.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    h.get("x-nf-client-connection-ip") ||
    h.get("x-real-ip") ||
    null;

  return { ip, userAgent: h.get("user-agent") };
}

/** The clean-out list a tenant works through. Grouped so it reads as rooms. */
export const MOVE_OUT_CHECKLIST: {
  area: string;
  title: string;
  detail: string;
}[] = [
  {
    area: "Everywhere",
    title: "Everything of yours is out",
    detail:
      "Including the cupboards, the back of them, and anything stored elsewhere in the building. Anything left behind after the final date is treated as abandoned.",
  },
  {
    area: "Everywhere",
    title: "Floors swept and washed",
    detail: "Under and behind furniture too, now that it's gone.",
  },
  {
    area: "Everywhere",
    title: "Walls wiped, marks removed",
    detail:
      "Scuffs that wipe off, please do. Nail holes are normal wear — leave them, don't fill them badly.",
  },
  {
    area: "Everywhere",
    title: "Windows and sills cleaned, inside",
    detail: "Including the tracks, which collect more than you'd think.",
  },
  {
    area: "Everywhere",
    title: "Light fittings working, bulbs replaced",
    detail: "Any bulb that's gone during your tenancy.",
  },
  {
    area: "Kitchen",
    title: "Fridge emptied, defrosted and wiped",
    detail: "Leave the door propped slightly open so it doesn't go musty.",
  },
  {
    area: "Kitchen",
    title: "Oven, hob and extractor cleaned",
    detail: "This is the one most often missed, and the most expensive to put right.",
  },
  {
    area: "Kitchen",
    title: "Cupboards and drawers emptied and wiped out",
    detail: "",
  },
  {
    area: "Kitchen",
    title: "Sink and taps clean, drain running freely",
    detail: "",
  },
  {
    area: "Bathroom",
    title: "Toilet, basin, bath and shower cleaned",
    detail: "Including any limescale and anything growing in the grout.",
  },
  {
    area: "Bathroom",
    title: "Mirrors and cabinets emptied and wiped",
    detail: "",
  },
  {
    area: "Bathroom",
    title: "Extractor fan cover cleaned",
    detail: "",
  },
  {
    area: "Finishing up",
    title: "Rubbish and recycling taken away",
    detail:
      "Not left in the bins for collection day — taken off the property, including anything bulky.",
  },
  {
    area: "Finishing up",
    title: "All keys, fobs and remotes returned",
    detail: "Including any you had cut. Say how many there are.",
  },
  {
    area: "Finishing up",
    title: "Meter readings taken and sent",
    detail: "A photo of each meter on your last day settles any argument later.",
  },
  {
    area: "Finishing up",
    title: "Post redirected and address updated",
    detail: "So nothing of yours keeps arriving here.",
  },
  {
    area: "Finishing up",
    title: "Anything broken or worn declared",
    detail:
      "Tell us now rather than letting it be found. Honest wear is expected and nobody is charged for it; a surprise is what causes trouble.",
  },
];
