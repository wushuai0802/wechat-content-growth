import { NextResponse } from "next/server";
import { generateCpaDraftMarkdown, getLocalCpaConfig } from "@/lib/local-cpa-client";
import { workspaceStore } from "@/lib/workspace-store";
import { getTopicEvidenceBlockers } from "@/lib/topic-evidence";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ topicId: string }> }
) {
  const { topicId } = await context.params;
  const workspace = workspaceStore.getWorkspace();
  const topic = workspace.topics.find((item) => item.id === topicId);

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const evidenceBlockers = getTopicEvidenceBlockers(topic);
  if (evidenceBlockers.length > 0) {
    return NextResponse.json({
      error: "Topic evidence is not ready",
      blockers: evidenceBlockers,
      evidencePlan: topic.opportunityProfile?.evidencePlan ?? []
    }, { status: 409 });
  }

  const cpaConfig = getLocalCpaConfig();
  if (!cpaConfig) {
    return NextResponse.json(workspaceStore.generateDraftFromTopic(topicId));
  }

  try {
    const signalId = topic.id.replace(/^topic-/, "").replace(/-(?:chase|manufacture|convert)$/, "");
    const trendContext = workspace.trendSignals.find((signal) => signal.id === signalId);
    const markdown = await generateCpaDraftMarkdown(topic, { ...cpaConfig, trendContext });
    return NextResponse.json(workspaceStore.generateDraftFromTopic(topicId, { markdownOverride: markdown }));
  } catch (error) {
    const updated = workspaceStore.generateDraftFromTopic(topicId);
    return NextResponse.json({
      ...updated,
      warning: error instanceof Error ? error.message : "CPA generation failed; used mock fallback"
    });
  }
}
