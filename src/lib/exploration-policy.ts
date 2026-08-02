import { getReliableOutcomes } from "./real-data-quality";
import type { WorkspaceData } from "./workspace-store";

export type ContentLearningPhase = "explore" | "mixed" | "optimize";

export interface ExplorationPolicy {
  phase: ContentLearningPhase;
  reliableOutcomeCount: number;
  richOutcomeCount: number;
  coveredCategoryCount: number;
  exploreRatio: number;
  historyWeight: number;
  forecastWeight: number;
  realtimeWeight: number;
  maxTopicsPerTrend: number;
  reason: string;
}

export const EXPLORATION_THRESHOLDS = {
  mixedOutcomeCount: 30,
  optimizeOutcomeCount: 100,
  optimizeRichOutcomeCount: 30,
  optimizeCategoryCount: 5,
  optimizeSamplesPerCategory: 10
} as const;

function hasRichAttribution(observedMetrics: string[] | undefined): boolean {
  if (!observedMetrics) return false;
  return observedMetrics.some((metric) => [
    "views",
    "likes",
    "inLikes",
    "comments",
    "adImpressions",
    "adClicks",
    "shares",
    "favorites",
    "newFollowers",
    "unfollows"
  ].includes(metric));
}

export function resolveExplorationPolicy(workspace: WorkspaceData): ExplorationPolicy {
  const outcomes = getReliableOutcomes(workspace.articleOutcomes ?? []);
  const articleById = new Map(workspace.articles.map((article) => [article.id, article]));
  const topicById = new Map(workspace.topics.map((topic) => [topic.id, topic]));
  const categorySamples = new Map<string, number>();

  for (const outcome of outcomes) {
    const article = articleById.get(outcome.articleId);
    const category = article ? topicById.get(article.topicId)?.category : undefined;
    if (!category) continue;
    categorySamples.set(category, (categorySamples.get(category) ?? 0) + 1);
  }

  const reliableOutcomeCount = outcomes.length;
  const richOutcomeCount = outcomes.filter((outcome) =>
    hasRichAttribution(outcome.observedMetrics)
    || [outcome.adRevenue, outcome.affiliateRevenue, outcome.leadRevenue, outcome.followerValueRevenue]
      .some((value) => (value ?? 0) > 0)
  ).length;
  const coveredCategoryCount = [...categorySamples.values()].filter(
    (count) => count >= EXPLORATION_THRESHOLDS.optimizeSamplesPerCategory
  ).length;

  if (reliableOutcomeCount < EXPLORATION_THRESHOLDS.mixedOutcomeCount) {
    return {
      phase: "explore",
      reliableOutcomeCount,
      richOutcomeCount,
      coveredCategoryCount,
      exploreRatio: 1,
      historyWeight: 0,
      forecastWeight: 0.35,
      realtimeWeight: 1,
      maxTopicsPerTrend: 1,
      reason: `Only ${reliableOutcomeCount} reliable outcomes; prioritize fresh hotspot coverage until at least ${EXPLORATION_THRESHOLDS.mixedOutcomeCount}.`
    };
  }

  const optimizationReady = reliableOutcomeCount >= EXPLORATION_THRESHOLDS.optimizeOutcomeCount
    && richOutcomeCount >= EXPLORATION_THRESHOLDS.optimizeRichOutcomeCount
    && coveredCategoryCount >= EXPLORATION_THRESHOLDS.optimizeCategoryCount;
  if (!optimizationReady) {
    return {
      phase: "mixed",
      reliableOutcomeCount,
      richOutcomeCount,
      coveredCategoryCount,
      exploreRatio: 0.7,
      historyWeight: 0.35,
      forecastWeight: 0.65,
      realtimeWeight: 0.65,
      maxTopicsPerTrend: 1,
      reason: `Use limited historical guidance while collecting ${EXPLORATION_THRESHOLDS.optimizeOutcomeCount} outcomes, ${EXPLORATION_THRESHOLDS.optimizeRichOutcomeCount} rich outcomes, and ${EXPLORATION_THRESHOLDS.optimizeCategoryCount} covered categories.`
    };
  }

  return {
    phase: "optimize",
    reliableOutcomeCount,
    richOutcomeCount,
    coveredCategoryCount,
    exploreRatio: 0.3,
    historyWeight: 1,
    forecastWeight: 1,
    realtimeWeight: 0.25,
    maxTopicsPerTrend: 2,
    reason: "Outcome volume and attribution coverage are sufficient for profit-led optimization while retaining 30% exploration."
  };
}
