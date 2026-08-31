import { Award, Boxes, HandCoins, Package } from "lucide-react";
import { AddPanel } from "@/components/admin/AddPanel";
import { RunButton } from "@/components/admin/RunButton";
import { Stat } from "@/components/admin/Stat";
import {
  EquipmentForm,
  EquipmentRowItem,
  InstructorForm,
  InstructorRow,
  StatementBuilder,
  StatementRow,
  StorageForm,
  StorageRowItem,
} from "@/components/admin/InstructorForms";
import {
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Th,
} from "@/components/ui/Table";
import { refreshStandings } from "./actions";
import {
  getClassSessions,
  getClassSettings,
  getClasses,
  getEnrolments,
  getEquipment,
  getInstructors,
  getStorageRentals,
} from "@/lib/data/classes";
import { getContacts, getInstructorStatements } from "@/lib/data/admin";
import { earnedStanding, storageDueForMonth } from "@/lib/classes";
import { money } from "@/lib/format";

export const metadata = { title: "Instructors" };

export default async function InstructorsPage() {
  const [
    instructors,
    equipment,
    storage,
    classes,
    sessions,
    enrolments,
    contacts,
    statements,
    settings,
  ] = await Promise.all([
    getInstructors(),
    getEquipment(),
    getStorageRentals(),
    getClasses(),
    getClassSessions(),
    getEnrolments(),
    getContacts(),
    getInstructorStatements(),
    getClassSettings(),
  ]);

  const classOwner = new Map(classes.map((c) => [c.id, c.instructor_id]));
  const instructorName = new Map(instructors.map((i) => [i.id, i.display_name]));

  const attendedBySession = new Map<string, number>();
  for (const e of enrolments) {
    if (e.cancelled_at || e.attended === false) continue;
    attendedBySession.set(
      e.session_id,
      (attendedBySession.get(e.session_id) ?? 0) + 1,
    );
  }

  /** The same arithmetic the promotion routine uses, shown as a checklist. */
  const record = new Map(
    instructors.map((instructor) => {
      const theirs = sessions.filter(
        (s) => classOwner.get(s.class_id) === instructor.id,
      );
      const delivered = theirs.filter((s) => s.status === "delivered");
      const cancelled = theirs.filter((s) => s.status === "cancelled");
      const heads = delivered.reduce(
        (sum, s) => sum + (attendedBySession.get(s.id) ?? 0),
        0,
      );
      const average = delivered.length ? heads / delivered.length : 0;

      return [
        instructor.id,
        {
          delivered: delivered.length,
          average,
          ...earnedStanding(delivered.length, average, cancelled.length, settings),
        },
      ] as const;
    }),
  );

  const now = new Date();
  const currentStorage = storage.filter((s) => !s.ended_on);
  const monthlyStorage = storageDueForMonth(currentStorage, now);

  const unpaid = statements.filter((s) => s.status !== "paid");
  const owed = unpaid.reduce((s, x) => s + x.net_payout_cents, 0);

  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Instructors</h1>
        <p className="mt-1.5 text-ink-soft">
          Who teaches here, what they&rsquo;re owed, and what they rent from
          you.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Teaching here"
          value={String(instructors.filter((i) => i.is_active).length)}
          sub={`${instructors.filter((i) => i.standing === "earned").length} at earned standing`}
          icon={Award}
        />
        <Stat
          label="To pay out"
          value={money(owed)}
          sub={`${unpaid.length} statement${unpaid.length === 1 ? "" : "s"} waiting`}
          icon={HandCoins}
          tone={owed > 0 ? "bad" : "default"}
        />
        <Stat
          label="Storage let"
          value={money(monthlyStorage)}
          sub={`${currentStorage.length} space${currentStorage.length === 1 ? "" : "s"}, per month`}
          icon={Package}
        />
        <Stat
          label="Equipment"
          value={String(equipment.filter((e) => e.is_active).length)}
          sub="Items available to hire"
          icon={Boxes}
        />
      </div>

      {/* ---------- Instructors ---------- */}
      <Card>
        <CardHeader
          title="Who teaches here"
          description="Standing is worked out from the numbers, never decided. Earned standing brings priority on the calendar and a place at the top of the classes page — it is not pay for a class that didn't run."
          action={
            <RunButton
              action={refreshStandings}
              label="Update standings"
              icon={Award}
            />
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th align="right">Taught</Th>
              <Th align="right">Average</Th>
              <Th align="right">Storage</Th>
              <Th align="right">Standing</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {instructors.length === 0 ? (
              <EmptyRow colSpan={6}>Nobody added yet.</EmptyRow>
            ) : (
              instructors.map((i) => {
                const r = record.get(i.id);
                return (
                  <InstructorRow
                    key={i.id}
                    instructor={i}
                    contacts={contacts}
                    storage={currentStorage.filter((s) => s.instructor_id === i.id)}
                    sessionsDelivered={r?.delivered ?? 0}
                    averageAttendance={r?.average ?? 0}
                    reasons={r?.reasons ?? []}
                  />
                );
              })
            )}
          </tbody>
        </Table>
      </Card>

      <AddPanel label="Add an instructor" title="A new instructor">
        <InstructorForm contacts={contacts} />
      </AddPanel>

      {/* ---------- Statements ---------- */}
      <Card>
        <CardHeader
          title="Monthly statements"
          description="What each instructor earned, what they owe you for equipment and storage, and what's left to pay them. Equipment and storage are separate lines so they can see exactly what they're being charged for."
        />

        <StatementBuilder defaultMonth={thisMonth} />

        <Table>
          <thead>
            <tr>
              <Th>Instructor</Th>
              <Th align="right">Class fees</Th>
              <Th align="right">Their share</Th>
              <Th align="right">Equipment</Th>
              <Th align="right">Storage</Th>
              <Th align="right">To pay</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {statements.length === 0 ? (
              <EmptyRow colSpan={7}>
                None yet. Choose a month above and prepare them.
              </EmptyRow>
            ) : (
              statements.map((s) => (
                <StatementRow
                  key={s.id}
                  statement={s}
                  instructorName={instructorName.get(s.instructor_id) ?? "Unknown"}
                />
              ))
            )}
          </tbody>
        </Table>

        <p className="border-t border-tan/20 px-5 py-3.5 text-xs text-ink-faint">
          Anyone you pay more than $500 in a year needs a T4A by the end of
          February. These statements are what that figure comes from.
        </p>
      </Card>

      {/* ---------- Equipment ---------- */}
      <Card>
        <CardHeader
          title="Equipment to hire"
          description="Things the hub owns. Charged per session that actually runs, and it's your income, not the instructor's."
        />
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th align="right">We have</Th>
              <Th align="right">Per session</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {equipment.length === 0 ? (
              <EmptyRow colSpan={4}>Nothing listed yet.</EmptyRow>
            ) : (
              equipment.map((e) => <EquipmentRowItem key={e.id} item={e} />)
            )}
          </tbody>
        </Table>
      </Card>

      <AddPanel label="Add equipment" title="Something new to hire out">
        <EquipmentForm />
      </AddPanel>

      {/* ---------- Storage ---------- */}
      <Card>
        <CardHeader
          title="Storage"
          description="Space instructors rent to keep their own things here between classes. Billed monthly, whether or not any classes ran."
        />
        <Table>
          <thead>
            <tr>
              <Th>Whose</Th>
              <Th>Where</Th>
              <Th align="right">Per month</Th>
              <Th align="right">Status</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {storage.length === 0 ? (
              <EmptyRow colSpan={5}>Nothing let yet.</EmptyRow>
            ) : (
              storage.map((s) => (
                <StorageRowItem
                  key={s.id}
                  rental={s}
                  instructorName={instructorName.get(s.instructor_id) ?? "Unknown"}
                  instructors={instructors}
                />
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <AddPanel label="Let some storage" title="New storage">
        <StorageForm instructors={instructors} />
      </AddPanel>
    </div>
  );
}
