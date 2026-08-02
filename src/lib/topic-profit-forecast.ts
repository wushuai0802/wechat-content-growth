import type {
  ContentStrategy,
  MonetizationChannel,
  MonetizationChannelMix,
  RevenueForecastHorizon,
  TopicCandidate,
  TopicOpportunityProfile,
  TopicRevenueForecast
} from "./domain";

export const DEFAULT_MONETIZATION_PRIOR: MonetizationChannelMix = {
  traffic_ad: 0.55,
  affiliate: 0.25,
  follower_ltv: 0.15,
  lead: 0.05
};

const STRATEGY_CHANNEL_MIX: Record<ContentStrategy, MonetizationChannelMix> = {
  chase: { traffic_ad: 0.7, affiliate: 0.08, follower_ltv: 0.2, lead: 0.02 },
  manufacture: { traffic_ad: 0.45, affiliate: 0.15, follower_ltv: 0.3, lead: 0.1 },
  convert: { traffic_ad: 0.25, affiliate: 0.55, follower_ltv: 0.1, lead: 0.1 }
};

export interface BuildTopicRevenueForecastInput {
  expectedThirtyDayGross: number;
  estimatedCost: number;
  opportunity: TopicOpportunityProfile;
  primaryChannel?: MonetizationChannel;
  channelMix?: Partial<MonetizationChannelMix>;
  assumptions?: string[];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function score(value: number, fallback: number): number {
  return Number.isFinite(value) ? clamp(value, 0, 100) : fallback;
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeMix(
  strategy: ContentStrategy,
  mix?: Partial<MonetizationChannelMix>
): MonetizationChannelMix {
  const fallback = STRATEGY_CHANNEL_MIX[strategy] ?? DEFAULT_MONETIZATION_PRIOR;
  const candidate: MonetizationChannelMix = {
    traffic_ad: Math.max(0, mix?.traffic_ad ?? fallback.traffic_ad),
    affiliate: Math.max(0, mix?.affiliate ?? fallback.affiliate),
    follower_ltv: Math.max(0, mix?.follower_ltv ?? fallback.follower_ltv),
    lead: Math.max(0, mix?.lead ?? fallback.lead)
  };
  const total = Object.values(candidate).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { ...DEFAULT_MONETIZATION_PRIOR };
  return {
    traffic_ad: round(candidate.traffic_ad / total),
    affiliate: round(candidate.affiliate / total),
    follower_ltv: round(candidate.follower_ltv / total),
    lead: round(candidate.lead / total)
  };
}

function primaryChannelFor(strategy: ContentStrategy): MonetizationChannel {
  if (strategy === "convert") return "affiliate";
  if (strategy === "manufacture") return "follower_ltv";
  return "traffic_ad";
}

export function normalizeTopicOpportunity(
  topic: TopicCandidate,
  patch: Partial<TopicOpportunityProfile> = {}
): TopicOpportunityProfile {
  const strategy = patch.strategy ?? topic.contentStrategy ?? (topic.source === "hot" ? "chase" : topic.source === "experimental" ? "manufacture" : "convert");
  return {
    strategy,
    growthRate: score(patch.growthRate ?? topic.timeliness, 45),
    remainingHalfLifeHours: positive(patch.remainingHalfLifeHours ?? 0, strategy === "chase" ? 36 : 168),
    audienceOverlap: score(patch.audienceOverlap ?? topic.profitAudienceFit ?? topic.accountFit, 50),
    contentSupplyGap: score(patch.contentSupplyGap ?? 100 - topic.saturation, 40),
    monetizationIntent: score(patch.monetizationIntent ?? (strategy === "convert" ? 75 : 40), 40),
    sharePotential: score(patch.sharePotential ?? topic.timeliness, 50),
    productionLatencyHours: positive(patch.productionLatencyHours ?? 0, strategy === "manufacture" ? 18 : strategy === "convert" ? 6 : 3),
    policyRisk: score(patch.policyRisk ?? topic.risk, topic.risk),
    confidence: score(patch.confidence ?? 35, 35),
    evidenceReadiness: patch.evidenceReadiness ?? (strategy === "manufacture" ? "needs_research" : "ready"),
    evidencePlan: patch.evidencePlan ?? (strategy === "manufacture" ? ["完成原创实测或数据采集", "保存可复核的原始记录"] : [])
  };
}

function horizonShares(opportunity: TopicOpportunityProfile): { h24: number; d7: number; d30: number } {
  const base = opportunity.strategy === "chase"
    ? { h24: 0.42, d7: 0.82, d30: 1 }
    : opportunity.strategy === "manufacture"
      ? { h24: 0.12, d7: 0.52, d30: 1 }
      : { h24: 0.1, d7: 0.44, d30: 1 };
  const speed = clamp(1 - opportunity.productionLatencyHours / Math.max(12, opportunity.remainingHalfLifeHours * 1.5), 0.2, 1);
  const growthLift = 0.85 + (opportunity.growthRate / 100) * 0.3;
  return {
    h24: clamp(base.h24 * speed * growthLift, 0.03, 0.8),
    d7: clamp(base.d7 * speed * growthLift, 0.08, 0.95),
    d30: clamp(speed * growthLift, 0.15, 1)
  };
}

function buildHorizon(
  grossRevenue: number,
  estimatedCost: number,
  opportunity: TopicOpportunityProfile
): RevenueForecastHorizon {
  const productionCost = Math.max(0, estimatedCost);
  const policyRiskCost = grossRevenue * (opportunity.policyRisk / 100) * 0.18;
  const churnCost = grossRevenue * ((100 - opportunity.audienceOverlap) / 100) * 0.1;
  const opportunityCost = productionCost
    * clamp(opportunity.productionLatencyHours / Math.max(1, opportunity.remainingHalfLifeHours), 0, 2)
    * 0.5;
  return {
    grossRevenue: round(grossRevenue),
    productionCost: round(productionCost),
    policyRiskCost: round(policyRiskCost),
    churnCost: round(churnCost),
    opportunityCost: round(opportunityCost),
    netProfit: round(grossRevenue - productionCost - policyRiskCost - churnCost - opportunityCost)
  };
}

export function buildTopicRevenueForecast(input: BuildTopicRevenueForecastInput): TopicRevenueForecast {
  const expectedThirtyDayGross = Math.max(0, input.expectedThirtyDayGross);
  const shares = horizonShares(input.opportunity);
  const channelMix = normalizeMix(input.opportunity.strategy, input.channelMix);
  return {
    primaryChannel: input.primaryChannel ?? primaryChannelFor(input.opportunity.strategy),
    channelMix,
    confidence: round(score(input.opportunity.confidence, 35) / 100),
    h24: buildHorizon(expectedThirtyDayGross * shares.h24, input.estimatedCost, input.opportunity),
    d7: buildHorizon(expectedThirtyDayGross * shares.d7, input.estimatedCost, input.opportunity),
    d30: buildHorizon(expectedThirtyDayGross * shares.d30, input.estimatedCost, input.opportunity),
    assumptions: [...(input.assumptions ?? []), `strategy:${input.opportunity.strategy}`]
  };
}

export function resolveTopicRevenueForecast(topic: TopicCandidate): TopicRevenueForecast {
  if (topic.revenueForecast) return topic.revenueForecast;
  const opportunity = normalizeTopicOpportunity(topic, topic.opportunityProfile ?? {
    strategy: topic.contentStrategy ?? "chase",
    confidence: 35,
    evidenceReadiness: "ready"
  });
  return buildTopicRevenueForecast({
    expectedThirtyDayGross: topic.expectedRevenue,
    estimatedCost: topic.estimatedCost,
    opportunity,
    primaryChannel: topic.primaryMonetizationChannel,
    assumptions: ["legacy_expected_revenue"]
  });
}

export function discountedExpectedNetProfit(forecast: TopicRevenueForecast): number {
  const firstDay = forecast.h24.netProfit;
  const nextSixDays = forecast.d7.netProfit - forecast.h24.netProfit;
  const remainingLongTail = forecast.d30.netProfit - forecast.d7.netProfit;
  return round((firstDay + nextSixDays * 0.4 + remainingLongTail * 0.15) * clamp(forecast.confidence, 0.05, 1));
}
