import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import {
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Td,
  Th,
} from "@/components/ui/Table";
import { requireUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { dateShort, dateTimeRange, moneyExact } from "@/lib/format";
import type { BookingRow, InvoiceRow } from "@/lib/data/types";
import {
  getCreditLedgerFor,
  getCreditSettings,
  getMembershipForContact,
} from "@/lib/data/classes";
import { creditBalance } from "@/lib/credits";
import { getMaintenance, getMyLease } from "@/lib/data/maintenance";
import { signedUrl } from "@/lib/maintenance-files";
import { MyRequest, ReportIssueForm } from "@/components/site/MaintenanceForms";
import { SignaturePad } from "@/components/site/SignaturePad";
import { signatureUrl } from "@/lib/signature-files";
import { getMyMoveOut, getSignatureEvent } from "@/lib/data/move-out";
import { MoveOutChecklist } from "@/components/site/MoveOutChecklist";
import { AvatarPicker } from "@/components/site/AvatarPicker";
import { avatarUrl } from "@/lib/avatar-files";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

/** 1 -> "1st", 2 -> "2nd". Rent is due on a day, not on a number. */
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export default async function PortalPage() {
  const user = await requireUser("/portal");

  let invoices: InvoiceRow[] = [];
  let bookings: (BookingRow & { rooms: { name: string } | null })[] = [];

  if (user.contactId) {
    const supabase = await getServerSupabase();
    // Row-level security limits this to the signed-in person's own invoices.
    const { data } = (await supabase
      ?.from("invoice_balances")
      .select("*")
      .eq("contact_id", user.contactId)
      .order("due_date", { ascending: false })) ?? { data: null };

    invoices = (data as InvoiceRow[]) ?? [];
  }

  {
    const supabase = await getServerSupabase();
    // Row-level security matches on the signed-in email, so this returns only
    // their own bookings without needing a filter here.
    const { data } = (await supabase
      ?.from("bookings")
      .select("*, rooms:room_id (name)")
      .gte("ends_at", new Date().toISOString())
      .neq("status", "cancelled")
      .order("starts_at")) ?? { data: null };

    bookings = (data as typeof bookings) ?? [];
  }

  const tenancy = await getMyLease(user.contactId);

  // Their signature, if they've added one.
  let mySignature: {
    url: string | null;
    createdAt: string;
    source: "drawn" | "uploaded";
  } | null = null;
  {
    const supabase = await getServerSupabase();
    const { data } = (await supabase
      ?.from("signatures")
      .select("image_path, created_at, source")
      .eq("profile_id", user.id)
      .maybeSingle()) ?? { data: null };

    const row = data as {
      image_path: string;
      created_at: string;
      source: "drawn" | "uploaded" | null;
    } | null;
    if (row) {
      mySignature = {
        url: await signatureUrl(row.image_path),
        createdAt: row.created_at,
        source: row.source ?? "drawn",
      };
    }
  }

  // Their profile picture.
  let myAvatar: string | null = null;
  {
    const supabase = await getServerSupabase();
    const { data } = (await supabase
      ?.from("profiles")
      .select("avatar_path")
      .eq("id", user.id)
      .maybeSingle()) ?? { data: null };

    myAvatar = await avatarUrl(
      (data as { avatar_path: string | null } | null)?.avatar_path ?? null,
    );
  }
  // A tenancy that is ending, if one is.
  const moveOut = await getMyMoveOut(user.contactId);
  const moveOutSignature = await getSignatureEvent(
    moveOut?.moveOut.tenant_signature_event ?? null,
  );

  const myRequests = user.contactId ? await getMaintenance() : [];
  const requestPhotos = await Promise.all(
    myRequests.map((r) => signedUrl(r.photo_path)),
  );

  const membership = await getMembershipForContact(user.contactId);
  const ledger = membership ? await getCreditLedgerFor(membership.id) : [];
  const balance = creditBalance(ledger);
  const creditSettings = await getCreditSettings();

  // Classes they're signed up for. Row-level security limits this to their own.
  let myClasses: {
    id: string;
    tier: string;
    credits_spent: number;
    class_sessions: {
      starts_at: string;
      ends_at: string;
      status: string;
      classes: { title: string } | null;
    } | null;
  }[] = [];

  if (user.contactId) {
    const supabase = await getServerSupabase();
    const { data } = (await supabase
      ?.from("enrolments")
      .select(
        "id, tier, credits_spent, class_sessions!inner(starts_at, ends_at, status, classes!inner(title))",
      )
      .eq("contact_id", user.contactId)
      .is("cancelled_at", null)) ?? { data: null };

    type Raw = {
      id: string;
      tier: string;
      credits_spent: number;
      class_sessions:
        | {
            starts_at: string;
            ends_at: string;
            status: string;
            classes: { title: string }[] | { title: string } | null;
          }[]
        | {
            starts_at: string;
            ends_at: string;
            status: string;
            classes: { title: string }[] | { title: string } | null;
          }
        | null;
    };

    const one = <T,>(v: T[] | T | null): T | null =>
      Array.isArray(v) ? (v[0] ?? null) : v;

    myClasses = ((data as unknown as Raw[]) ?? [])
      .map((row) => {
        const session = one(row.class_sessions);
        return {
          id: row.id,
          tier: row.tier,
          credits_spent: row.credits_spent,
          class_sessions: session
            ? { ...session, classes: one(session.classes) }
            : null,
        };
      })
      .filter(
      (e) =>
        e.class_sessions &&
        new Date(e.class_sessions.ends_at) >= new Date() &&
        e.class_sessions.status !== "cancelled",
    );
  }

  const owing = invoices
    .filter((i) => i.state === "overdue" || i.state === "outstanding")
    .reduce((s, i) => s + i.balance_cents, 0);

  return (
    <Section tint="cream">
      <Container>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl">
              Hello{user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-2 text-ink-soft">
              Signed in as {user.email}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/book" size="sm">
              Book a room
            </ButtonLink>
            <ButtonLink href="/calendar" variant="secondary" size="sm">
              What&rsquo;s on
            </ButtonLink>
          </div>
        </header>

        {tenancy && (
          <Card className="mt-8">
            <CardHeader
              title="Your place"
              description={
                tenancy.unit?.description ?? undefined
              }
            />
            <div className="grid gap-x-8 gap-y-4 px-5 py-5 sm:grid-cols-3">
              <div>
                <p className="eyebrow !text-[0.6rem] text-bark">Where</p>
                <p className="mt-1 text-ink">{tenancy.unit?.name ?? "Your unit"}</p>
              </div>
              <div>
                <p className="eyebrow !text-[0.6rem] text-bark">Rent</p>
                <p className="mt-1 text-ink">
                  {moneyExact(tenancy.lease.rent_cents)}
                  <span className="text-ink-soft"> a month</span>
                </p>
              </div>
              <div>
                <p className="eyebrow !text-[0.6rem] text-bark">Due</p>
                <p className="mt-1 text-ink">
                  The {ordinal(tenancy.lease.due_day)} of each month
                </p>
              </div>
              <div>
                <p className="eyebrow !text-[0.6rem] text-bark">Since</p>
                <p className="mt-1 text-ink">{dateShort(tenancy.lease.start_date)}</p>
              </div>
              {tenancy.lease.end_date && (
                <div>
                  <p className="eyebrow !text-[0.6rem] text-bark">Until</p>
                  <p className="mt-1 text-ink">{dateShort(tenancy.lease.end_date)}</p>
                </div>
              )}
              {tenancy.lease.deposit_cents > 0 && (
                <div>
                  <p className="eyebrow !text-[0.6rem] text-bark">Deposit held</p>
                  <p className="mt-1 text-ink">
                    {moneyExact(tenancy.lease.deposit_cents)}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ---------- Repairs ---------- */}
        <Card className="mt-8">
          <CardHeader
            title="Something need fixing?"
            description="Tell Tausha here rather than hoping to catch her. It goes straight onto her list, and you'll be told when it's done."
          />
          <div className="px-5 py-5">
            <ReportIssueForm />
          </div>

          {myRequests.length > 0 && (
            <ul className="divide-y divide-tan/20 border-t border-tan/20">
              {myRequests.map((r, i) => (
                <MyRequest
                  key={r.id}
                  request={r}
                  unitName={tenancy?.unit?.name ?? null}
                  photoUrl={requestPhotos[i]}
                />
              ))}
            </ul>
          )}
        </Card>

        {/* ---------- Picture ---------- */}
        <Card className="mt-8">
          <CardHeader
            title="Your picture"
            description="So people here see a face rather than an email address."
          />
          <div className="px-5 py-5">
            <AvatarPicker existing={myAvatar} />
          </div>
        </Card>

        {/* ---------- Signature ---------- */}
        <Card className="mt-8">
          <CardHeader
            title="Your signature"
            description="Added once, then used whenever you sign something here — a lease, a move-out checklist, a policy."
          />
          <div className="px-5 py-5">
            <SignaturePad existing={mySignature} />
          </div>
        </Card>

        {moveOut && (
          <Card className="mt-8">
            <CardHeader
              title="Leaving"
              description="The clean-out list, so there are no surprises at the end and nothing comes off your deposit that shouldn't."
            />
            <MoveOutChecklist
              moveOut={moveOut.moveOut}
              items={moveOut.items}
              hasSignature={Boolean(mySignature)}
              verifyCode={moveOutSignature?.verify_code ?? null}
            />
          </Card>
        )}

        {membership && (
          <Card className="mt-8">
            <CardHeader
              title="Your community plan"
              description={
                membership.plan === "family"
                  ? "One pool of credits for the whole household."
                  : undefined
              }
            />
            <div className="flex flex-wrap items-end justify-between gap-6 px-5 py-5">
              <div>
                <p className="eyebrow !text-[0.6rem] text-bark">
                  Credits to spend
                </p>
                <p className="mt-1 font-display text-4xl font-semibold text-olive-deep">
                  {balance.available}
                </p>
                {balance.expiringSoon > 0 && (
                  <p className="mt-1 text-sm text-burgundy">
                    {balance.expiringSoon} of them go at the end of this month.
                  </p>
                )}
                <p className="mt-1 text-sm text-ink-soft">
                  {membership.credits_per_month} more on the first of the month.
                  They keep for {creditSettings.rollover_months} months.
                </p>
              </div>
              <ButtonLink href="/classes" size="sm">
                Spend them
              </ButtonLink>
            </div>
          </Card>
        )}

        {myClasses.length > 0 && (
          <Card className="mt-8">
            <CardHeader
              title="Classes you're coming to"
              description="If one doesn't get its numbers it won't run, and we'll email you the day before."
            />
            <Table>
              <thead>
                <tr>
                  <Th>What</Th>
                  <Th>When</Th>
                  <Th align="right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {myClasses.map((e) => (
                  <tr key={e.id}>
                    <Td>{e.class_sessions?.classes?.title ?? "Class"}</Td>
                    <Td>
                      {e.class_sessions &&
                        dateTimeRange(
                          e.class_sessions.starts_at,
                          e.class_sessions.ends_at,
                        )}
                    </Td>
                    <Td align="right">
                      <Badge
                        tone={
                          e.class_sessions?.status === "confirmed"
                            ? "good"
                            : "warn"
                        }
                      >
                        {e.class_sessions?.status === "confirmed"
                          ? "going ahead"
                          : "waiting on numbers"}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        <Card className="mt-8">
          <CardHeader
            title="Your bookings"
            description="Rooms you have coming up."
          />
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Room</Th>
                <Th>What</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <EmptyRow colSpan={4}>
                  Nothing booked yet.{" "}
                  <a href="/book" className="text-burgundy underline-offset-4 hover:underline">
                    Book a room
                  </a>
                  .
                </EmptyRow>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id}>
                    <Td>{dateTimeRange(b.starts_at, b.ends_at)}</Td>
                    <Td>{b.rooms?.name ?? "—"}</Td>
                    <Td>{b.title}</Td>
                    <Td align="right">
                      <Badge tone={b.status === "confirmed" ? "good" : "warn"}>
                        {b.status}
                      </Badge>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>

        {owing > 0 && (
          <p className="mt-6 inline-block rounded-[var(--radius-card)] border border-burgundy/25 bg-blush/40 px-5 py-3 text-sm">
            Currently owing{" "}
            <strong className="text-burgundy">{moneyExact(owing)}</strong>
          </p>
        )}

        <Card className="mt-8">
          <CardHeader title="Your invoices" />
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>What for</Th>
                <Th>Due</Th>
                <Th align="right">Amount</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <EmptyRow colSpan={5}>
                  Nothing here yet. If you think something should be, email{" "}
                  {site.email}.
                </EmptyRow>
              ) : (
                invoices.map((i) => (
                  <tr key={i.id}>
                    <Td className="font-mono text-xs text-ink-soft">
                      {i.number}
                    </Td>
                    <Td>{i.description}</Td>
                    <Td>{dateShort(i.due_date)}</Td>
                    <Td align="right" className="font-semibold">
                      {moneyExact(i.amount_cents + i.tax_cents)}
                    </Td>
                    <Td align="right">
                      <Badge
                        tone={
                          i.state === "paid"
                            ? "good"
                            : i.state === "overdue"
                              ? "bad"
                              : "warn"
                        }
                      >
                        {i.state}
                      </Badge>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>

        <p className="mt-6 text-sm text-ink-soft">
          Questions about anything here? Email{" "}
          <a
            href={`mailto:${site.email}`}
            className="text-burgundy underline-offset-4 hover:underline"
          >
            {site.email}
          </a>{" "}
          — and if paying is difficult right now, please say so. We&rsquo;d
          rather know.
        </p>
      </Container>
    </Section>
  );
}
