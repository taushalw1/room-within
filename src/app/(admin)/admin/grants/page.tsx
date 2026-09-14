import { OpportunityIndex } from "@/components/admin/OpportunityPages";
import { searchGrantsNow } from "./actions";
import {
  getOpportunities,
  getResearchRuns,
  getStepCounts,
} from "@/lib/data/opportunities";

export const metadata = { title: "Grants" };

export default async function GrantsPage() {
  const [opportunities, progress, runs] = await Promise.all([
    getOpportunities("grant"),
    getStepCounts("grant"),
    getResearchRuns(),
  ]);

  return (
    <OpportunityIndex
      kind="grant"
      opportunities={opportunities}
      progress={progress}
      runs={runs}
      searchAction={searchGrantsNow}
      apiConfigured={Boolean(process.env.ANTHROPIC_API_KEY)}
    />
  );
}
