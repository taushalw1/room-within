/**
 * Site-wide facts. Everything here shows up in the header, footer, emails and
 * page metadata — change it once and it changes everywhere.
 */
export const site = {
  name: "Room Within Community",
  shortName: "Room Within",
  tagline: "A place to gather, learn, create, work & belong",
  /** The line that sits under the logo in the horizontal lockup. */
  logoTagline: "A place to heal. A space to belong.",
  town: "Grassy Lake, Alberta",
  /** The building itself. */
  address: {
    street: "105 Chamberlain Ave N",
    locality: "Grassy Lake",
    region: "AB",
    postalCode: "T0K 0Z0",
    /** One line, for the footer and emails. */
    oneLine: "105 Chamberlain Ave N, Grassy Lake, AB T0K 0Z0",
    /** Opens the address in whichever map app the visitor uses. */
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent("105 Chamberlain Ave N, Grassy Lake, AB T0K 0Z0"),
  },
  email: "roomwithincommunity@gmail.com",
  facebook: "https://www.facebook.com/",
  facebookLabel: "Room Within Community",
  /** Shown on the counselling pages. */
  counsellor: {
    name: "Tausha",
    role: "Counsellor & Founder",
  },
} as const;

/**
 * The top navigation.
 *
 * "Book a Room" deliberately isn't here — Our Spaces covers the same ground and
 * carries a "Check availability" button for each room, so a separate nav item
 * was sending people to the same place twice. The booking page still exists at
 * /book; it's just reached from Our Spaces and the home page instead.
 */
export const nav = [
  { href: "/spaces", label: "Our Spaces" },
  { href: "/calendar", label: "Community Calendar" },
  { href: "/counselling", label: "Counselling" },
  { href: "/about", label: "About" },
  { href: "/support", label: "Support the Project" },
] as const;
