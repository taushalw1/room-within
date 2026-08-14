/**
 * Site-wide facts. Everything here shows up in the header, footer, emails and
 * page metadata — change it once and it changes everywhere.
 */
export const site = {
  name: "Room Within Community",
  shortName: "Room Within",
  tagline: "A place to gather, learn, create, work & belong",
  town: "Grassy Lake, Alberta",
  email: "roomwithincommunity@gmail.com",
  facebook: "https://www.facebook.com/",
  facebookLabel: "Room Within Community",
  /** Shown on the counselling pages. */
  counsellor: {
    name: "Tausha",
    role: "Counsellor & Founder",
  },
} as const;

export const nav = [
  { href: "/spaces", label: "Our Spaces" },
  { href: "/book", label: "Book a Room" },
  { href: "/calendar", label: "Community Calendar" },
  { href: "/counselling", label: "Counselling" },
  { href: "/about", label: "About" },
  { href: "/support", label: "Support the Project" },
] as const;
