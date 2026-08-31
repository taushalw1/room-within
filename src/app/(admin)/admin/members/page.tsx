import { CircleDollarSign, Coins, TicketPercent, Users } from "lucide-react";
import { AddPanel } from "@/components/admin/AddPanel";
import { RunButton } from "@/components/admin/RunButton";
import { Stat } from "@/components/admin/Stat";
import {
  MembershipForm,
  MembershipRowItem,
} from "@/components/admin/MemberForms";
import {
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Th,
} from "@/components/ui/Table";
import { grantMonthlyCredits } from "./actions";
import {
  getCreditLedger,
  getCreditSettings,
  getMemberships,
} from "@/lib/data/classes";
import { getContacts } from "@/lib/data/admin";
import { creditBalance, creditValueCents, creditWarnings } from "@/lib/credits";
import { money, moneyExact } from "@/lib/format";

export const metadata = { title: "Members" };

export default async function MembersPage() {
  const [memberships, ledger, contacts, settings] = await Promise.all([
    getMemberships(),
    getCreditLedger(),
    getContacts(),
    getCreditSettings(),
  ]);

  const contactName = new Map(contacts.map((c) => [c.id, c.full_name]));

  const balances = new Map(
    memberships.map((m) => [
      m.id,
      creditBalance(ledger.filter((r) => r.membership_id === m.id)),
    ]),
  );

  const active = memberships.filter((m) => m.status === "active");
  const monthlyIncome = active.reduce((s, m) => s + m.monthly_price_cents, 0);

  // Credits sold and not yet used are a class owed, not money earned.
  const outstandingCredits = [...balances.values()].reduce(
    (s, b) => s + b.available,
    0,
  );
  const liability = memberships.reduce((sum, m) => {
    const b = balances.get(m.id);
    if (!b) return sum;
    return sum + b.available * creditValueCents(m.plan, settings);
  }, 0);

  const warnings = creditWarnings(settings);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Members</h1>
        <p className="mt-1.5 text-ink-soft">
          Community plans, and the credits people have to spend on classes.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Members"
          value={String(active.length)}
          sub={`${active.filter((m) => m.plan === "family").length} family plans`}
          icon={Users}
        />
        <Stat
          label="Coming in monthly"
          value={money(monthlyIncome)}
          sub="If nobody leaves"
          icon={CircleDollarSign}
        />
        <Stat
          label="Credits unspent"
          value={String(outstandingCredits)}
          sub="Classes owed, not yet taught"
          icon={Coins}
        />
        <Stat
          label="What that's worth"
          value={money(liability)}
          sub="Money taken, not yet earned"
          icon={TicketPercent}
          tone={liability > monthlyIncome * 2 ? "bad" : "default"}
        />
      </div>

      <Card className="bg-parchment/40">
        <CardHeader
          title="Credits sold are not money earned"
          description="Somebody who buys eight credits has paid for eight classes you haven't taught yet. Until they turn up, that money is a promise. It's worth keeping enough back to cover it."
        />
        <div className="px-5 pb-5">
          <RunButton
            action={grantMonthlyCredits}
            label="Give out this month's credits"
            icon={<Coins className="h-3.5 w-3.5" aria-hidden />}
          />
          <p className="mt-2.5 text-xs text-ink-faint">
            This runs by itself on the first of each month. Pressing it again is
            harmless — nobody can be credited twice for the same month.
          </p>
        </div>
      </Card>

      {warnings.length > 0 && (
        <Card className="border-burgundy/25 bg-blush/30">
          <CardHeader title="Worth a look at the pricing" />
          <ul className="space-y-2 px-5 pb-5 text-sm text-ink-soft">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Memberships"
          description="A family plan is one shared pool of credits, so a household has one balance between them."
        />
        <Table>
          <thead>
            <tr>
              <Th>Who</Th>
              <Th>Plan</Th>
              <Th align="right">Monthly</Th>
              <Th align="right">Credits left</Th>
              <Th align="right">Status</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {memberships.length === 0 ? (
              <EmptyRow colSpan={6}>Nobody has joined yet.</EmptyRow>
            ) : (
              memberships.map((m) => (
                <MembershipRowItem
                  key={m.id}
                  membership={m}
                  memberName={contactName.get(m.contact_id) ?? "Unknown"}
                  balance={
                    balances.get(m.id) ?? {
                      available: 0,
                      expired: 0,
                      expiringSoon: 0,
                      outstanding: 0,
                    }
                  }
                  contacts={contacts}
                  settings={settings}
                />
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <AddPanel label="Add a membership" title="A new member">
        <MembershipForm contacts={contacts} settings={settings} />
      </AddPanel>

      <Card>
        <CardHeader
          title="What the plans cost"
          description="Change these on the settings page. They're the starting figures whenever you add someone."
        />
        <div className="grid gap-6 px-5 py-5 sm:grid-cols-2">
          <PlanSummary
            title="Individual"
            price={settings.individual_price_cents}
            credits={settings.individual_credits}
            perCredit={creditValueCents("individual", settings)}
          />
          <PlanSummary
            title="Family"
            price={settings.family_price_cents}
            credits={settings.family_credits}
            perCredit={creditValueCents("family", settings)}
            note={`One shared pool. At most ${settings.family_same_class_cap} credits a month can go on any single class, so one keen child can't spend the lot.`}
          />
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-tan/20 px-5 py-4 text-sm text-ink-soft">
          <span>
            Drop-in without a plan:{" "}
            <strong>{moneyExact(settings.dropin_cents)}</strong>
          </span>
          <span>
            Extra credits:{" "}
            <strong>{moneyExact(settings.extra_credit_cents)}</strong> each
          </span>
          <span>
            Credits last <strong>{settings.rollover_months} months</strong>
          </span>
        </div>
      </Card>
    </div>
  );
}

function PlanSummary({
  title,
  price,
  credits,
  perCredit,
  note,
}: {
  title: string;
  price: number;
  credits: number;
  perCredit: number;
  note?: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] bg-parchment/60 p-5">
      <p className="eyebrow !text-[0.6rem] text-bark">{title}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-olive-deep">
        {moneyExact(price)}
        <span className="ml-1.5 text-base font-normal text-ink-soft">
          a month
        </span>
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {credits} credits — {moneyExact(perCredit)} a class
      </p>
      {note && <p className="mt-2.5 text-xs text-ink-faint">{note}</p>}
    </div>
  );
}
