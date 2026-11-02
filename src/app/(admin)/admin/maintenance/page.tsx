import { CheckCircle2, Inbox, Receipt, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Stat } from "@/components/admin/Stat";
import { MaintenanceItem } from "@/components/admin/MaintenanceAdmin";
import { Badge, Card, CardHeader } from "@/components/ui/Table";
import { getMaintenance, getOccupancy } from "@/lib/data/maintenance";
import { signedUrl } from "@/lib/maintenance-files";
import { money } from "@/lib/format";

export const metadata = { title: "Repairs" };

/**
 * Everything renters have reported.
 *
 * Ordered so the things that need her attention are at the top: anything new,
 * anything urgent, then anything fixed whose cost hasn't been recorded — the
 * figure that is easy to lose and annoying to reconstruct at year end.
 */
export default async function MaintenancePage() {
  const [requests, occupancy] = await Promise.all([
    getMaintenance(),
    getOccupancy(),
  ]);

  const unitName = new Map(occupancy.map((o) => [o.unit.id, o.unit.name]));

  // Signed links are generated here, per request, after the admin check above.
  const withLinks = await Promise.all(
    requests.map(async (r) => ({
      request: r,
      photoUrl: await signedUrl(r.photo_path),
      receiptUrl: await signedUrl(r.receipt_path),
    })),
  );

  const open = withLinks.filter(
    (r) => r.request.status !== "fixed" && r.request.status !== "declined",
  );
  const urgent = open.filter((r) => r.request.urgency === "urgent");
  const awaitingCost = withLinks.filter(
    (r) => r.request.status === "fixed" && r.request.cost_cents == null,
  );
  const done = withLinks.filter(
    (r) =>
      (r.request.status === "fixed" && r.request.cost_cents != null) ||
      r.request.status === "declined",
  );

  const spent = withLinks.reduce(
    (sum, r) => sum + (r.request.cost_cents ?? 0),
    0,
  );

  const section = (
    title: string,
    rows: typeof withLinks,
    tone: "default" | "warn" | "olive" | "plain",
    description?: string,
  ) =>
    rows.length === 0 ? null : (
      <Card key={title}>
        <CardHeader
          title={title}
          tone={tone === "warn" ? "warn" : tone === "olive" ? "olive" : tone}
          description={description}
          action={<Badge tone="neutral">{rows.length}</Badge>}
        />
        <ul>
          {rows.map((r) => (
            <MaintenanceItem
              key={r.request.id}
              request={r.request}
              unitName={unitName.get(r.request.unit_id ?? "") ?? null}
              photoUrl={r.photoUrl}
              receiptUrl={r.receiptUrl}
            />
          ))}
        </ul>
      </Card>
    );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="The building"
        title="Repairs"
        description="What renters have reported, where each one is up to, and what it cost to put right."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Waiting on you"
          value={String(open.length)}
          sub="Not yet fixed"
          icon={Inbox}
          tone={open.length > 0 ? "bad" : "good"}
        />
        <Stat
          label="Urgent"
          value={String(urgent.length)}
          sub="Water, heat, safety or security"
          icon={TriangleAlert}
          tone={urgent.length > 0 ? "bad" : "default"}
        />
        <Stat
          label="Cost not recorded"
          value={String(awaitingCost.length)}
          sub="Fixed, but no figure yet"
          icon={Receipt}
          tone={awaitingCost.length > 0 ? "bad" : "default"}
        />
        <Stat
          label="Spent on repairs"
          value={money(spent)}
          sub="Everything recorded so far"
          icon={CheckCircle2}
        />
      </div>

      {open.length === 0 && awaitingCost.length === 0 && (
        <Card>
          <p className="px-5 py-12 text-center text-sm text-ink-faint">
            Nothing outstanding. Renters report things from their own page and
            they land here.
          </p>
        </Card>
      )}

      {section(
        "Needs a cost",
        awaitingCost,
        "warn",
        "Fixed, but nothing recorded yet. Easier now than at year end.",
      )}
      {section(
        "Waiting on you",
        open,
        "olive",
        "Marking one fixed emails the renter straight away.",
      )}
      {section("Done", done, "plain")}
    </div>
  );
}
