import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ConditionItemEditor } from "@/components/admin/ConditionItemEditor";
import { ConditionCompare } from "@/components/admin/ConditionCompare";
import { SendInspectionButton } from "@/components/admin/SendInspectionButton";
import { Badge, Card, CardHeader } from "@/components/ui/Table";
import { getConditionPair, getConditionReport } from "@/lib/data/condition";
import { getContacts } from "@/lib/data/admin";
import { signedUrl } from "@/lib/maintenance-files";
import { areasOf } from "@/lib/condition";
import { dateShort } from "@/lib/format";

export const metadata = { title: "Inspection · Room Within" };

export default async function ConditionReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const found = await getConditionReport(id);
  if (!found) notFound();

  const { report, items } = found;

  const [contacts, pair] = await Promise.all([
    getContacts(),
    getConditionPair(report.lease_id),
  ]);

  const who = contacts.find((c) => c.id === report.contact_id)?.full_name;

  // Signed links expire, so they are made per request rather than stored.
  const photos = new Map(
    await Promise.all(
      items.map(
        async (i) => [i.id, await signedUrl(i.photo_path)] as [string, string | null],
      ),
    ),
  );

  const editable = report.status === "draft";
  const marked = items.filter((i) => i.rating !== null).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inspection"
        title={report.kind === "move_in" ? "Moving in" : "Moving out"}
        description={`${who ?? "A tenant"} · ${
          report.inspected_on ? dateShort(report.inspected_on) : "no date"
        } · ${marked} of ${items.length} marked`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/rentals"
          className="inline-flex items-center gap-1.5 text-sm text-bark underline underline-offset-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Rentals
        </Link>
        <StatusBadge status={report.status} present={report.tenant_present} />
      </div>

      {/* The comparison, for a move-out. Put above the form, because when
          there is a move-in report to compare against it is the thing she
          actually came to look at. */}
      {report.kind === "move_out" && (
        <ConditionCompare moveIn={pair.moveIn} moveOut={pair.moveOut} />
      )}

      <Card>
        <CardHeader
          title={editable ? "Mark each item" : "What was recorded"}
          description={
            editable
              ? "One tap each. Add a note wherever it isn't simply fine — a note now is worth an argument avoided later."
              : "This report has been sent, so it can't be changed. That's what makes it worth something."
          }
          tone={editable ? "default" : "plain"}
        />

        {areasOf(items).map((area) => (
          <div key={area}>
            <p className="eyebrow !text-[0.58rem] border-b border-tan/20 bg-parchment/50 px-5 py-2 text-bark">
              {area}
            </p>
            {items
              .filter((i) => i.area === area)
              .map((item) => (
                <ConditionItemEditor
                  key={item.id}
                  item={item}
                  readOnly={!editable}
                  photoUrl={photos.get(item.id) ?? null}
                />
              ))}
          </div>
        ))}
      </Card>

      {(report.landlord_note || report.tenant_note) && (
        <Card>
          <CardHeader title="Notes" tone="plain" />
          <div className="space-y-3 px-5 py-4 text-sm text-ink-soft">
            {report.landlord_note && (
              <p>
                <strong className="text-bark">You: </strong>
                {report.landlord_note}
              </p>
            )}
            {report.tenant_note && (
              <p>
                <strong className="text-bark">Them: </strong>
                {report.tenant_note}
              </p>
            )}
          </div>
        </Card>
      )}

      {editable && (
        <Card>
          <CardHeader
            title="Send it to them"
            description="They add their own view of each item from their own account, and sign it. Yours stops being editable at that point."
            tone="sage"
          />
          <div className="px-5 py-5">
            <SendInspectionButton
              reportId={report.id}
              unmarked={items.length - marked}
            />
          </div>
        </Card>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" aria-hidden />
        Alberta requires an inspection at the start and the end of a tenancy,
        and requires the tenant to be given the chance to be there. Their view
        of each item is recorded separately from yours and never written over
        it — where you disagreed, the report says so.
      </p>
    </div>
  );
}

function StatusBadge({
  status,
  present,
}: {
  status: string;
  present: boolean | null;
}) {
  const label =
    status === "draft"
      ? "Being filled in"
      : status === "awaiting_tenant"
        ? "With them"
        : status === "agreed"
          ? "Agreed and signed"
          : "Disagreed";

  const tone =
    status === "draft"
      ? "neutral"
      : status === "awaiting_tenant"
        ? "info"
        : status === "agreed"
          ? "good"
          : "bad";

  return (
    <span className="flex items-center gap-2">
      <Badge tone={tone as "neutral" | "info" | "good" | "bad"}>{label}</Badge>
      {present === false && <Badge tone="warn">they weren&rsquo;t there</Badge>}
    </span>
  );
}
