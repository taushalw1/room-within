/**
 * Tausha's bio and the About page copy.
 *
 * This is placeholder text written from the project poster — Tausha should
 * replace it with her own words. Ask Claude: "update my about page bio", read
 * it out, and it will rewrite this file.
 *
 * PHOTO: replace `public/tausha.jpg` with a new file to change it. If the new
 * photo frames her differently, adjust `photoPosition` below — the pages crop
 * a tall portrait out of a wide photo, so that setting decides which part
 * survives the crop.
 */
export const about = {
  name: "Tausha",
  role: "Counsellor & Founder",
  photo: "/tausha.jpg" as string | null,
  photoAlt: "Tausha, counsellor and founder of Room Within Community",
  /** CSS object-position: keeps her face in frame when the photo is cropped. */
  photoPosition: "57% 38%",

  /** One line under her name. */
  tagline: "Building a place where families don't have to choose.",

  /** The main bio — a few short paragraphs reads better than one long one. */
  bio: [
    "I'm Tausha. I live in Grassy Lake with my family, and Room Within grew out of a question I couldn't put down: why should being present for your children and contributing your gifts to your community ever be an either/or?",
    "For years I watched neighbours drive an hour each way for an office, a workshop, a counselling appointment, or reliable childcare — and watched good ideas quietly fade because there was nowhere local to put them. This building has stood on Main Street since 1905. It has room for all of it.",
    "Alongside the building work, I offer counselling from a private, comfortable room here. My approach is unhurried and practical. You don't need a diagnosis or a crisis to book a session — sometimes you just need an hour, a quiet room, and someone whose job it is to listen properly.",
  ],

  /** Shown as small-caps chips. Keep each one short. */
  specialties: [
    "Individual counselling",
    "Anxiety & overwhelm",
    "Parenting & family transitions",
    "Grief & loss",
    "Burnout and rebuilding",
    "Rural isolation",
    "Faith & meaning",
    "Women's wellbeing",
  ],

  /**
   * Credentials. IMPORTANT: only list registrations that are current — put the
   * real ones here and delete any that don't apply.
   */
  credentials: [
    "Add your qualifications here",
    "Add your professional registration here",
  ],

  /** Pulled out as a large script quote on the page. */
  pullQuote:
    "By reaching out to our community, we hope to build community. One conversation. One relationship. One shared project at a time.",
} as const;
