import { OpportunityIndex } from "@/components/admin/OpportunityPages";
import { searchConferencesNow } from "../grants/actions";
import {
  getOpportunities,
  getResearchRuns,
  getStepCounts,
} from "@/lib/data/opportunities";

export const metadata = { title: "Conferences" };

export default async function ConferencesPage() {
  const [opportunities, progress, runs] = await Promise.all([
    getOpportunities("conference"),
    getStepCounts("conference"),
    getResearchRuns(),
  ]);

  return (
    <OpportunityIndex
      kind="conference"
      opportunities={opportunities}
      progress={progress}
      runs={runs}
      searchAction={searchConferencesNow}
      apiConfigured={Boolean(process.env.ANTHROPIC_API_KEY)}
    />
  );
}
