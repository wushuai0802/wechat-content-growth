import { NextResponse } from "next/server";
import type { HistoricalWechatObservation } from "@/lib/historical-outcome-reconciler";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      observations?: HistoricalWechatObservation[];
    } | null;
    const result = workspaceStore.reconcileHistoricalWechatObservations(body?.observations ?? []);
    return NextResponse.json({
      importedCount: result.outcomes.length,
      matchedArticleIds: result.matchedArticleIds,
      createdArticleIds: result.createdArticleIds,
      publicationAttemptIds: result.publicationAttemptIds,
      strategyLearning: result.workspace.strategyLearning,
      workspace: result.workspace
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reconcile historical outcomes" },
      { status: 400 }
    );
  }
}
