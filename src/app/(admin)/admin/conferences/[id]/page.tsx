import { notFound } from "next/navigation";
import { OpportunityDetail } from "@/components/admin/OpportunityPages";
import {
  getOpportunity,
  getSteps,
  getTravelGrants,
} from "@/lib/data/opportunities";

export default async function ConferenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opportunity = await getOpportunity(id);
  if (!opportunity) notFound();

  const [steps, travelGrants] = await Promise.all([
    getSteps(id),
    getTravelGrants(),
  ]);

  return (
    <OpportunityDetail
      opportunity={opportunity}
      steps={steps}
      travelGrants={travelGrants}
    />
  );
}
