import type {
  ArticleOutcome,
  ArticlePackage,
  ArticleReward,
  ContentExperimentTag,
  ContentStrategy,
  MonetizationChannel,
  RiskEvent,
  StrategyLearningState,
  TopicSource
} from "./domain";
import { getReliableOutcomes } from "./real-data-quality";
import { modelOutcomeValue } from "./revenue-model";
import type { WorkspaceData } from "./workspace-store";

const DEFAULT_SOURCE_WEIGHTS: Record<TopicSource, number> = {
  hot: 1,
  evergreen: 1,
  series: 1,
  experimental: 1
};

const DEFAULT_EXPERIMENT_TAG_WEIGHTS: Record<ContentExperimentTag, number> = {
  "mass-pain-point": 1,
  "money-saving": 1,
  "side-income-beginner": 1,
  "emotional-relief": 1,
  "technical-tutorial": 1,
  "buyer-guide": 1,
  "profit-review": 1,
  "workflow-playbook": 1
};

export const DEFAULT_CONTENT_STRATEGY_WEIGHTS: Record<ContentStrategy, number> = {
  chase: 1,
  manufacture: 1,
  convert: 1
};

export const DEFAULT_MONETIZATION_CHANNEL_WEIGHTS: Record<MonetizationChannel, number> = {
  traffic_ad: 1,
  affiliate: 1,
  lead: 1,
  follower_ltv: 1
};

export interface ContentShapeObservation {
  articleId: string;
  reward: number;
  wordCount: number;
  inlineImageCount: number;
  coverStyle?: string;
}

export interface ContentShapeLearningResult {
  recommendedWordCount: { min: number; max: number; reference: number };
  recommendedInlineImages: { reference: number; note: string };
  preferredCoverStyles: string[];
}

