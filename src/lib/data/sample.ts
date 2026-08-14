import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import type { EventRow, RoomRow } from "./types";

/**
 * Stand-in content used only when Supabase isn't connected yet, so the site
 * looks and behaves like the finished thing on a fresh clone. Once the real
 * database is wired up these are never read.
 */

const at = (daysFromNow: number, hour: number, minute = 0) =>
  setMinutes(setHours(startOfDay(addDays(new Date(), daysFromNow)), hour), minute).toISOString();

export const sampleRooms: RoomRow[] = [
  {
    id: "sample-gathering",
    name: "The Gathering Room",
    slug: "gathering-room",
    description:
      "Our largest space, at the front of the building. Suits classes, coffee groups, workshops, meetings and small celebrations. Tables and stacking chairs included, kitchenette next door.",
    capacity: 40,
    hourly_rate_cents: 3500,
    half_day_rate_cents: 12000,
    full_day_rate_cents: 20000,
    min_hours: 2,
    buffer_minutes: 30,
    is_bookable: true,
    requires_approval: true,
    image_url: null,
    sort_order: 1,
  },
  {
    id: "sample-maker",
    name: "The Maker Space",
    slug: "maker-space",
    description:
      "Sewing machines, work tables and craft storage. Ideal for skill-sharing evenings, sewing circles, painting classes and children's craft sessions.",
    capacity: 16,
    hourly_rate_cents: 2500,
    half_day_rate_cents: 9000,
    full_day_rate_cents: 15000,
    min_hours: 2,
    buffer_minutes: 30,
    is_bookable: true,
    requires_approval: true,
    image_url: null,
    sort_order: 2,
  },
  {
    id: "sample-quiet",
    name: "The Quiet Room",
    slug: "quiet-room",
    description:
      "A small, softly furnished room for one-to-one meetings, mentoring, tutoring and counselling. Private and sound-buffered.",
    capacity: 4,
    hourly_rate_cents: 2000,
    half_day_rate_cents: 7000,
    full_day_rate_cents: 11000,
    min_hours: 1,
    buffer_minutes: 15,
    is_bookable: true,
    requires_approval: false,
    image_url: null,
    sort_order: 3,
  },
  {
    id: "sample-studio",
    name: "The Studio Office",
    slug: "studio-office",
    description:
      "A bright upstairs office available by the day for remote workers and visiting practitioners. Desk, wifi and shared kitchen access.",
    capacity: 2,
    hourly_rate_cents: 1500,
    half_day_rate_cents: 5000,
    full_day_rate_cents: 8000,
    min_hours: 1,
    buffer_minutes: 0,
    is_bookable: true,
    requires_approval: false,
    image_url: null,
    sort_order: 4,
  },
];

export const sampleEvents: EventRow[] = [
  {
    id: "sample-e1",
    title: "Thursday Morning Coffee Group",
    slug: "thursday-coffee",
    description:
      "Drop in for a cup and a chat. No sign-up, no cost — just come. Little ones welcome.",
    starts_at: at(3, 9, 30),
    ends_at: at(3, 11, 0),
    all_day: false,
    location: "The Gathering Room",
    is_at_building: true,
    room_id: "sample-gathering",
    host_name: "Room Within",
    category: "community",
    image_url: null,
    external_url: null,
    status: "published",
  },
  {
    id: "sample-e2",
    title: "Homeschool Co-op — Science Morning",
    slug: "homeschool-science",
    description:
      "Families gather for a hands-on science morning. Bring a snack to share. Suitable for ages 5–13.",
    starts_at: at(6, 9, 0),
    ends_at: at(6, 12, 0),
    all_day: false,
    location: "The Gathering Room",
    is_at_building: true,
    room_id: "sample-gathering",
    host_name: "Grassy Lake Homeschool Co-op",
    category: "learning",
    image_url: null,
    external_url: null,
    status: "published",
  },
  {
    id: "sample-e3",
    title: "Beginner Sewing Circle",
    slug: "sewing-circle",
    description:
      "Four-week series. Machines provided, all skill levels welcome. Materials fee applies.",
    starts_at: at(9, 18, 30),
    ends_at: at(9, 20, 30),
    all_day: false,
    location: "The Maker Space",
    is_at_building: true,
    room_id: "sample-maker",
    host_name: "Room Within",
    category: "workshop",
    image_url: null,
    external_url: null,
    status: "published",
  },
  {
    id: "sample-e4",
    title: "Grassy Lake Community Market",
    slug: "community-market",
    description:
      "The seasonal market on Main Street. Local growers, bakers and makers. Room Within will have a table.",
    starts_at: at(13, 10, 0),
    ends_at: at(13, 14, 0),
    all_day: false,
    location: "Main Street, Grassy Lake",
    is_at_building: false,
    room_id: null,
    host_name: "Grassy Lake Community Association",
    category: "community",
    image_url: null,
    external_url: null,
    status: "published",
  },
  {
    id: "sample-e5",
    title: "Parents' Evening — Raising Kids in a Small Town",
    slug: "parents-evening",
    description:
      "An informal conversation evening hosted by Tausha. Coffee and dessert provided.",
    starts_at: at(20, 19, 0),
    ends_at: at(20, 21, 0),
    all_day: false,
    location: "The Gathering Room",
    is_at_building: true,
    room_id: "sample-gathering",
    host_name: "Tausha",
    category: "wellbeing",
    image_url: null,
    external_url: null,
    status: "published",
  },
];
