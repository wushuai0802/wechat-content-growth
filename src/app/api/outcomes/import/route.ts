import { NextResponse } from "next/server";
import { deriveRiskEventsFromOutcomes, parseOutcomeImport } from "@/lib/outcome-importer";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { content?: string; outcomes?: unknown } | null;
    const content = body?.content ?? (body?.outcomes ? JSON.stringify(body.outcomes) : "");
    const outcomes = parseOutcomeImport(content);
    const riskEvents = deriveRiskEventsFromOutcomes(outcomes);
    const workspace = workspaceStore.recordArticleOutcomes(outcomes, undefined, riskEvents);
    return NextResponse.json({
      importedCount: outcomes.length,
      riskEventCount: riskEvents.length,
      strategyLearning: workspace.strategyLearning,
      workspace
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import outcomes" },
      { status: 400 }
    );
  }
}
