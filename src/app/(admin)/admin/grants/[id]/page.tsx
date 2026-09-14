import { notFound } from "next/navigation";
import { OpportunityDetail } from "@/components/admin/OpportunityPages";
import { getOpportunity, getSteps } from "@/lib/data/opportunities";

export default async function GrantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opportunity = await getOpportunity(id);
  if (!opportunity) notFound();

  const steps = await getSteps(id);

  return <OpportunityDetail opportunity={opportunity} steps={steps} />;
}
