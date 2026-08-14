import {
  BedDouble,
  BookOpen,
  Briefcase,
  HeartHandshake,
  Scissors,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Offering = {
  slug: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  /** Where "Learn more" points, if this offering has its own page yet. */
  href?: string;
  /** Shown as a small tag when the offering isn't open to the public yet. */
  status?: "Year One" | "Year Two" | "Year Three";
};

/**
 * The six offerings from the poster. This is stable brand copy, so it lives in
 * the code rather than the database — ask Claude to change the wording here.
 */
export const offerings: Offering[] = [
  {
    slug: "childcare",
    title: "Prairie Pals Childcare",
    blurb:
      "A trusted day home supporting families and creating opportunities for parents to remain active in work and community life.",
    icon: HeartHandshake,
    status: "Year Three",
  },
  {
    slug: "offices",
    title: "Professional Offices",
    blurb:
      "Affordable spaces for entrepreneurs, educators, practitioners, remote workers, and small businesses to serve our community close to home.",
    icon: Briefcase,
    href: "/spaces#offices",
    status: "Year One",
  },
  {
    slug: "maker-space",
    title: "Community Maker Space",
    blurb:
      "Sewing, painting, crafting, workshops, skill-sharing, and creativity for all ages and skill levels.",
    icon: Scissors,
    href: "/spaces#maker-space",
    status: "Year Two",
  },
  {
    slug: "homeschool",
    title: "Homeschool Co-op",
    blurb:
      "A place for families to gather, learn, collaborate, share resources, and build friendships.",
    icon: BookOpen,
    href: "/calendar",
    status: "Year Two",
  },
  {
    slug: "gathering",
    title: "Community Gathering Space",
    blurb:
      "Classes, drop-in groups, workshops, mentorship, meetings, and events that strengthen connection and belonging.",
    icon: Users,
    href: "/spaces#rooms",
    status: "Year One",
  },
  {
    slug: "suites",
    title: "Residential Suites",
    blurb:
      "Supporting visiting professionals, educators, and community partnerships.",
    icon: BedDouble,
    href: "/spaces#suites",
  },
];

/** The three-year development plan, straight off the poster. */
export const developmentPlan = [
  {
    year: "Year One",
    items: [
      "Acquire and stabilize the building",
      "Complete priority repairs and safety upgrades",
      "Launch initial office spaces and community gathering areas",
    ],
  },
  {
    year: "Year Two",
    items: [
      "Expand programming and partnerships",
      "Develop the maker space",
      "Increase office occupancy",
      "Support homeschool co-op opportunities",
    ],
  },
  {
    year: "Year Three",
    items: [
      "Launch Prairie Pals childcare services",
      "Complete remaining renovations",
      "Create a sustainable community hub serving Grassy Lake and surrounding communities",
    ],
  },
] as const;
