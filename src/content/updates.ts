/**
 * What's new in the app.
 *
 * Written for Tausha, which sets every rule about it: plain words, no file
 * names, no jargon, and each entry says what she can now *do* rather than what
 * was built. If an entry needs her to decide something or turn something on,
 * that is said plainly rather than left to be discovered.
 *
 * This lives in the code next to the work it describes so the two ship
 * together and cannot drift. Add a new entry at the top whenever something
 * reaches the live site.
 */

export type UpdateEntry = {
  /** YYYY-MM-DD, the day it went live. */
  date: string;
  title: string;
  /** One or two sentences: what this means for her day. */
  summary: string;
  /** The specifics, in plain language. */
  points?: string[];
  /** Where to go and try it. */
  link?: { href: string; label: string };
  /** Something she has to decide or switch on. */
  needsYou?: string;
  /** For the small coloured label. */
  kind: "new" | "better" | "fixed";
};

export const updates: UpdateEntry[] = [
  {
    date: "2026-11-02",
    kind: "new",
    title: "Photograph a receipt instead of typing it",
    summary:
      "When you record a cost, point your phone at the receipt and the boxes fill themselves in — the date, who it was paid to, the total, the GST and what it was for.",
    points: [
      "Nothing is saved until you press the button. Check the total and the date against the paper first.",
      "It tells you what it couldn't read rather than guessing. On a receipt torn off above the total it leaves the total blank and says so.",
      "It files things using the categories you already use.",
    ],
    link: { href: "/admin/finance", label: "Try it on the Finance page" },
  },
  {
    date: "2026-11-02",
    kind: "new",
    title: "What the next six months look like",
    summary:
      "Rent coming in, invoices already raised, your regular costs going out, and what's left in the account at the end of each month.",
    points: [
      "A tenancy that ends stops paying in the month it ends — which is the only reason to look ahead.",
      "Only costs you've actually paid in three of the last six months count as regular, so one big repair never becomes a monthly expectation.",
      "Nothing hoped for is in it. No grant that might come, no room that might let.",
    ],
    needsYou:
      "Type in what's actually in the account at the top of it — nobody can look that up for you, and the rest only becomes useful once it's there.",
    link: { href: "/admin/finance", label: "On the Finance page" },
  },
  {
    date: "2026-11-02",
    kind: "new",
    title: "One screen for a new renter",
    summary:
      "Everything about somebody moving in, in one go, rather than scattered across four places.",
    points: [
      "Who they are, the room, the dates, the rent and the deposit — and the things that otherwise go on an envelope: emergency contact, how many keys, their car, who else is living there.",
      "Picking a room fills in the rent and deposit. Picking somebody off the waiting list fills in their details and takes them off it.",
      "At the end it offers to raise their first rent invoice and send them a welcome email.",
      "The emergency contact now shows on the room list in red, where you'd look for it at eleven at night.",
    ],
    link: { href: "/admin/rentals/new", label: "Move somebody in" },
  },
  {
    date: "2026-11-02",
    kind: "new",
    title: "Signing things, properly",
    summary:
      "Everyone has a signature kept on their account — drawn with a finger, or a photo of your signature on paper. After that, anything signed in the app carries it with the date and time.",
    points: [
      "Only the person themselves can sign. You can't sign for a tenant even from your own account — the database refuses it.",
      "What they signed is fixed, and nothing can be edited or removed afterwards by anyone.",
      "It records whether the signature was drawn on their own device or uploaded as a picture, because those aren't equally strong evidence.",
    ],
    link: { href: "/portal", label: "Add yours on your account page" },
  },
  {
    date: "2026-11-02",
    kind: "new",
    title: "Ending a tenancy is a record, not a memory",
    summary:
      "A clean-out list the tenant works through in their own account, your walk-through beside it line by line, and the deposit as a list of movements rather than a number you keep adjusting.",
    points: [
      "They can sign with things still unticked — it says so plainly, which is far more useful to you than a tidy list of lies.",
      "Every deduction needs a reason and a receipt.",
      "It won't let you close a move-out while the deposit balance is anything but nil.",
    ],
    link: { href: "/admin/rentals", label: "On the Rentals page" },
  },
  {
    date: "2026-11-02",
    kind: "new",
    title: "A note each morning",
    summary:
      "A short email first thing with the things that actually need you that day: repairs waiting and how long, who's in the building, tenancies running out, where each move-out has got to, and what's overdue.",
    points: [
      "Nothing arrives on a quiet morning. An email that says 'nothing to report' every day is one you stop reading.",
      "A repair nobody has acknowledged for a week is flagged, because that's how a tenant decides not to bother reporting the next one.",
      "Jobs that are late and warranties about to run out appear in it too.",
    ],
    needsYou: "It's already on. Settings → 'Your morning note' if you'd rather it stopped.",
  },
  {
    date: "2026-11-02",
    kind: "new",
    title: "A page for looking after the building",
    summary:
      "The jobs that come round, who you call for what, what's still under warranty, and what each room has cost you.",
    points: [
      "Tick a recurring job off and the next one is counted from the day you actually did it, not the day it was due.",
      "Contractors have their numbers tappable from your phone and a line for how it went last time, in your own words.",
      "Warranties keep a photo of the paperwork — a furnace with eight years of cover left is worth nothing if nobody can find the card.",
      "Repairs are grouped by room, and anything reported more than once is called out.",
    ],
    link: { href: "/admin/building", label: "The building" },
  },
  {
    date: "2026-11-02",
    kind: "new",
    title: "Statements, rooms that pay, and a waiting list",
    summary:
      "Three smaller things on the money side.",
    points: [
      "A statement of account for anyone — everything charged and paid, in order, with a running balance, as a PDF you can attach to an email. Tenants can get their own.",
      "Each room's year: what came in, what was spent on it, and how many days it stood empty with what those days cost.",
      "A waiting list. Anyone who asks goes on it whether or not something is free, and when a room comes free the people it would suit are marked.",
    ],
  },
  {
    date: "2026-11-02",
    kind: "new",
    title: "Profile pictures",
    summary:
      "Everyone can add a picture of themselves. After choosing a photo you can drag it around and zoom in until the right part of it is in the circle.",
    points: [
      "Groundwork for the message threads coming next — a name on its own reads as paperwork, a face reads as a person.",
    ],
    link: { href: "/portal", label: "Add yours" },
  },
  {
    date: "2026-11-02",
    kind: "new",
    title: "Late fees, if you want them",
    summary:
      "The app can add a fee to an invoice that stays unpaid. It is off, and stays off until you turn it on.",
    points: [
      "A fee is added once per invoice — never again the next month on the same debt.",
      "Never more than what's owed, and never past a ceiling you set.",
      "It appears as its own small invoice so the tenant can see exactly what it is.",
    ],
    needsYou:
      "In Alberta a late fee can only be charged if it's written into the agreement the tenant signed. If it isn't in theirs, put it in the next one rather than charging it now.",
  },
  {
    date: "2026-11-02",
    kind: "fixed",
    title: "The app could show an error on a page that was fine",
    summary:
      "Most likely on your phone, after an update, with no way for you to clear it. The part that makes the app work offline was holding on to old program files and handing them out instead of the new ones.",
    points: [
      "It now throws away what it had saved the next time you open the app.",
      "If you ever see that error again, tell Tyler it's the service worker and he'll know what it means.",
    ],
  },
];

/** The most recent entry, for the little dot in the menu. */
export const latestUpdate = updates[0]?.date ?? null;
