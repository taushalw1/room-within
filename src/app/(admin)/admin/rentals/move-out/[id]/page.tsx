import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardHeader } from "@/components/ui/Table";
import {
  DepositLedger,
  InspectionForm,
  ItemVerdict,
  SettleButton,
} from "@/components/admin/MoveOutAdmin";
import {
  getDepositEntries,
  getMoveOut,
  getSignatureEvent,
} from "@/lib/data/move-out";
import { getAllLeases, getContactNameMap, getUnits } from "@/lib/data/admin";
import { signedUrl } from "@/lib/maintenance-files";
import { signatureUrl } from "@/lib/signature-files";
import { dateShort, moneyExact } from "@/lib/format";

export const metadata = { title: "Ending a tenancy" };

const STATUS_WORDS: Record<string, string> = {
  open: "They're working through it",
  tenant_done: "Signed by them — ready for the walk-through",
  inspected: "Walk-through done",
  settled: "Settled",
};

export default async function MoveOutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const found = await getMoveOut(id);
  if (!found) notFound();

  const { moveOut, items } = found;

  const [names, units, entries, signature, leases] = await Promise.all([
    getContactNameMap(),
    getUnits(),
    getDepositEntries(moveOut.lease_id),
    getSignatureEvent(moveOut.tenant_signature_event),
    getAllLeases(),
  ]);

  const lease = leases.find((l) => l.id === moveOut.lease_id) ?? null;

  const evidenceUrls = await Promise.all(
    entries.map((e) => signedUrl(e.evidence_path)),
  );
  const signatureImage = signature
    ? await signatureUrl(signature.signature_path)
    : null;

  const who = moveOut.contact_id
    ? (names.get(moveOut.contact_id)?.full_name ?? null)
    : null;
  const unit = units.find((u) => u.id === moveOut.unit_id);

  const charges = items.reduce((total, i) => total + (i.charge_cents ?? 0), 0);
  const notTicked = items.filter((i) => !i.done_by_tenant).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ending a tenancy"
        title={who ?? "A tenancy"}
        description={`${unit?.name ?? "Unit"} · leaving ${dateShort(moveOut.leaving_on)} · ${STATUS_WORDS[moveOut.status] ?? moveOut.status}`}
        action={
          <Link
            href="/admin/rentals"
            className="inline-flex items-center gap-2 rounded-full border border-cream/30 px-4 py-2 text-sm text-cream"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Rentals
          </Link>
        }
      />

      {/* ---------- What was written down at the start ---------- */}
      {lease && (lease.keys_issued != null || lease.vehicle || lease.other_occupants || lease.emergency_phone) && (
        <Card>
          <CardHeader
            title="From when they moved in"
            description="Worth having in front of you at the walk-through."
          />
          <dl className="grid gap-x-8 gap-y-3 px-5 py-5 text-sm sm:grid-cols-2">
            {lease.keys_issued != null && (
              <div>
                <dt className="eyebrow !text-[0.58rem] text-bark">Keys handed over</dt>
                <dd className="text-ink">
                  {lease.keys_issued} — count them back before you settle.
                </dd>
              </div>
            )}
            {lease.vehicle && (
              <div>
                <dt className="eyebrow !text-[0.58rem] text-bark">Vehicle</dt>
                <dd className="text-ink">
                  {lease.vehicle}
                  {lease.parking_stall ? ` · stall ${lease.parking_stall}` : ""}
                </dd>
              </div>
            )}
            {lease.other_occupants && (
              <div>
                <dt className="eyebrow !text-[0.58rem] text-bark">Who else was there</dt>
                <dd className="text-ink">{lease.other_occupants}</dd>
              </div>
            )}
            {lease.emergency_phone && (
              <div>
                <dt className="eyebrow !text-[0.58rem] text-bark">Emergency contact</dt>
                <dd className="text-ink">
                  {lease.emergency_name ?? "Contact"} {lease.emergency_phone}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {/* ---------- What they signed ---------- */}
      <Card>
        <CardHeader
          title="Their declaration"
          description="Sealed when they signed. It cannot be altered afterwards — not from this page, not from the database."
        />
        {signature ? (
          <div className="space-y-4 px-5 py-5">
            <div className="flex flex-wrap items-center gap-6">
              {signatureImage && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={signatureImage}
                  alt={`${signature.signer_name}'s signature`}
                  className="h-16 rounded-[var(--radius-card)] border border-tan/30 bg-cream p-2"
                />
              )}
              <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="eyebrow !text-[0.58rem] text-bark">Signed by</dt>
                  <dd className="text-ink">
                    {signature.signer_name}{" "}
                    <span className="text-ink-faint">({signature.signer_email})</span>
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow !text-[0.58rem] text-bark">At</dt>
                  <dd className="text-ink">
                    {new Date(signature.signed_at).toLocaleString("en-CA")}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow !text-[0.58rem] text-bark">From</dt>
                  <dd className="break-all text-ink-soft">
                    {signature.ip ?? "address not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow !text-[0.58rem] text-bark">Reference</dt>
                  <dd className="font-mono text-ink">{signature.verify_code}</dd>
                </div>
                <div>
                  <dt className="eyebrow !text-[0.58rem] text-bark">Signature</dt>
                  <dd className="text-ink">
                    {signature.signature_source === "uploaded"
                      ? "Uploaded as a picture"
                      : "Drawn on their own device"}
                  </dd>
                </div>
              </dl>
            </div>

            <p className="break-all text-xs leading-relaxed text-ink-faint">
              {signature.user_agent ?? "device not recorded"}
            </p>

            <details className="rounded-[var(--radius-card)] border border-tan/30 bg-parchment">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
                The exact words they signed
              </summary>
              <pre className="overflow-x-auto whitespace-pre-wrap px-4 pb-4 font-body text-[0.8rem] leading-relaxed text-ink-soft">
                {signature.document_text}
              </pre>
            </details>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" aria-hidden />
              Fingerprint {signature.document_hash.slice(0, 16)}… Every signing
              is chained to the one before it, so a record removed from the
              middle shows up.
            </p>
          </div>
        ) : (
          <p className="px-5 py-5 text-sm text-ink-soft">
            Not signed yet. They can sign it from their account once they&rsquo;ve
            been through the list.
          </p>
        )}
      </Card>

      {/* ---------- The walk-through ---------- */}
      <Card>
        <CardHeader
          title="Line by line"
          description={`${items.length - notTicked} of ${items.length} ticked by them${charges > 0 ? ` · ${moneyExact(charges)} proposed in charges` : ""}`}
        />
        <ul className="divide-y divide-tan/20">
          {items.map((item) => (
            <ItemVerdict key={item.id} item={item} />
          ))}
        </ul>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader title="The walk-through" />
          <InspectionForm moveOut={moveOut} />
        </Card>

        <Card>
          <CardHeader
            title="The deposit"
            description="Every movement, so the balance is always the sum of what actually happened."
          />
          <DepositLedger
            entries={entries}
            leaseId={moveOut.lease_id}
            moveOutId={moveOut.id}
            evidenceUrls={evidenceUrls}
          />
        </Card>
      </div>

      {moveOut.forwarding_address || moveOut.forwarding_email ? (
        <Card>
          <CardHeader title="Where to send things" />
          <div className="space-y-2 px-5 py-5 text-[0.95rem] text-ink-soft">
            {moveOut.forwarding_address && (
              <p className="whitespace-pre-wrap">{moveOut.forwarding_address}</p>
            )}
            {moveOut.forwarding_email && <p>{moveOut.forwarding_email}</p>}
          </div>
        </Card>
      ) : null}

      {moveOut.status !== "settled" && (
        <Card>
          <CardHeader
            title="Finishing up"
            description="Only once the deposit balance is nil — everything either deducted with a reason, or given back."
          />
          <SettleButton moveOutId={moveOut.id} />
        </Card>
      )}
    </div>
  );
}
