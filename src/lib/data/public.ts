import { getServerSupabase } from "@/lib/supabase/server";
import { sampleEvents, sampleRooms } from "./sample";
import type { EventRow, RoomRow } from "./types";

/**
 * Read helpers for the public side of the site.
 *
 * Each one falls back to sample content when Supabase isn't connected, or when
 * the connected database is still empty — so the site never shows a broken or
 * blank page while it's being set up.
 */

export async function getRooms(): Promise<RoomRow[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return sampleRooms;

  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("is_bookable", true)
    .order("sort_order");

  if (error || !data?.length) return sampleRooms;
  return data as RoomRow[];
}

export async function getRoomBySlug(slug: string): Promise<RoomRow | null> {
  const rooms = await getRooms();
  return rooms.find((r) => r.slug === slug) ?? null;
}

export async function getUpcomingEvents(limit = 20): Promise<EventRow[]> {
  const supabase = await getServerSupabase();
  const nowIso = new Date().toISOString();

  if (!supabase) {
    return sampleEvents
      .filter((e) => e.ends_at >= nowIso)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, limit);
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .gte("ends_at", nowIso)
    .order("starts_at")
    .limit(limit);

  if (error) return [];
  if (!data?.length) {
    // Connected but empty — show samples so the calendar isn't a blank page.
    return sampleEvents.filter((e) => e.ends_at >= nowIso).slice(0, limit);
  }
  return data as EventRow[];
}

export async function getEventsInRange(
  from: Date,
  to: Date,
): Promise<EventRow[]> {
  const supabase = await getServerSupabase();

  if (!supabase) {
    return sampleEvents.filter(
      (e) =>
        new Date(e.starts_at) < to && new Date(e.ends_at) > from,
    );
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString())
    .order("starts_at");

  if (error) return [];
  if (!data?.length) {
    return sampleEvents.filter(
      (e) => new Date(e.starts_at) < to && new Date(e.ends_at) > from,
    );
  }
  return data as EventRow[];
}

/**
 * When is this room already taken? Returns times only — never who booked it
 * or what for. Backed by a SECURITY DEFINER function so the public can see
 * availability without being able to read the bookings table.
 */
export async function getRoomBusyTimes(
  roomId: string,
  from: Date,
  to: Date,
): Promise<{ starts_at: string; ends_at: string }[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("room_busy_times", {
    p_room_id: roomId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error || !data) return [];
  return data as { starts_at: string; ends_at: string }[];
}
