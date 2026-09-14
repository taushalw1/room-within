import { requireAdmin } from "@/lib/auth";
import { getOpportunity, getSteps } from "@/lib/data/opportunities";
import { buildHandoffPdf, handoffFilename } from "@/lib/handoff";

/**
 * The briefing PDF for a grant or a conference.
 *
 * Behind requireAdmin like every other admin route — these carry her notes and
 * how far along she is, which is nobody else's business.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();

  const { id } = await params;
  const opportunity = await getOpportunity(id);
  if (!opportunity) return new Response("Not found", { status: 404 });

  const steps = await getSteps(id);
  const pdf = await buildHandoffPdf(opportunity, steps);

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${handoffFilename(opportunity)}"`,
      "Cache-Control": "no-store",
    },
  });
}
