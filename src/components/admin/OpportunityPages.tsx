import Link from "next/link";
import {
  ArrowLeft,
  Coins,
  ExternalLink,
  FileDown,
  Inbox,
  Plane,
  Search,
} from "lucide-react";
import { AddPanel } from "@/components/admin/AddPanel";
import { PageHeader } from "@/components/admin/PageHeader";
import { RunButton } from "@/components/admin/RunButton";
import { Stat } from "@/components/admin/Stat";
import {
  AddOpportunityForm,
  ArchiveButton,
  Checklist,
  NotesBox,
  OpportunityListRow,
  StatusPicker,
  VerifyButton,
} from "@/components/admin/Opportunities";
import { Badge, Card, CardHeader, EmptyRow, Table, Th } from "@/components/ui/Table";
import { ButtonLink } from "@/components/ui/Button";
import {
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_TONES,
  amountRange,
  daysUntil,
  deadlineNote,
} from "@/lib/opportunities";
import { dateShort, money, moneyExact } from "@/lib/format";
import type {
  OpportunityKind,
  OpportunityRow,
  OpportunityStepRow,
  ResearchRunRow,
} from "@/lib/data/types";

/**
 * The shared shape of the grants and conferences pages.
 *
 * They are the same screen with different columns, so they are one component
 * rather than two that drift apart.
 */

type Result = { ok: boolean; message: string };

const WORDS = {
  grant: {
    eyebrow: "Money",
    title: "Grants",
    description:
      "Funding worth going after. The list refreshes itself every Monday morning.",
    searchLabel: "Look for grants now",
    addLabel: "Add a grant yourself",
    dateColumn: "Closes",
    middleColumn: "Amount",
  },
  conference: {
    eyebrow: "Out and about",
    title: "Conferences",
    description:
      "Conferences, trade shows and training worth the trip. Refreshed every Monday morning.",
    searchLabel: "Look for events now",
    addLabel: "Add an event yourself",
    dateColumn: "When",
    middleColumn: "Where",
  },
} as const;

export function OpportunityIndex({
  kind,
  opportunities,
  progress,
  runs,
  searchAction,
  apiConfigured,
}: {
  kind: OpportunityKind;
  opportunities: OpportunityRow[];
  progress: Map<string, { done: number; total: number }>;
  runs: ResearchRunRow[];
  searchAction: () => Promise<Result>;
  apiConfigured: boolean;
}) {
  const words = WORDS[kind];

  const live = opportunities.filter((o) => !o.archived_at);
  const archived = opportunities.filter((o) => o.archived_at);

  const unseen = live.filter((o) => o.status === "new");
  const pursuing = live.filter(
    (o) => o.status === "interested" || o.status === "applied",
  );
  const unchecked = live.filter((o) => !o.verified_at && o.source === "search");

  const soon = live.filter((o) => {
    const days = daysUntil(kind === "grant" ? o.deadline : o.starts_on);
    return days !== null && days >= 0 && days <= 30;
  });

  const lastRun = runs.find((r) => r.kind === kind);

  const weighted =
    kind === "grant"
      ? live
          .filter((o) => o.status !== "not_interested" && o.status !== "rejected")
          .reduce(
            (sum, o) =>
              sum +
              Math.round(((o.amount_max_cents ?? 0) * (o.probability ?? 0)) / 100),
            0,
          )
      : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={words.eyebrow}
        title={words.title}
        description={words.description}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="New to look at"
          value={String(unseen.length)}
          sub="Turned up, not yet decided"
          icon={Inbox}
          tone={unseen.length > 0 ? "good" : "default"}
        />
        <Stat
          label="Going after"
          value={String(pursuing.length)}
          sub="Interested or applied"
          icon={kind === "grant" ? Coins : Plane}
        />
        <Stat
          label="Closing within a month"
          value={String(soon.length)}
          sub={kind === "grant" ? "Deadlines coming up" : "Happening soon"}
          tone={soon.length > 0 ? "bad" : "default"}
        />
        {kind === "grant" && weighted > 0 ? (
          <Stat
            label="Pipeline worth"
            value={money(weighted)}
            sub="Each amount times its chance"
            icon={Coins}
          />
        ) : (
          <Stat
            label="Not checked yet"
            value={String(unchecked.length)}
            sub="Found automatically, unverified"
          />
        )}
      </div>

      {/* ---------- The weekly search ---------- */}
      <Card>
        <CardHeader
          title="The Monday search"
          tone="olive"
          description="Every Monday at six in the morning, the app reads the web looking for things worth your time, and adds anything new to the list below. It never changes or removes what's already here."
        />
        <div className="space-y-3 px-5 py-5">
          {apiConfigured ? (
            <RunButton
              action={searchAction}
              label={words.searchLabel}
              icon={<Search className="h-3.5 w-3.5" aria-hidden />}
            />
          ) : (
            <p className="rounded-[var(--radius-card)] bg-blush/50 px-4 py-3 text-sm text-burgundy">
              The weekly search isn&rsquo;t switched on yet — it needs a key
              that Tyler has to add. Everything else on this page works, and you
              can add things by hand below.
            </p>
          )}

          {lastRun && (
            <p className="text-xs text-ink-faint">
              Last looked {dateShort(lastRun.started_at)} —{" "}
              {lastRun.status === "ok"
                ? `read ${lastRun.found}, added ${lastRun.added}`
                : lastRun.status === "failed"
                  ? `didn't work: ${lastRun.message ?? "no reason given"}`
                  : lastRun.status}
            </p>
          )}

          <p className="text-xs leading-relaxed text-ink-faint">
            Everything it finds was read off a web page by a machine. Dates and
            amounts are sometimes wrong. Open the real page and check before you
            spend an afternoon on any of it.
          </p>
        </div>
      </Card>

      {/* ---------- The lists, one per state ---------- */}
      {STATUS_ORDER.map((status) => {
        const rows = live.filter((o) => o.status === status);
        if (rows.length === 0 && status !== "new") return null;

        return (
          <Card key={status}>
            <CardHeader
              title={STATUS_LABELS[status]}
              tone={status === "new" ? "default" : "plain"}
              description={
                status === "new"
                  ? "Found but not yet decided on. Open one to read it properly."
                  : undefined
              }
              action={<Badge tone={STATUS_TONES[status]}>{rows.length}</Badge>}
            />
            <OpportunityTable kind={kind} rows={rows} progress={progress} />
          </Card>
        );
      })}

      <AddPanel label={words.addLabel} title={words.addLabel}>
        <AddOpportunityForm kind={kind} />
      </AddPanel>

      {archived.length > 0 && (
        <Card>
          <CardHeader
            title="Put away"
            tone="plain"
            description="Nothing is deleted. Open one to bring it back."
            action={<Badge tone="neutral">{archived.length}</Badge>}
          />
          <OpportunityTable kind={kind} rows={archived} progress={progress} />
        </Card>
      )}
    </div>
  );
}

