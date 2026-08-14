"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { format, addDays } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { requestBooking, type BookingResult } from "@/app/(site)/book/actions";
import { quoteBooking } from "@/lib/pricing";
import { money, moneyExact } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { RoomRow } from "@/lib/data/types";

const field =
  "w-full rounded-[var(--radius-card)] border border-tan/40 bg-cream px-3.5 py-2.5 text-[0.95rem] placeholder:text-ink-faint";
const labelText = "eyebrow !text-[0.6rem] text-bark";

const DURATIONS = [1, 1.5, 2, 3, 4, 6, 8];

export function BookingForm({
  rooms,
  initialRoomSlug,
}: {
  rooms: RoomRow[];
  initialRoomSlug?: string;
}) {
  const [result, action, pending] = useActionState<BookingResult | null, FormData>(
    requestBooking,
    null,
  );

  const [roomSlug, setRoomSlug] = useState(
    initialRoomSlug ?? rooms[0]?.slug ?? "",
  );
  const [hours, setHours] = useState(2);

  const room = rooms.find((r) => r.slug === roomSlug) ?? rooms[0];

  // Stripe Checkout lives on Stripe's own domain, so we leave the site.
  useEffect(() => {
    if (result?.status === "redirect") window.location.href = result.url;
  }, [result]);

  const quote = useMemo(() => {
    if (!room) return null;
    const start = new Date();
    return quoteBooking(room, start, new Date(start.getTime() + hours * 3_600_000));
  }, [room, hours]);

  useEffect(() => {
    if (room && hours < room.min_hours) setHours(room.min_hours);
  }, [room, hours]);

  if (!room) return null;

  if (result?.status === "requested") {
    return (
      <div className="rounded-[var(--radius-card)] border border-olive/30 bg-sage-pale/40 p-8 text-center">
        <h3 className="text-2xl">Thank you</h3>
        <p className="mt-3 text-ink-soft">{result.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="roomSlug" value={roomSlug} />
      <input type="hidden" name="hours" value={hours} />

      {/* Room */}
      <fieldset>
        <legend className={labelText}>Which room</legend>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          {rooms.map((r) => (
            <label
              key={r.id}
              className={cn(
                "cursor-pointer rounded-[var(--radius-card)] border p-4 transition-colors",
                r.slug === roomSlug
                  ? "border-olive bg-sage-pale/50"
                  : "border-tan/30 hover:border-olive/40",
              )}
            >
              <input
                type="radio"
                name="roomChoice"
                value={r.slug}
                checked={r.slug === roomSlug}
                onChange={() => setRoomSlug(r.slug)}
                className="sr-only"
              />
              <span className="block font-display text-lg font-semibold text-olive-deep">
                {r.name}
              </span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                {r.capacity ? `Seats ${r.capacity} · ` : ""}
                {money(r.hourly_rate_cents)}/hour
              </span>
              {r.requires_approval && (
                <span className="mt-2 block text-[0.7rem] text-bark">
                  Tausha confirms this one before you pay
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      {/* When */}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={labelText}>Date</span>
          <input
            type="date"
            name="date"
            required
            min={format(new Date(), "yyyy-MM-dd")}
            defaultValue={format(addDays(new Date(), 3), "yyyy-MM-dd")}
            className={cn(field, "mt-1.5")}
          />
        </label>

        <label className="block">
          <span className={labelText}>Starting at</span>
          <input
            type="time"
            name="startTime"
            required
            step={900}
            defaultValue="09:00"
            className={cn(field, "mt-1.5")}
          />
        </label>

        <label className="block">
          <span className={labelText}>For how long</span>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className={cn(field, "mt-1.5")}
          >
            {DURATIONS.filter((h) => h >= room.min_hours).map((h) => (
              <option key={h} value={h}>
                {h} {h === 1 ? "hour" : "hours"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Price */}
      {quote && (
        <div className="rounded-[var(--radius-card)] bg-parchment px-5 py-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink-soft">
              {room.name} · {hours} {hours === 1 ? "hour" : "hours"}
              <span className="text-ink-faint"> ({quote.basis} rate)</span>
            </span>
            <span className="tabular-nums">{moneyExact(quote.subtotalCents)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-sm text-ink-soft">
            <span>GST</span>
            <span className="tabular-nums">{moneyExact(quote.taxCents)}</span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between border-t border-tan/30 pt-2.5">
            <span className="eyebrow text-bark">Total</span>
            <span className="font-display text-2xl font-semibold tabular-nums text-olive-deep">
              {moneyExact(quote.totalCents)}
            </span>
          </div>
        </div>
      )}

      {/* Who */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelText}>Your name</span>
          <input name="name" required className={cn(field, "mt-1.5")} />
        </label>
        <label className="block">
          <span className={labelText}>Email</span>
          <input
            name="email"
            type="email"
            required
            className={cn(field, "mt-1.5")}
          />
        </label>
        <label className="block">
          <span className={labelText}>Phone (optional)</span>
          <input name="phone" type="tel" className={cn(field, "mt-1.5")} />
        </label>
        <label className="block">
          <span className={labelText}>Roughly how many people</span>
          <input
            name="attendees"
            type="number"
            min={1}
            max={room.capacity ?? 500}
            className={cn(field, "mt-1.5")}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelText}>What to call this booking</span>
        <input
          name="title"
          required
          placeholder="Sewing circle, family gathering, team meeting…"
          className={cn(field, "mt-1.5")}
        />
      </label>

      <label className="block">
        <span className={labelText}>Anything Tausha should know (optional)</span>
        <textarea
          name="purpose"
          rows={3}
          placeholder="Setup needs, access, tables and chairs…"
          className={cn(field, "mt-1.5 resize-y")}
        />
      </label>

      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="showOnCalendar"
          className="mt-1 h-4 w-4 accent-[var(--color-olive)]"
        />
        <span>
          Show this on the public community calendar, so others can come along.
          Leave unticked for a private booking.
        </span>
      </label>

      {result?.status === "error" && (
        <p role="alert" className="text-sm text-burgundy">
          {result.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {room.requires_approval ? "Send request" : "Book and pay"}
      </Button>

      <p className="text-xs text-ink-faint">
        {room.requires_approval
          ? "Nothing is charged now. Tausha confirms first, then sends a payment link."
          : "You'll be taken to a secure payment page. Card details are handled by Stripe and never touch this website."}
      </p>
    </form>
  );
}
