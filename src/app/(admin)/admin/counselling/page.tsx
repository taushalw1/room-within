import { CalendarClock, Inbox, Lock, ShieldCheck } from "lucide-react";
import { AddPanel } from "@/components/admin/AddPanel";
import { Stat } from "@/components/admin/Stat";
import { TaskForm } from "@/components/admin/TaskForm";
import { TaskItem } from "@/components/admin/TaskItem";
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
import {
  getAppointments,
  getCounsellingRequests,
  getTasks,
} from "@/lib/data/admin";
import { dateShort, dateTimeRange, money, relative } from "@/lib/format";

export default async function CounsellingPage() {
  const [appointments, tasks, requests] = await Promise.all([
    getAppointments(),
    getTasks(),
    getCounsellingRequests(),
  ]);

  const now = new Date();
  const upcoming = appointments
    .filter((a) => new Date(a.starts_at) >= now && a.status === "scheduled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = appointments
    .filter((a) => new Date(a.starts_at) < now)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  const openTasks = tasks.filter((t) => t.status !== "done");
  const newRequests = requests.filter((r) => r.status === "new");

  const thisWeekHours = upcoming
    .filter(
      (a) =>
        new Date(a.starts_at).getTime() - now.getTime() < 7 * 86_400_000,
    )
    .reduce(
      (s, a) =>
        s +
        (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) /
          3_600_000,
      0,
    );

  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">Counselling</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1">
            <Lock className="h-3 w-3 text-burgundy" aria-hidden />
            <span className="eyebrow !text-[0.55rem] text-burgundy">
              Only you
            </span>
          </span>
        </div>
        <p className="mt-1.5 text-ink-soft">
          Your appointments, notes and to-do list. Nobody else can open this
          page — not tenants, not people who book rooms, not other signed-in
          users.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="New requests"
          value={String(newRequests.length)}
          sub="People asking for an appointment"
          icon={Inbox}
          tone={newRequests.length > 0 ? "bad" : "default"}
        />
        <Stat
          label="Booked ahead"
          value={String(upcoming.length)}
          sub="Sessions scheduled"
          icon={CalendarClock}
        />
        <Stat
          label="Next seven days"
          value={`${thisWeekHours.toFixed(1)}h`}
          sub="Time in session"
        />
        <Stat
          label="On your list"
          value={String(openTasks.length)}
          sub="Tasks not yet done"
        />
      </div>

      {/* ---------- Requests ---------- */}
      <Card id="requests" className={newRequests.length ? "border-burgundy/25" : undefined}>
        <CardHeader
          title="Requests from the website"
          description="Sent through the 'Request an appointment' form."
        />
        <ul className="divide-y divide-tan/20">
          {requests.length === 0 ? (
            <li className="px-5 py-12 text-center text-sm text-ink-faint">
              No requests yet.
            </li>
          ) : (
            requests.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.full_name}</p>
                    <p className="text-xs text-ink-faint">
                      {r.email}
                      {r.phone ? ` · ${r.phone}` : ""} · {relative(r.created_at)}
                    </p>
                  </div>
                  <Badge tone={r.status === "new" ? "bad" : "neutral"}>
                    {r.status}
                  </Badge>
                </div>
                {r.message && (
                  <p className="mt-2.5 rounded bg-parchment px-3 py-2 text-sm text-ink-soft">
                    {r.message}
                  </p>
                )}
                {r.preferred_times && (
                  <p className="mt-2 text-xs text-ink-faint">
                    Prefers: {r.preferred_times}
                  </p>
                )}
                <div className="mt-3">
                  <ButtonLink
                    href={`mailto:${r.email}?subject=${encodeURIComponent("Your enquiry — Room Within")}`}
                    size="sm"
                    variant="secondary"
                  >
                    Reply by email
                  </ButtonLink>
                </div>
              </li>
            ))
          )}
        </ul>
      </Card>

      {/* ---------- Schedule ---------- */}
      <Card>
        <CardHeader
          title="Your schedule"
          description="Sessions only you can see."
          action={
            <ButtonLink href="/admin/counselling/subscribe" size="sm" variant="ghost">
              Add to Google Calendar
            </ButtonLink>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Client</Th>
              <Th>Type</Th>
              <Th>Where</Th>
              <Th align="right">Fee</Th>
            </tr>
          </thead>
          <tbody>
            {upcoming.length === 0 ? (
              <EmptyRow colSpan={5}>Nothing booked.</EmptyRow>
            ) : (
              upcoming.map((a) => (
                <tr key={a.id}>
                  <Td>{dateTimeRange(a.starts_at, a.ends_at)}</Td>
                  <Td className="font-medium">{a.client_name}</Td>
                  <Td>
                    <Badge tone={a.kind === "intake" ? "info" : "neutral"}>
                      {a.kind.replace("_", " ")}
                    </Badge>
                  </Td>
                  <Td className="text-ink-soft">{a.location ?? "—"}</Td>
                  <Td align="right">
                    {a.rate_cents > 0 ? money(a.rate_cents) : "—"}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Tasks ---------- */}
      <div id="tasks" className="space-y-6">
        <AddPanel
          label="Add a task"
          description="Anything you need to remember — it's private to you."
        >
          <TaskForm />
        </AddPanel>

        <Card>
          <CardHeader
            title="Your to-do list"
            description="Tick things off as you go. Done tasks stay at the bottom."
          />
          <ul className="divide-y divide-tan/15">
            {tasks.length === 0 ? (
              <li className="px-5 py-12 text-center text-sm text-ink-faint">
                Nothing on the list.
              </li>
            ) : (
              // Open work first, then anything already ticked off.
              [...tasks]
                .sort((a, b) => {
                  const done = (t: typeof a) => (t.status === "done" ? 1 : 0);
                  if (done(a) !== done(b)) return done(a) - done(b);
                  return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
                })
                .map((t) => <TaskItem key={t.id} task={t} />)
            )}
          </ul>
        </Card>
      </div>

      {/* ---------- Past sessions ---------- */}
      <Card>
        <CardHeader
          title="Past sessions"
          description="Session notes open one at a time, and every time a note is opened it's recorded."
        />
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Client</Th>
              <Th>Type</Th>
              <Th align="right">Status</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {past.length === 0 ? (
              <EmptyRow colSpan={5}>No past sessions.</EmptyRow>
            ) : (
              past.slice(0, 10).map((a) => (
                <tr key={a.id}>
                  <Td>{dateTimeRange(a.starts_at, a.ends_at)}</Td>
                  <Td className="font-medium">{a.client_name}</Td>
                  <Td>{a.kind.replace("_", " ")}</Td>
                  <Td align="right">
                    <Badge
                      tone={
                        a.status === "completed"
                          ? "good"
                          : a.status === "no_show"
                            ? "bad"
                            : "neutral"
                      }
                    >
                      {a.status.replace("_", " ")}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <ButtonLink
                      href={`/admin/counselling/${a.id}`}
                      size="sm"
                      variant="ghost"
                    >
                      Notes
                    </ButtonLink>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Privacy note ---------- */}
      <Card className="bg-parchment/70">
        <div className="flex gap-4 px-5 py-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-olive" aria-hidden />
          <div className="text-sm text-ink-soft">
            <h2 className="font-display text-base font-semibold text-olive-deep">
              How this information is protected
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>
                Appointments, notes and tasks are restricted to your account by
                the database itself, not just by this page.
              </li>
              <li>
                Every time a session note is opened, that&rsquo;s written to a
                log that can&rsquo;t be edited or deleted.
              </li>
              <li>
                Data is stored in Supabase and encrypted on disk. It is held on
                servers in the region chosen when the project was created.
              </li>
              <li className="text-burgundy">
                Before you store real client notes here, confirm with your
                regulatory college that this arrangement meets your obligations
                under Alberta&rsquo;s PIPA and Health Information Act —
                particularly on where data may be stored and how long it must be
                kept.
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
