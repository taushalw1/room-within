import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarDays,
  Flag,
  GraduationCap,
  Home,
  KeyRound,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

/**
 * The admin menu, in eight sections instead of twenty links.
 *
 * Twenty items is a menu you scroll sideways to read, which means the thing
 * you want is often off the edge of the screen — and a menu you have to hunt
 * through is one that makes the whole app feel bigger than it is.
 *
 * So related pages are grouped, and a section's own pages appear as a second
 * row once you are inside it. Nothing was removed; everything is one click
 * further in at most, and the things used daily are top-level.
 *
 * The order is roughly how often she needs them: the building and the money
 * first, the yearly things last.
 */

export type NavChild = {
  href: string;
  label: string;
  /** Match this path exactly rather than as a prefix. */
  exact?: boolean;
  /** Carries the "something new" dot. */
  badge?: boolean;
};

export type NavSection = NavChild & {
  icon: LucideIcon;
  /** The pages inside it. The first is usually the section's own landing page. */
  children?: NavChild[];
};

export const sections: NavSection[] = [
  { href: "/admin", label: "Dashboard", icon: Home, exact: true },

  {
    href: "/admin/rentals",
    label: "Renting",
    icon: KeyRound,
    children: [
      { href: "/admin/rentals", label: "Tenancies", exact: true },
      { href: "/admin/rentals/new", label: "Move somebody in" },
      { href: "/admin/maintenance", label: "Repairs" },
      { href: "/admin/building", label: "The building" },
    ],
  },

  {
    href: "/admin/finance",
    label: "Money",
    icon: Wallet,
    children: [
      { href: "/admin/finance", label: "Overview", exact: true },
      { href: "/admin/finance/costs", label: "Bills and mileage" },
      { href: "/admin/bank", label: "The bank" },
      { href: "/admin/finance/year-end", label: "Year end" },
    ],
  },

  {
    href: "/admin/bookings",
    label: "Bookings",
    icon: CalendarDays,
    children: [
      { href: "/admin/bookings", label: "Room bookings" },
      { href: "/admin/events", label: "Events" },
    ],
  },

  {
    href: "/admin/classes",
    label: "Classes",
    icon: GraduationCap,
    children: [
      { href: "/admin/classes", label: "Classes" },
      { href: "/admin/instructors", label: "Instructors" },
      { href: "/admin/members", label: "Members" },
    ],
  },

  {
    href: "/admin/contacts",
    label: "People",
    icon: Users,
    children: [
      { href: "/admin/contacts", label: "Everyone" },
      { href: "/admin/messages", label: "Messages" },
      { href: "/admin/counselling", label: "Counselling" },
    ],
  },

  {
    href: "/admin/plan",
    label: "Plans",
    icon: Flag,
    children: [
      { href: "/admin/plan", label: "The plan" },
      { href: "/admin/grants", label: "Grants" },
      { href: "/admin/conferences", label: "Conferences" },
    ],
  },

  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    badge: true,
    children: [
      { href: "/admin/settings", label: "Settings", exact: true },
      { href: "/admin/whats-new", label: "What's new", badge: true },
      { href: "/admin/history", label: "Record of changes" },
    ],
  },
];

/** Not in the menu itself, but reachable from the bottom of it. */
export const asides: NavChild[] = [
  { href: "/portal", label: "Your picture and signature" },
  { href: "/", label: "View public site" },
];

/**
 * Does this path belong to this entry?
 *
 * `exact` exists for `/admin` and for a section landing page that has deeper
 * pages under it. Without it `/admin` matches everything, and "Overview"
 * stays lit while you are three pages into Year end.
 */
function matches(entry: NavChild, pathname: string): boolean {
  if (entry.exact) return pathname === entry.href;
  return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
}

/**
 * Which section the current page lives in.
 *
 * Longest match wins, across section hrefs and their children alike. That is
 * what puts `/admin/bank` in Money even though it does not sit under
 * `/admin/finance` — the child's href is what claims it, and a section whose
 * pages are scattered across the URL space still lights up correctly.
 */
export function sectionFor(pathname: string): NavSection | null {
  let best: NavSection | null = null;
  let bestLength = -1;

  for (const section of sections) {
    const candidates: NavChild[] = [section, ...(section.children ?? [])];

    for (const entry of candidates) {
      if (!matches(entry, pathname)) continue;
      if (entry.href.length > bestLength) {
        bestLength = entry.href.length;
        best = section;
      }
    }
  }

  return best;
}

/** Whether a menu entry should look like the page you are on. */
export function isActive(entry: NavChild, pathname: string): boolean {
  return matches(entry, pathname);
}

/**
 * The child to light up within a section.
 *
 * Longest match again, so `/admin/finance/year-end` lights "Year end" rather
 * than "Overview" — both match, and only one of them is where you are.
 */
export function activeChild(
  section: NavSection,
  pathname: string,
): NavChild | null {
  let best: NavChild | null = null;
  let bestLength = -1;

  for (const child of section.children ?? []) {
    if (!matches(child, pathname)) continue;
    if (child.href.length > bestLength) {
      bestLength = child.href.length;
      best = child;
    }
  }

  return best;
}
