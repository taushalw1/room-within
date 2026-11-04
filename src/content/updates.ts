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
    date: "2026-11-03",
    kind: "better",
    title: "A shorter menu",
    summary:
      "The menu had grown to twenty things and you had to scroll sideways to find any of them. It's eight now, grouped by what they're for.",
    points: [
      "Renting holds tenancies, moving somebody in, repairs and the building.",
      "Money holds the overview, bills and mileage, the bank and year end.",
      "People holds everyone, messages and counselling. Plans holds the plan, grants and conferences.",
      "Nothing was taken away — once you're in a section, its pages appear in a row underneath.",
    ],
  },
  {
    date: "2026-11-03",
    kind: "new",
    title: "Rooms 1 to 13 are in",
    summary:
      "All thirteen rooms are set up and ready for people. Rates are blank on purpose — you set each one.",
    points: [
      "Set a room's rate from the Edit button on Settings, whenever you've worked out what it's worth.",
      "You can put somebody in a room before setting its rate — just type what they're actually paying.",
      "Photos, square footage and what's in each room can come later. Nothing is waiting on them.",
      "The four old rooms from when the app was being built — Office 1, Office 2, Suite 1 and Suite 2 — have been taken off. Nobody was in them.",
    ],
    link: { href: "/admin/settings", label: "Set the rates on Settings" },
  },
  {
    date: "2026-11-03",
    kind: "new",
    title: "Taking on the people who were already here",
    summary:
      "When you add somebody who was renting before you took the building over, the app now understands that — and won't bill them for the previous owner's years.",
    points: [
      "Tick \u201cthey were already renting here\u201d and you can put in when they actually moved in, even if that was years ago.",
      "You then say which month is the first one that's yours. Nothing before that is invoiced — they already paid it to somebody else.",
      "Every tenancy now shows how long they've been here, not just the date they started.",
    ],
    link: { href: "/admin/rentals/new", label: "Add somebody" },
  },
  {
    date: "2026-11-03",
    kind: "new",
    title: "Bills you owe, and the driving",
    summary:
      "An invoice you've been sent but haven't paid now has somewhere to live — and so does every trip you make for the building.",
    points: [
      "Put a bill in when it arrives and your forecast knows it's coming. Mark it paid and the cost records itself, using the bill's own figures.",
      "Set up the ones that come round again — insurance, the gas, the water — and add each one to your bills when it's due.",
      "Record trips to Lethbridge or Taber and claim them. It's a real deduction most people never take.",
    ],
    link: { href: "/admin/finance/costs", label: "Bills and mileage" },
    needsYou:
      "Before the driving adds up to anything, put in the cents-per-kilometre rate. The CRA sets it and changes it every year — there's a link on the page.",
  },
  {
    date: "2026-11-03",
    kind: "better",
    title: "The bank remembers how you file things",
    summary:
      "Tick \u201cremember this\u201d when you file an unexplained line, and anything like it gets filed the same way from then on.",
    points: [
      "No more categorising the same direct debit twelve times a year.",
      "You can see every rule, and remove any of them, at the bottom of the bank page.",
      "A rule only ever applies to money going the same way — a refund from the gas company never gets filed as another gas bill.",
    ],
    link: { href: "/admin/bank", label: "The bank" },
  },
  {
    date: "2026-11-03",
    kind: "new",
    title: "Taking some off a rent, and closing a year",
    summary:
      "You can now forgive part of an invoice with a reason attached, and freeze a year once it's been filed so its figures stop moving.",
    points: [
      "\u201cTake some off\u201d sits beside \u201cmark paid\u201d on any invoice. It reduces what they owe and keeps your reason with it.",
      "Closing a year means nothing dated before then can be added, edited or deleted — including by accident.",
      "You can reopen it if a genuine late correction turns up. The point is that it has to be deliberate.",
    ],
    link: { href: "/admin/settings", label: "Settings" },
  },
  {
    date: "2026-11-03",
    kind: "new",
    title: "Your accountant can look without you",
    summary:
      "You can give your accountant a sign-in that shows the figures and nothing else. They can't change anything, and they never see your tenants.",
    points: [
      "They see income, costs, GST and who you paid — and can download both year-end files themselves.",
      "No tenants, no counselling, no repairs, no messages.",
      "Turn it on or off for any person from Settings, any time.",
    ],
    link: { href: "/admin/settings", label: "Settings" },
  },
  {
    date: "2026-11-03",
    kind: "new",
    title: "Tick your books off against the bank",
    summary:
      "Download the statement from your bank, hand it to the app, and it matches each line against what you've already recorded. What doesn't match is the part worth knowing.",
    points: [
      "It reads whatever shape your bank exports — it works out which column is the date and which is the amount by itself.",
      "An amount has to match to the penny before it offers you a tick. Where nothing matches exactly it shows you what's close and by how much, which is usually a bank fee.",
      "Nothing is changed on your books until you say so, and anything you decide can be undone.",
      "A line that's nothing — a bank charge, money moved between your own accounts — can be set aside with a note saying why.",
      "At the end it lists anything on your books the statement never mentioned. A cheque that hasn't cleared is normal. A rent payment that never arrived is not.",
    ],
    link: { href: "/admin/bank", label: "The bank" },
  },
  {
    date: "2026-11-03",
    kind: "new",
    title: "Write down the state of a place, at both ends",
    summary:
      "A move-in and a move-out inspection for each tenancy, signed by the tenant from their own account — and the two shown side by side so you can see exactly what changed.",
    points: [
      "Alberta asks for both. Without the move-in one it's very hard to show later that damage wasn't already there.",
      "One tap per item on your phone while you're standing in the room, with a note or a photo wherever it isn't simply fine.",
      "Their view is recorded beside yours, never over it. Where you disagreed, the report says so — and that's worth more than a report that quietly kept whichever answer was typed last.",
      "The comparison hides everything that came back the same, so the three things that changed don't get lost among the twenty that didn't.",
    ],
    link: { href: "/admin/rentals", label: "Start one from Rentals" },
    needsYou:
      "Tyler needs to run one database update before this will work on the live site — it's the only thing today that isn't ready to go.",
  },
  {
    date: "2026-11-03",
    kind: "new",
    title: "Hand your accountant a year in two files",
    summary:
      "Pick a year and get a summary and a list of every transaction in it, both ready to email.",
    points: [
      "Income by where it came from, costs by category, GST both ways, and who you paid enough to need a T4A.",
      "The figures are on a cash basis — money that actually arrived and actually left. The page says so, because the other way of counting gives different numbers.",
      "Both files open in Excel, Numbers or Google Sheets.",
      "It leaves out depreciation and anything else needing a judgement call about what things are worth. That's your accountant's job, and a guess here would look like a tax figure without being one.",
    ],
    link: { href: "/admin/finance/year-end", label: "Year end" },
  },
  {
    date: "2026-11-03",
    kind: "new",
    title: "Write the rent-is-late email once",
    summary:
      "The four or five emails you write over and over, saved and ready. Pick one, pick a person, and the blanks fill themselves in.",
    points: [
      "Four are there to start with: rent overdue, lease renewal, a repair being done, and a welcome.",
      "You see exactly what they'll get before anything is sent, and it won't let you send one with a blank still in it.",
      "It keeps a record of what you sent and when — so you can tell whether you've already chased someone without going through your own inbox.",
      "Edit a saved message any time. What you've already sent stays exactly as it was sent.",
    ],
    link: { href: "/admin/messages", label: "Messages" },
  },
  {
    date: "2026-11-03",
    kind: "new",
    title: "See what's still undone for someone moving in",
    summary:
      "Nine things want doing when a tenancy starts. The Rentals page now shows which are done and names the next one.",
    points: [
      "It works this out from your own records rather than from boxes you tick, so it can't go out of date.",
      "Only tenancies with something outstanding appear, with the furthest behind at the top.",
      "The things the law cares about — the emergency contact, the key count, the deposit, the inspection — always come before the optional ones.",
    ],
    link: { href: "/admin/rentals", label: "Rentals" },
  },
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
    needsYou:
      "It's already on. Settings → 'Your morning note' if you'd rather it stopped.",
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
    summary: "Three smaller things on the money side.",
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
