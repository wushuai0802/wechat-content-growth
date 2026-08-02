import { analyzeOperationalLearning } from "./operational-learning";
import { resolveExplorationPolicy, type ContentLearningPhase } from "./exploration-policy";
import { rankTopicsForProfit } from "./profit-optimizer";
import { getReliableRewards } from "./real-data-quality";
import type { WorkspaceData } from "./workspace-store";

export interface DailyArticleLimitDecision {
  shouldRun: boolean;
  recommendedArticleLimit: number;
  reason: string;
  constraints: string[];
  signals: {
    pendingWechatDrafts: number;
    affordableCandidates: number;
    recentFailureCount: number;
    recentAverageReward: number;
    dailyCostCapCny: number;
    learningPhase: ContentLearningPhase;
    reliableOutcomeCount: number;
    richOutcomeCount: number;
    effectiveExploreRatio: number;
    historyWeight: number;
  };
}

export interface DailyArticleLimitDecisionInput {
  workspace: WorkspaceData;
  maxArticleLimit?: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function decideDailyArticleLimit(input: DailyArticleLimitDecisionInput): DailyArticleLimitDecision {
  const { workspace } = input;
  const maxArticleLimit = Math.max(1, input.maxArticleLimit ?? 5);
  const config = workspace.autoLoopConfig;
  const constraints: string[] = [];
  const explorationPolicy = resolveExplorationPolicy(workspace);

  const operationalLearning = analyzeOperationalLearning(workspace);
  const blockingConstraints = operationalLearning.blockers;
  const pendingWechatDrafts = workspace.articles.filter((article) =>
    article.status === "wechat_draft" || article.status === "publish_submitted" || article.status === "needs_reconcile"
  ).length;
  const recentRuns = [...workspace.experimentRuns]
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .slice(0, 3);
  const recentFailureCount = recentRuns.reduce((sum, run) => sum + run.failureCount + (run.status === "failed" ? 1 : 0), 0);
  const recentRewards = getReliableRewards(
    workspace.strategyLearning.articleRewards ?? [],
    workspace.articleOutcomes ?? []
  ).slice(0, 5).map((reward) => reward.reward);
  const recentAverageReward = round(average(recentRewards));
  const affordableCandidates = rankTopicsForProfit(
    workspace.topics,
    { ...config, dailyArticleLimit: maxArticleLimit },
    workspace.strategyLearning,
    { policy: explorationPolicy }
  ).length;

  const signals = {
    pendingWechatDrafts,
    affordableCandidates,
    recentFailureCount,
    recentAverageReward,
    dailyCostCapCny: config.dailyCostCapCny,
    learningPhase: explorationPolicy.phase,
    reliableOutcomeCount: explorationPolicy.reliableOutcomeCount,
    richOutcomeCount: explorationPolicy.richOutcomeCount,
    effectiveExploreRatio: explorationPolicy.exploreRatio,
    historyWeight: explorationPolicy.historyWeight
  };

  if (!config.enabled) {
    constraints.push("auto loop disabled");
    return {
      shouldRun: false,
      recommendedArticleLimit: 0,
      reason: "AutoProfit loop is disabled.",
      constraints,
      signals
    };
  }

  if (blockingConstraints.length > 0) {
    return {
      shouldRun: false,
      recommendedArticleLimit: 0,
      reason: `Operational blockers require attention before generating more drafts: ${blockingConstraints.join("; ")}`,
      constraints: [...constraints, ...blockingConstraints],
      signals
    };
  }

  if (config.dailyCostCapCny <= 0) {
    constraints.push("daily cost cap is zero or negative");
    return {
      shouldRun: false,
      recommendedArticleLimit: 0,
      reason: "Daily cost cap does not allow a real experiment run.",
      constraints,
      signals
    };
  }

  if (affordableCandidates <= 0) {
    constraints.push("no affordable candidates fit profit, risk, and cost limits");
    return {
      shouldRun: false,
      recommendedArticleLimit: 0,
      reason: "No candidate topic currently fits the AutoProfit constraints.",
      constraints,
      signals
    };
  }

  let target = Math.max(1, Math.min(config.dailyArticleLimit, maxArticleLimit));

  if (recentFailureCount >= config.consecutiveFailureLimit) {
    target = 1;
    constraints.push(`reduced because recent failures reached ${recentFailureCount}`);
  } else if (recentFailureCount > 0) {
    target = Math.max(1, target - 1);
    constraints.push(`reduced because recent failures reached ${recentFailureCount}`);
  }

  if (recentRewards.length >= 3 && recentAverageReward >= 300 && recentFailureCount === 0 && pendingWechatDrafts <= 1) {
    target = Math.min(target + 1, maxArticleLimit);
    constraints.push(`expanded because recent average reward is ${recentAverageReward}`);
  }

  if (target > affordableCandidates) {
    target = affordableCandidates;
    constraints.push(`limited by ${affordableCandidates} affordable candidates`);
  }

  return {
    shouldRun: target > 0,
    recommendedArticleLimit: target,
    reason: `Recommended ${target} article(s) for today's ${explorationPolicy.phase} phase using ${Math.round(explorationPolicy.exploreRatio * 100)}% exploration and ${Math.round(explorationPolicy.historyWeight * 100)}% historical weight.`,
    constraints,
    signals
  };
}
