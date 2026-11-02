import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/PageHeader";
import { MoveInForm } from "@/components/admin/MoveInForm";
import { getOccupancy } from "@/lib/data/maintenance";
import { getWaitingList } from "@/lib/data/rooms";

export const metadata = { title: "Moving somebody in" };

export default async function NewRenterPage() {
  await requireAdmin();

  const [occupancy, waiting] = await Promise.all([
    getOccupancy(),
    getWaitingList(),
  ]);

  // Only rooms with nobody in them. Offering an occupied one would be offering
  // a mistake.
  const empty = occupancy
    .filter((o) => o.unit.is_active && !o.occupant)
    .map((o) => o.unit);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="A new renter"
        title="Moving somebody in"
        description="Everything in one go, so nothing is left for a later that never comes."
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

      <MoveInForm units={empty} waiting={waiting} />
    </div>
  );
}
