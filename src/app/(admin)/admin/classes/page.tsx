import { CalendarCheck, GraduationCap, Users, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AddPanel } from "@/components/admin/AddPanel";
import { ClassCard, type SessionView } from "@/components/admin/ClassCard";
import { ClassForm } from "@/components/admin/ClassForm";
import { RunButton } from "@/components/admin/RunButton";
import { Stat } from "@/components/admin/Stat";
import { Card, CardHeader } from "@/components/ui/Table";
import { runSessionDecisions } from "./actions";
import {
  getClassEquipment,
  getClassSettings,
  getClassSessions,
  getClasses,
  getEnrolments,
  getInstructors,
  getMemberships,
} from "@/lib/data/classes";
import { getRooms } from "@/lib/data/public";
import { sessionMoney } from "@/lib/classes";
import { money } from "@/lib/format";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const [
    classes,
    sessions,
    enrolments,
    instructors,
    rooms,
    memberships,
    settings,
    classEquipment,
  ] = await Promise.all([
    getClasses(),
    getClassSessions(),
    getEnrolments(),
    getInstructors(),
    getRooms(),
    getMemberships(),
    getClassSettings(),
    getClassEquipment(),
  ]);

  const instructorById = new Map(instructors.map((i) => [i.id, i]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const activeMemberships = memberships.filter((m) => m.status === "active");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Build every session's money once, then hand each class its own slice.
  const views = new Map<string, SessionView[]>();
  for (const session of sessions) {
    const klass = classes.find((c) => c.id === session.class_id);
    if (!klass) continue;

    const mine = enrolments.filter((e) => e.session_id === session.id);
    const view: SessionView = {
      session,
      enrolments: mine,
      money: sessionMoney(klass, mine, {
        settings,
        instructor: instructorById.get(klass.instructor_id ?? "") ?? null,
        equipment: classEquipment.get(klass.id),
      }),
    };

    const list = views.get(klass.id) ?? [];
    list.push(view);
    views.set(klass.id, list);
  }

  const allViews = [...views.values()].flat();

  const waiting = allViews.filter(
    (v) => v.session.status === "scheduled" && new Date(v.session.starts_at) >= now,
  );
  const confirmed = allViews.filter(
    (v) => v.session.status === "confirmed" && new Date(v.session.starts_at) >= now,
  );
  const deliveredThisMonth = allViews.filter(
    (v) =>
      v.session.status === "delivered" &&
      new Date(v.session.starts_at) >= monthStart,
  );

  const seatsThisMonth = deliveredThisMonth.reduce(
    (s, v) => s + v.money.headcount,
    0,
  );
  const subsidyThisMonth = deliveredThisMonth.reduce(
    (s, v) => s + v.money.subsidyCents,
    0,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Programs"
        title="Classes"
        description="What&rsquo;s being taught here, who&rsquo;s coming, and what everyone is owed."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Classes running"
          value={String(classes.filter((c) => c.status === "open").length)}
          sub={`${classes.length} in total`}
          icon={GraduationCap}
        />
        <Stat
          label="Going ahead"
          value={String(confirmed.length)}
          sub="Sessions confirmed"
          icon={CalendarCheck}
        />
        <Stat
          label="Waiting on numbers"
          value={String(waiting.length)}
          sub="Not yet at their minimum"
          tone={waiting.length > 0 ? "bad" : "default"}
        />
        <Stat
          label="Seats filled"
          value={String(seatsThisMonth)}
          sub={`This month · ${money(subsidyThisMonth)} subsidized`}
          icon={Users}
        />
      </div>

      <Card>
        <CardHeader
          title="The rule that runs itself"
          tone="olive"
          description={`A session needs its minimum signed up by ${settings.confirm_hours_before} hours before it starts, or it cancels and credits go back. This happens on its own each night — the button is for watching it work.`}
        />
        <div className="px-5 pb-5">
          <RunButton
            action={runSessionDecisions}
            label="Confirm or cancel now"
            icon={<Wand2 className="h-3.5 w-3.5" aria-hidden />}
          />
        </div>
      </Card>

      <AddPanel
        label="Add a class"
        title="A new class"
        description="Nothing is listed on the website until you set it to open."
      >
        <ClassForm instructors={instructors} rooms={rooms} />
      </AddPanel>

      {classes.length === 0 ? (
        <Card>
          <p className="px-5 py-12 text-center text-sm text-ink-faint">
            No classes yet. Add one above, and it&rsquo;ll appear on the website
            once you set it to open.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {classes.map((klass) => (
            <ClassCard
              key={klass.id}
              klass={klass}
              instructor={instructorById.get(klass.instructor_id ?? "") ?? null}
              room={roomById.get(klass.room_id ?? "") ?? null}
              sessions={(views.get(klass.id) ?? []).sort((a, b) =>
                a.session.starts_at.localeCompare(b.session.starts_at),
              )}
              instructors={instructors}
              rooms={rooms}
              memberships={activeMemberships}
            />
          ))}
        </div>
      )}
    </div>
  );
}
