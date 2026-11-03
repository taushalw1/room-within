/**
 * Known-answer checks for which menu entry lights up.
 *
 * This is quiet when wrong in the most annoying way: the page is right, the
 * highlight is on something else, and you spend a moment every time
 * wondering whether you clicked the wrong thing. The two traps are `/admin`,
 * which is a prefix of literally every other page, and a section whose pages
 * are scattered — the bank is Money's, but it does not live under
 * `/admin/finance`.
 */
import {
  activeChild,
  isActive,
  sectionFor,
  sections,
} from "../src/lib/admin-nav";

let failures = 0;

function check(what: string, got: unknown, want: unknown) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) {
    console.log(`  ok    ${what}`);
  } else {
    console.log(`  FAIL  ${what}\n          got  ${a}\n          want ${b}`);
    failures += 1;
  }
}

const section = (path: string) => sectionFor(path)?.label ?? null;
const child = (path: string) => {
  const s = sectionFor(path);
  return s ? (activeChild(s, path)?.label ?? null) : null;
};

console.log("\nWhich section");

check("the dashboard", section("/admin"), "Dashboard");
check("tenancies", section("/admin/rentals"), "Renting");
check("moving somebody in", section("/admin/rentals/new"), "Renting");
check("deep inside renting", section("/admin/rentals/condition/abc-123"), "Renting");
check("repairs belong to renting", section("/admin/maintenance"), "Renting");
check("the building belongs to renting", section("/admin/building"), "Renting");

check("finance", section("/admin/finance"), "Money");
check("bills", section("/admin/finance/costs"), "Money");
check("year end", section("/admin/finance/year-end"), "Money");
// The one that a naive prefix match gets wrong: the bank is Money's, but it
// does not live under /admin/finance.
check("the bank belongs to money", section("/admin/bank"), "Money");
check("a statement", section("/admin/bank/abc-123"), "Money");

check("messages belong to people", section("/admin/messages"), "People");
check("counselling belongs to people", section("/admin/counselling"), "People");
check("a counselling record", section("/admin/counselling/abc"), "People");
check("grants belong to plans", section("/admin/grants"), "Plans");
check("what's new belongs to settings", section("/admin/whats-new"), "Settings");
check("record of changes", section("/admin/history"), "Settings");

check("somewhere unknown", section("/admin/nowhere"), null);

console.log("\nWhich page within the section");

check("overview, not year end", child("/admin/finance"), "Overview");
// Both "Overview" and "Year end" match this path. Only one is where you are.
check("year end, not overview", child("/admin/finance/year-end"), "Year end");
check("bills", child("/admin/finance/costs"), "Bills and mileage");
check("the bank", child("/admin/bank"), "The bank");
check("tenancies, not move in", child("/admin/rentals"), "Tenancies");
check("move in, not tenancies", child("/admin/rentals/new"), "Move somebody in");
// Deep inside a tenancy there is no exact child; the section's own landing
// page should not claim it, because you are not on it.
check("deep inside renting", child("/admin/rentals/condition/abc"), null);

console.log("\nThe dashboard is a prefix of everything");

const dashboard = sections[0];
check("lights on the dashboard", isActive(dashboard, "/admin"), true);
check("not on rentals", isActive(dashboard, "/admin/rentals"), false);
check("not on the bank", isActive(dashboard, "/admin/bank"), false);

console.log("\nThe menu itself");

check("eight sections", sections.length, 8);
check(
  "no duplicate section links",
  new Set(sections.map((s) => s.href)).size,
  sections.length,
);

{
  // Every page that used to be a top-level link must still be reachable, or
  // the tidy-up quietly lost a page.
  const everywhere = new Set(
    sections.flatMap((s) => [s.href, ...(s.children ?? []).map((c) => c.href)]),
  );

  const mustExist = [
    "/admin",
    "/admin/plan",
    "/admin/rentals",
    "/admin/maintenance",
    "/admin/building",
    "/admin/bookings",
    "/admin/classes",
    "/admin/instructors",
    "/admin/members",
    "/admin/events",
    "/admin/finance",
    "/admin/bank",
    "/admin/grants",
    "/admin/conferences",
    "/admin/counselling",
    "/admin/contacts",
    "/admin/messages",
    "/admin/history",
    "/admin/settings",
    "/admin/whats-new",
  ];

  for (const href of mustExist) {
    check(`${href} is still reachable`, everywhere.has(href), true);
  }
}

check(
  "exactly one entry carries the new-things dot",
  sections
    .flatMap((s) => (s.children ?? []).filter((c) => c.badge))
    .map((c) => c.label),
  ["What's new"],
);

if (failures > 0) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.\n`);
  process.exit(1);
}
console.log("\nAll menu checks passed.\n");
