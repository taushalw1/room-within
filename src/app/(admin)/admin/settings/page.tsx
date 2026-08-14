import { AddPanel } from "@/components/admin/AddPanel";
import { RatesForm } from "@/components/admin/RatesForm";
import { RoomForm } from "@/components/admin/RoomForm";
import { RoomRateRow } from "@/components/admin/RoomRateRow";
import { UnitForm } from "@/components/admin/UnitForm";
import { UnitRateRow } from "@/components/admin/UnitRateRow";
import { Card, CardHeader, Table, Td, Th } from "@/components/ui/Table";
import { getRooms } from "@/lib/data/public";
import { getRates, getUnits } from "@/lib/data/admin";
import { money } from "@/lib/format";
import { site } from "@/lib/site";

export default async function SettingsPage() {
  const [rooms, units, rates] = await Promise.all([
    getRooms(),
    getUnits(),
    getRates(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Settings</h1>
        <p className="mt-1.5 text-ink-soft">
          Your rates and the basics. To change any of these, just ask Claude —
          for example, &ldquo;change the counselling rate to $150 an hour&rdquo;.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Room rates"
          description="Changing a rate here updates the website and every new booking straight away. Bookings already made keep the price they were quoted."
        />
        <Table>
          <thead>
            <tr>
              <Th>Room</Th>
              <Th align="right">Hourly</Th>
              <Th align="right">Half day</Th>
              <Th align="right">Full day</Th>
              <Th align="right">Minimum</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <RoomRateRow key={r.id} room={r} />
            ))}
          </tbody>
        </Table>
      </Card>

      <AddPanel
        label="Add a room"
        description="A space people book by the hour or the day."
      >
        <RoomForm />
      </AddPanel>

      <Card>
        <CardHeader
          title="Monthly rents"
          description="Offices and suites let by the month. This is the asking rent — each tenancy can be agreed at its own figure."
        />
        <Table>
          <thead>
            <tr>
              <Th>Unit</Th>
              <Th>Type</Th>
              <Th align="right">Monthly</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <UnitRateRow key={u.id} unit={u} />
            ))}
          </tbody>
        </Table>
      </Card>

      <AddPanel
        label="Add a unit"
        description="A part of the building let on a monthly lease, rather than booked by the hour."
      >
        <UnitForm />
      </AddPanel>

      <Card>
        <CardHeader
          title="Counselling &amp; tax"
          description="The hourly rate shown on the counselling page, and the GST added to room bookings."
        />
        <div className="px-5 py-5">
          <RatesForm rates={rates} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Contact details" description="Shown across the website and on emails." />
        <div className="px-5 py-5">
          <dl className="space-y-3 text-sm">
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-ink-faint">Business</dt>
              <dd>{site.name}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-ink-faint">Town</dt>
              <dd>{site.town}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-ink-faint">Email</dt>
              <dd>{site.email}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card className="bg-parchment/70">
        <div className="px-5 py-5 text-sm text-ink-soft">
          <h2 className="font-display text-base font-semibold text-olive-deep">
            Things to ask Tyler for
          </h2>
          <p className="mt-2">
            You can add tenants, events and costs yourself — look for the
            &ldquo;Add&rdquo; button on Rentals, Events and Finance. These are
            the ones that need Tyler:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Connecting or changing the Stripe account that takes card payments</li>
            <li>Adding or changing passwords and keys</li>
            <li>Giving someone else admin access</li>
            <li>Anything to do with the domain name or hosting</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
