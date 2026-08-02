import { describe, expect, it } from "vitest";
import type { ArticleOutcome, ArticlePackage, TopicCandidate } from "./domain";
import { resolveExplorationPolicy } from "./exploration-policy";
import { createEmptyWorkspace } from "./workspace-store";

function topic(index: number, category: string): TopicCandidate {
  return {
    id: `topic-${index}`,
    title: `Topic ${index}`,
    source: "hot",
    category,
    audience: "general readers",
    angle: "fresh hotspot",
    status: "approved",
    expectedRevenue: 0,
    timeliness: 80,
    accountFit: 70,
    historicalSimilarity: 0,
    risk: 5,
    estimatedCost: 0,
    saturation: 20,
    createdAt: "2026-07-13T00:00:00.000Z"
  };
}

function article(index: number, topicId: string): ArticlePackage {
  return {
    id: `article-${index}`,
    topicId,
    title: `Article ${index}`,
    summary: "Historical sample",
    status: "published",
    contentPath: "",
    coverPath: "",
    qualityScore: 75,
    riskScore: 0,
    estimatedCost: 0,
    estimatedRevenue: 0,
    createdAt: "2026-07-13T00:00:00.000Z"
  };
}

function outcome(index: number, observedMetrics: ArticleOutcome["observedMetrics"]): ArticleOutcome {
  return {
    id: `outcome-${index}`,
    articleId: `article-${index}`,
    reads: index + 1,
    shares: 0,
    favorites: 0,
    newFollowers: 0,
    unfollows: 0,
    revenue: 0,
    cost: 0,
    riskScore: 0,
    observedMetrics,
    recordedAt: "2026-07-13T12:00:00.000Z"
  };
}

function workspaceWithSamples(count: number, richCount: number, categoryCount: number) {
  const workspace = createEmptyWorkspace(new Date("2026-07-13T12:00:00.000Z"));
  workspace.topics = Array.from({ length: count }, (_, index) => topic(index, `category-${index % categoryCount}`));
  workspace.articles = workspace.topics.map((item, index) => article(index, item.id));
  workspace.articleOutcomes = Array.from({ length: count }, (_, index) =>
    outcome(index, index < richCount ? ["reads", "shares", "revenue"] : ["reads", "revenue"])
  );
  return workspace;
}

describe("resolveExplorationPolicy", () => {
  it("keeps a ten-result workspace in realtime-first exploration", () => {
    const policy = resolveExplorationPolicy(workspaceWithSamples(10, 0, 10));

    expect(policy).toMatchObject({
      phase: "explore",
      reliableOutcomeCount: 10,
      exploreRatio: 1,
      historyWeight: 0,
      realtimeWeight: 1
    });
  });

  it("moves to a mixed phase after thirty outcomes without overfitting", () => {
    const policy = resolveExplorationPolicy(workspaceWithSamples(30, 5, 6));

    expect(policy).toMatchObject({
      phase: "mixed",
      exploreRatio: 0.7,
      historyWeight: 0.35
    });
  });

  it("requires both volume and rich cross-category attribution before optimization", () => {
    const policy = resolveExplorationPolicy(workspaceWithSamples(100, 30, 5));

    expect(policy).toMatchObject({
      phase: "optimize",
      reliableOutcomeCount: 100,
      richOutcomeCount: 30,
      coveredCategoryCount: 5,
      exploreRatio: 0.3,
      historyWeight: 1
    });
  });
});
