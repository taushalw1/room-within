import { CalendarDays, Eye, PencilLine } from "lucide-react";
import { AddEventForm } from "@/components/admin/AddEventForm";
import { AddPanel } from "@/components/admin/AddPanel";
import { EventStatusButtons } from "@/components/admin/EventStatusButtons";
import { Stat } from "@/components/admin/Stat";
import {
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Td,
  Th,
} from "@/components/ui/Table";
import { ButtonLink } from "@/components/ui/Button";
import { getAdminEvents } from "@/lib/data/admin";
import { getRooms } from "@/lib/data/public";
import { dateTimeRange } from "@/lib/format";

export default async function EventsPage() {
  const [events, rooms] = await Promise.all([getAdminEvents(), getRooms()]);

  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.ends_at) >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = events.filter((e) => new Date(e.ends_at) < now);

  const published = upcoming.filter((e) => e.status === "published");
  const drafts = events.filter((e) => e.status === "draft");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Events</h1>
          <p className="mt-1.5 text-ink-soft">
            What goes on the community calendar — here at Room Within or
            anywhere else in Grassy Lake.
          </p>
        </div>
        <ButtonLink href="/calendar" variant="secondary" size="sm">
          <Eye className="h-4 w-4" aria-hidden />
          View public calendar
        </ButtonLink>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="On the calendar"
          value={String(published.length)}
          sub="Published and still to come"
          icon={CalendarDays}
        />
        <Stat
          label="Drafts"
          value={String(drafts.length)}
          sub="Saved but not published"
          icon={PencilLine}
        />
        <Stat
          label="Coming up"
          value={String(upcoming.length)}
          sub="Including drafts"
        />
      </div>

      <AddPanel
        label="Add an event"
        description="It doesn't have to be at Room Within — anything the community should know about."
      >
        <AddEventForm rooms={rooms} />
      </AddPanel>

      <Card>
        <CardHeader
          title="Coming up"
          description="Drafts are only visible to you until you publish them."
        />
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>What</Th>
              <Th>Where</Th>
              <Th align="right">Status</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {upcoming.length === 0 ? (
              <EmptyRow colSpan={5}>
                Nothing coming up. Add the first event above.
              </EmptyRow>
            ) : (
              upcoming.map((e) => (
                <tr key={e.id}>
                  <Td>{dateTimeRange(e.starts_at, e.ends_at)}</Td>
                  <Td>
                    <span className="font-medium">{e.title}</span>
                    {e.host_name && (
                      <span className="block text-xs text-ink-faint">
                        {e.host_name}
                      </span>
                    )}
                  </Td>
                  <Td className="text-ink-soft">
                    {e.location ?? "—"}
                    {!e.is_at_building && (
                      <span className="block text-xs text-ink-faint">
                        elsewhere in the community
                      </span>
                    )}
                  </Td>
                  <Td align="right">
                    <Badge
                      tone={
                        e.status === "published"
                          ? "good"
                          : e.status === "cancelled"
                            ? "bad"
                            : "warn"
                      }
                    >
                      {e.status}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <EventStatusButtons eventId={e.id} status={e.status} />
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {past.length > 0 && (
        <Card>
          <CardHeader title="Already happened" />
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>What</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {past.slice(0, 12).map((e) => (
                <tr key={e.id} className="opacity-70">
                  <Td>{dateTimeRange(e.starts_at, e.ends_at)}</Td>
                  <Td>{e.title}</Td>
                  <Td align="right">
                    <Badge tone="neutral">{e.status}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
