import type { ArticleOutcome, MonetizationChannelMix } from "./domain";

export interface RevenueModelConfig {
  estimatedCpmCny: number;
  readQualityCpmCny: number;
  likeValueCny: number;
  inLikeValueCny: number;
  commentValueCny: number;
  shareValueCny: number;
  favoriteValueCny: number;
  followerValueCny: number;
}

export interface RevenueModelResult {
  netProfit: number;
  trafficValue: number;
  engagementValue: number;
  followerValue: number;
  modeledGrossValue: number;
  reportedChannelRevenue: MonetizationChannelMix;
  hasReportedChannelBreakdown: boolean;
}

export const DEFAULT_REVENUE_MODEL_CONFIG: RevenueModelConfig = {
  estimatedCpmCny: 2.5,
  readQualityCpmCny: 0.8,
  likeValueCny: 0.4,
  inLikeValueCny: 0.5,
  commentValueCny: 1.2,
  shareValueCny: 1.5,
  favoriteValueCny: 0.8,
  followerValueCny: 8
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function metric(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

export function modelOutcomeValue(
  outcome: ArticleOutcome,
  config: RevenueModelConfig = DEFAULT_REVENUE_MODEL_CONFIG
): RevenueModelResult {
  const netProfit = outcome.revenue - outcome.cost;
  const trafficBase = metric(outcome.adImpressions ?? outcome.views);
  const trafficValue = trafficBase > 0
    ? (trafficBase / 1000) * config.estimatedCpmCny
    : (metric(outcome.reads) / 1000) * config.readQualityCpmCny;
  const engagementValue =
    metric(outcome.likes) * config.likeValueCny +
    metric(outcome.inLikes) * config.inLikeValueCny +
    metric(outcome.comments) * config.commentValueCny +
    metric(outcome.shares) * config.shareValueCny +
    metric(outcome.favorites) * config.favoriteValueCny;
  const followerValue = metric(outcome.newFollowers) * config.followerValueCny;
  const modeledGrossValue = outcome.revenue + trafficValue + engagementValue + followerValue;
  const reportedChannelRevenue: MonetizationChannelMix = {
    traffic_ad: round(metric(outcome.adRevenue)),
    affiliate: round(metric(outcome.affiliateRevenue)),
    lead: round(metric(outcome.leadRevenue)),
    follower_ltv: round(metric(outcome.followerValueRevenue))
  };
  const hasReportedChannelBreakdown = Object.values(reportedChannelRevenue).some((value) => value > 0);

  return {
    netProfit: round(netProfit),
    trafficValue: round(trafficValue),
    engagementValue: round(engagementValue),
    followerValue: round(followerValue),
    modeledGrossValue: round(modeledGrossValue),
    reportedChannelRevenue,
    hasReportedChannelBreakdown
  };
}