function clampWeight(value: number): number {
  return Math.max(0.35, Math.min(2.5, Math.round(value * 100) / 100));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function learnContentShapeFromOutcomes(observations: ContentShapeObservation[]): ContentShapeLearningResult {
  const winners = observations.filter((item) => item.reward > 0 && item.wordCount > 0);
  const sample = winners.length > 0 ? winners : observations.filter((item) => item.wordCount > 0);
  const weightedWordCount = weightedAverage(sample.map((item) => ({ value: item.wordCount, weight: Math.max(1, item.reward) })));
  const weightedImages = weightedAverage(sample.map((item) => ({ value: item.inlineImageCount, weight: Math.max(1, item.reward) })));
  const referenceWordCount = Math.round(weightedWordCount || 1200);
  const preferredCoverStyles = rankCoverStyles(sample).slice(0, 3);

  return {
    recommendedWordCount: {
      min: Math.max(600, Math.round((referenceWordCount * 0.82) / 50) * 50),
      max: Math.round((referenceWordCount * 1.18) / 50) * 50,
      reference: referenceWordCount
    },
    recommendedInlineImages: {
      reference: Math.max(0, Math.round(weightedImages || 1)),
      note: "Use as a starting reference only; final image count should follow section need and fresh outcome data."
    },
    preferredCoverStyles
  };
}

function weightedAverage(items: Array<{ value: number; weight: number }>): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;
  return items.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function rankCoverStyles(observations: ContentShapeObservation[]): string[] {
  const totals = new Map<string, number>();
  for (const item of observations) {
    if (!item.coverStyle) continue;
    totals.set(item.coverStyle, (totals.get(item.coverStyle) ?? 0) + item.reward);
  }
  return [...totals.entries()].sort((left, right) => right[1] - left[1]).map(([style]) => style);
}

export function calculateArticleReward(
  article: ArticlePackage,
  outcome: ArticleOutcome,
  riskEvents: RiskEvent[]
): ArticleReward {
  const value = modelOutcomeValue(outcome);
  const riskPenalty = outcome.riskScore * 2 + riskEvents.reduce((sum, event) => sum + event.severity * 2.5, 0);
  const followerPenalty = Math.max(0, outcome.unfollows - outcome.newFollowers * 0.25) * 12;
  const lowQualityPenalty = Math.max(0, 70 - article.qualityScore) * 3;
  const reward = value.netProfit + value.trafficValue + value.engagementValue + value.followerValue - riskPenalty - followerPenalty - lowQualityPenalty;

  return {
    articleId: article.id,
    experimentTag: article.experimentTag,
    reward: round(reward),
    netProfit: value.netProfit,
    trafficValue: value.trafficValue,
    engagementValue: value.engagementValue,
    followerValue: value.followerValue,
    modeledGrossValue: value.modeledGrossValue,
    riskPenalty: round(riskPenalty + lowQualityPenalty),
    followerPenalty: round(followerPenalty)
  };
}

export function learnStrategyFromWorkspace(workspace: WorkspaceData, now: Date = new Date()): StrategyLearningState {
  const sourceTotals = new Map<TopicSource, { reward: number; count: number }>();
  const categoryTotals = new Map<string, { reward: number; count: number }>();
  const experimentTagTotals = new Map<string, { reward: number; count: number }>();
  const contentStrategyTotals = new Map<ContentStrategy, { reward: number; count: number }>();
  const monetizationChannelTotals = new Map<MonetizationChannel, { reward: number; count: number }>();
  const articleRewards: ArticleReward[] = [];

  for (const outcome of getReliableOutcomes(workspace.articleOutcomes ?? [])) {
    const article = workspace.articles.find((item) => item.id === outcome.articleId);
    if (!article) {
      continue;
    }
    const topic = workspace.topics.find((item) => item.id === article.topicId);
    if (!topic) {
      continue;
    }

    const riskEvents = (workspace.riskEvents ?? []).filter((event) => event.articleId === article.id);
    const reward = calculateArticleReward(article, outcome, riskEvents);
    const value = modelOutcomeValue(outcome);
    articleRewards.push(reward);

    const sourceCurrent = sourceTotals.get(topic.source) ?? { reward: 0, count: 0 };
    sourceTotals.set(topic.source, { reward: sourceCurrent.reward + reward.reward, count: sourceCurrent.count + 1 });

    const categoryCurrent = categoryTotals.get(topic.category) ?? { reward: 0, count: 0 };
    categoryTotals.set(topic.category, { reward: categoryCurrent.reward + reward.reward, count: categoryCurrent.count + 1 });

    const experimentTag = article.experimentTag ?? topic.experimentTag;
    if (experimentTag) {
      const tagCurrent = experimentTagTotals.get(experimentTag) ?? { reward: 0, count: 0 };
      experimentTagTotals.set(experimentTag, {
        reward: tagCurrent.reward + reward.reward,
        count: tagCurrent.count + 1
      });
    }

    const contentStrategy = topic.contentStrategy ?? topic.opportunityProfile?.strategy;
    if (contentStrategy) {
      const current = contentStrategyTotals.get(contentStrategy) ?? { reward: 0, count: 0 };
      contentStrategyTotals.set(contentStrategy, { reward: current.reward + reward.reward, count: current.count + 1 });
    }

    if (value.hasReportedChannelBreakdown) {
      const reportedTotal = Object.values(value.reportedChannelRevenue).reduce((sum, amount) => sum + amount, 0);
      for (const [channel, amount] of Object.entries(value.reportedChannelRevenue) as Array<[MonetizationChannel, number]>) {
        if (amount <= 0) continue;
        const current = monetizationChannelTotals.get(channel) ?? { reward: 0, count: 0 };
        monetizationChannelTotals.set(channel, {
          reward: current.reward + reward.reward * (amount / Math.max(1, reportedTotal)),
          count: current.count + 1
        });
      }
    } else {
      const primaryChannel = topic.primaryMonetizationChannel
        ?? (contentStrategy === "convert" ? "affiliate" : contentStrategy === "manufacture" ? "follower_ltv" : "traffic_ad");
      const current = monetizationChannelTotals.get(primaryChannel) ?? { reward: 0, count: 0 };
      monetizationChannelTotals.set(primaryChannel, { reward: current.reward + reward.reward, count: current.count + 1 });
    }
  }

  const sourceWeights = { ...DEFAULT_SOURCE_WEIGHTS };
  for (const [source, total] of sourceTotals.entries()) {
    const average = total.reward / Math.max(1, total.count);
    sourceWeights[source] = clampWeight(1 + average / 500);
  }

  const categoryWeights: Record<string, number> = {};
  for (const [category, total] of categoryTotals.entries()) {
    const average = total.reward / Math.max(1, total.count);
    categoryWeights[category] = clampWeight(1 + average / 500);
  }

  const experimentTagWeights: Record<string, number> = { ...DEFAULT_EXPERIMENT_TAG_WEIGHTS };
  for (const [experimentTag, total] of experimentTagTotals.entries()) {
    const average = total.reward / Math.max(1, total.count);
    experimentTagWeights[experimentTag] = clampWeight(1 + average / 500);
  }

  const contentStrategyWeights = { ...DEFAULT_CONTENT_STRATEGY_WEIGHTS };
  for (const [strategy, total] of contentStrategyTotals.entries()) {
    contentStrategyWeights[strategy] = clampWeight(1 + (total.reward / Math.max(1, total.count)) / 500);
  }

  const monetizationChannelWeights = { ...DEFAULT_MONETIZATION_CHANNEL_WEIGHTS };
  for (const [channel, total] of monetizationChannelTotals.entries()) {
    monetizationChannelWeights[channel] = clampWeight(1 + (total.reward / Math.max(1, total.count)) / 500);
  }

  return {
    sourceWeights,
    categoryWeights,
    experimentTagWeights,
    contentStrategyWeights,
    monetizationChannelWeights,
    articleRewards: articleRewards.sort((left, right) => right.reward - left.reward).slice(0, 50),
    updatedAt: now.toISOString()
  };
}
