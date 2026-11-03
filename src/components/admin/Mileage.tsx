"use client";

import { useActionState, useState, useTransition } from "react";
import { Car, ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  deleteTrip,
  saveMileageRate,
  saveTrip,
  type ActionResult,
} from "@/app/(admin)/admin/finance/costs/actions";
import { Button } from "@/components/ui/Button";
import { Feedback, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { dateShort, moneyExact } from "@/lib/format";
import type { TripRow } from "@/lib/data/types";

/**
 * Driving to Lethbridge for supplies is a deduction, and one almost nobody
 * claims because the record is a notebook in the glovebox.
 *
 * The rate is asked for rather than assumed. The CRA publishes a new one every
 * year, and a number this page made up would go straight into a tax figure
 * looking exactly as official as a correct one. So until she sets it, the
 * page says so and refuses to total anything.
 */
export function Mileage({
  trips,
  rateCentsPerKm,
  today,
}: {
  trips: TripRow[];
  rateCentsPerKm: number | null;
  today: string;
}) {
  const [tripResult, tripAction] = useActionState<ActionResult | null, FormData>(
    saveTrip,
    null,
  );
  const [rateResult, rateAction] = useActionState<ActionResult | null, FormData>(
    saveMileageRate,
    null,
  );
  const [adding, setAdding] = useState(false);
  const [editingRate, setEditingRate] = useState(false);

  const year = today.slice(0, 4);
  const thisYear = trips.filter((t) => t.travelled_on.startsWith(year));
  const totalKm = thisYear.reduce((sum, t) => sum + Number(t.kilometres), 0);
  const totalCents = thisYear.reduce((sum, t) => sum + t.amount_cents, 0);

  if (rateCentsPerKm === null || editingRate) {
    return (
      <div className="px-5 py-5">
        <form action={rateAction} className="space-y-3">
          <Field
            label="Cents per kilometre"
            hint="The CRA sets this and changes it every year. Look up the current one and put it here — it only takes a moment, once a year."
          >
            <input
              name="cents"
              type="number"
              step="1"
              min="1"
              max="500"
              required
              defaultValue={rateCentsPerKm ?? undefined}
              placeholder="e.g. 70"
              className={inputClass}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton>Save the rate</SubmitButton>
            {rateCentsPerKm !== null && (
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditingRate(false)}>
                Cancel
              </Button>
            )}
            <a
              href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/benefits-allowances/automobile/automobile-motor-vehicle-allowances/automobile-allowance-rates.html"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-bark underline underline-offset-2"
            >
              The CRA&rsquo;s rates
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
            <Feedback result={rateResult} />
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-tan/20 px-5 py-4">
        <p className="text-sm text-ink-soft">
          {totalKm.toLocaleString()} km in {year} at {rateCentsPerKm}¢ —{" "}
          <strong className="text-ink">{moneyExact(totalCents)}</strong>
        </p>
        <button
          type="button"
          onClick={() => setEditingRate(true)}
          className="text-xs text-bark underline underline-offset-2"
        >
          Change the rate
        </button>
      </div>

      {thisYear.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-soft">
          No trips recorded this year.
        </p>
      ) : (
        thisYear.map((trip) => <TripRowView key={trip.id} trip={trip} />)
      )}

      <div className="px-5 py-4">
        {!adding ? (
          <Button size="sm" variant="ghost" type="button" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Record a trip
          </Button>
        ) : (
          <form action={tripAction} className="space-y-4">
            <input type="hidden" name="rate" value={rateCentsPerKm} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="When">
                <input
                  name="travelledOn"
                  type="date"
                  required
                  defaultValue={today}
                  className={inputClass}
                />
              </Field>
              <Field label="How far, in kilometres" hint="There and back.">
                <input
                  name="kilometres"
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="What for" hint="Specific enough to stand up: 'paint for the stairwell', not 'errands'.">
              <input name="purpose" required className={inputClass} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From">
                <input name="fromPlace" defaultValue="Grassy Lake" className={inputClass} />
              </Field>
              <Field label="To">
                <input name="toPlace" className={inputClass} />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton>
                <Car className="h-4 w-4" aria-hidden />
                Save the trip
              </SubmitButton>
              <Button size="sm" variant="ghost" type="button" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Feedback result={tripResult} />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function TripRowView({ trip }: { trip: TripRow }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-tan/20 px-5 py-3">
      <div className="min-w-0">
        <p className="text-sm text-ink">{trip.purpose}</p>
        <p className="text-xs text-ink-faint">
          {dateShort(trip.travelled_on)}
          {trip.from_place || trip.to_place
            ? ` · ${trip.from_place ?? "?"} to ${trip.to_place ?? "?"}`
            : ""}{" "}
          · {Number(trip.kilometres).toLocaleString()} km at {trip.rate_cents_per_km}¢
        </p>
        {result && (
          <p
            role="status"
            className={`text-xs ${result.ok ? "text-olive" : "text-burgundy"}`}
          >
            {result.message}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-display font-semibold text-ink">
          {moneyExact(trip.amount_cents)}
        </span>
        <button
          type="button"
          disabled={pending}
          aria-label="Remove this trip"
          onClick={() => {
            const fd = new FormData();
            fd.set("id", trip.id);
            start(async () => setResult(await deleteTrip(fd)));
          }}
          className="text-ink-faint hover:text-burgundy"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