function OpportunityTable({
  kind,
  rows,
  progress,
}: {
  kind: OpportunityKind;
  rows: OpportunityRow[];
  progress: Map<string, { done: number; total: number }>;
}) {
  const words = WORDS[kind];

  return (
    <Table>
      <thead>
        <tr>
          <Th>What</Th>
          <Th align={kind === "grant" ? "right" : "left"}>
            {words.middleColumn}
          </Th>
          <Th>{words.dateColumn}</Th>
          {kind === "grant" && <Th align="right">Chance</Th>}
          <Th align="right">Steps</Th>
          <Th align="right">Where it stands</Th>
          <Th align="right" />
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={kind === "grant" ? 7 : 6}>
            Nothing here yet. The Monday search will fill this in, or add
            something yourself below.
          </EmptyRow>
        ) : (
          rows.map((o) => (
            <OpportunityListRow
              key={o.id}
              opportunity={o}
              progress={progress.get(o.id)}
            />
          ))
        )}
      </tbody>
    </Table>
  );
}

/* -------------------------------- Detail ---------------------------------- */

export function OpportunityDetail({
  opportunity: o,
  steps,
  travelGrants,
}: {
  opportunity: OpportunityRow;
  steps: OpportunityStepRow[];
  /** Grants that might pay for the trip. Conferences only. */
  travelGrants?: OpportunityRow[];
}) {
  const isGrant = o.kind === "grant";
  const back = isGrant ? "/admin/grants" : "/admin/conferences";

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={back}
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-olive"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to {isGrant ? "grants" : "conferences"}
        </Link>
      </div>

      <PageHeader
        eyebrow={o.organisation ?? (isGrant ? "Grant" : "Event")}
        title={o.title}
        description={o.summary ?? undefined}
        action={
          o.url ? (
            <ButtonLink
              href={o.url}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="secondary"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Their page
            </ButtonLink>
          ) : undefined
        }
      />

      {/* ---------- The facts ---------- */}
      <Card>
        <CardHeader title="The details" />
        <dl className="grid gap-x-8 gap-y-4 px-5 py-5 sm:grid-cols-2">
          {isGrant ? (
            <>
              <Fact label="How much" value={amountRange(o, moneyExact) ?? "Not stated"} />
              <Fact
                label="Closing date"
                value={
                  o.deadline
                    ? dateShort(o.deadline)
                    : (o.deadline_note ?? "None given")
                }
                note={o.deadline ? deadlineNote(o.deadline) : undefined}
              />
              {o.probability != null && (
                <Fact
                  label="Chance of getting it"
                  value={`${o.probability}%`}
                  note={
                    o.amount_max_cents != null
                      ? `Worth about ${money(Math.round((o.amount_max_cents * o.probability) / 100))} weighted`
                      : undefined
                  }
                />
              )}
              {o.owner && <Fact label="Whose job" value={o.owner} />}
              <Fact
                label="Who may apply"
                value={o.eligibility ?? "Not stated on the page"}
                wide
              />
              {o.covers_travel && (
                <Fact
                  label="Travel"
                  value="This one can pay for travel or training"
                  wide
                />
              )}
            </>
          ) : (
            <>
              <Fact
                label="When"
                value={
                  o.starts_on
                    ? o.ends_on && o.ends_on !== o.starts_on
                      ? `${dateShort(o.starts_on)} – ${dateShort(o.ends_on)}`
                      : dateShort(o.starts_on)
                    : "Not stated"
                }
                note={deadlineNote(o.starts_on)}
              />
              <Fact
                label="Where"
                value={o.location ?? (o.is_online ? "Online" : "Not stated")}
              />
              <Fact
                label="Registration"
                value={o.cost_cents != null ? moneyExact(o.cost_cents) : "Not published"}
                note={o.cost_note ?? undefined}
              />
            </>
          )}

          {o.why_relevant && (
            <Fact label="Why it was flagged" value={o.why_relevant} wide />
          )}

          {o.next_action && (
            <Fact label="The next thing to do" value={o.next_action} wide />
          )}
        </dl>

        <div className="border-t border-tan/20 bg-parchment/40 px-5 py-5">
          <VerifyButton opportunity={o} />
        </div>
      </Card>

      {/* ---------- Where it stands ---------- */}
      <Card>
        <CardHeader
          title="Where it stands"
          description="Moving it changes which list it appears in."
        />
        <div className="px-5 py-5">
          <StatusPicker opportunity={o} />
        </div>
        <div className="border-t border-tan/20 px-5 py-4">
          <ArchiveButton opportunity={o} />
        </div>
      </Card>

      {/* ---------- The checklist ---------- */}
      <Card>
        <CardHeader
          title={isGrant ? "How to apply" : "Getting there"}
          tone="olive"
          description="One step at a time. Tick each off as you go — nothing here needs doing all at once."
        />
        <Checklist steps={steps} kind={o.kind} />
      </Card>

      {/* ---------- The handoff ---------- */}
      <Card>
        <CardHeader
          title="Hand this to your assistant"
          description="A single document with everything above in it — the building, this opportunity, and where you've got to. Give it to whichever AI you use and it starts out knowing all of it, instead of you explaining from scratch."
        />
        <div className="space-y-3 px-5 py-5">
          <ButtonLink href={`/admin/grants/${o.id}/handoff`} size="sm">
            <FileDown className="h-4 w-4" aria-hidden />
            Download the briefing
          </ButtonLink>
          <p className="text-xs leading-relaxed text-ink-faint">
            {o.verified_at
              ? "It notes that you've checked these details against their page."
              : "It tells your assistant that these details haven't been checked yet, so it won't build a plan on a date that might be wrong."}
          </p>
        </div>
      </Card>

      {/* ---------- Money to get there ---------- */}
      {travelGrants && travelGrants.length > 0 && (
        <Card>
          <CardHeader
            title="Money that might pay for this"
            tone="default"
            description="Grants on your list that can cover travel or training."
          />
          <ul className="divide-y divide-tan/20">
            {travelGrants.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/grants/${g.id}`}
                    className="font-medium text-olive-deep hover:underline"
                  >
                    {g.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {[
                      g.organisation,
                      amountRange(g, money),
                      g.deadline ? deadlineNote(g.deadline) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Badge tone={STATUS_TONES[g.status]}>
                  {STATUS_LABELS[g.status]}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="border-t border-tan/20 px-5 py-3.5 text-xs text-ink-faint">
            Apply before you book if you can — most of these won&rsquo;t pay
            back something already spent.
          </p>
        </Card>
      )}

      {/* ---------- Notes ---------- */}
      <Card>
        <CardHeader title="Your notes" tone="plain" />
        <div className="px-5 py-5">
          <NotesBox opportunity={o} />
        </div>
      </Card>
    </div>
  );
}

function Fact({
  label,
  value,
  note,
  wide,
}: {
  label: string;
  value: string;
  note?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="eyebrow !text-[0.6rem] text-bark">{label}</dt>
      <dd className="mt-1 leading-relaxed text-ink">{value}</dd>
      {note && <p className="mt-0.5 text-xs text-ink-faint">{note}</p>}
    </div>
  );
}
