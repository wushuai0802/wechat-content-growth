import { describe, expect, it } from "vitest";
import type { TopicCandidate, TopicOpportunityProfile } from "./domain";
import {
  DEFAULT_MONETIZATION_PRIOR,
  buildTopicRevenueForecast,
  discountedExpectedNetProfit,
  resolveTopicRevenueForecast
} from "./topic-profit-forecast";

function opportunity(patch: Partial<TopicOpportunityProfile> = {}): TopicOpportunityProfile {
  return {
    strategy: "chase",
    growthRate: 72,
    remainingHalfLifeHours: 36,
    audienceOverlap: 82,
    contentSupplyGap: 68,
    monetizationIntent: 55,
    sharePotential: 76,
    productionLatencyHours: 3,
    policyRisk: 12,
    confidence: 80,
    evidenceReadiness: "ready",
    evidencePlan: ["核对事件来源", "补充受影响人群和行动窗口"],
    ...patch
  };
}

function topic(patch: Partial<TopicCandidate> = {}): TopicCandidate {
  return {
    id: "topic-forecast",
    title: "热点与普通人的选择有什么关系",
    source: "hot",
    category: "热点价值翻译",
    audience: "普通公众号读者",
    angle: "解释影响并给出行动清单",
    status: "candidate",
    expectedRevenue: 600,
    timeliness: 80,
    accountFit: 82,
    historicalSimilarity: 50,
    risk: 12,
    estimatedCost: 30,
    saturation: 35,
    createdAt: "2026-07-13T00:00:00.000Z",
    ...patch
  };
}

describe("topic profit forecast", () => {
  it("uses a WeChat-first multi-channel prior that sums to one", () => {
    expect(DEFAULT_MONETIZATION_PRIOR).toEqual({
      traffic_ad: 0.55,
      affiliate: 0.25,
      follower_ltv: 0.15,
      lead: 0.05
    });
    expect(Object.values(DEFAULT_MONETIZATION_PRIOR).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });

  it("builds cumulative 24-hour, 7-day, and 30-day forecasts with explicit costs", () => {
    const forecast = buildTopicRevenueForecast({
      expectedThirtyDayGross: 800,
      estimatedCost: 40,
      opportunity: opportunity(),
      primaryChannel: "traffic_ad"
    });

    expect(forecast.h24.grossRevenue).toBeLessThan(forecast.d7.grossRevenue);
    expect(forecast.d7.grossRevenue).toBeLessThan(forecast.d30.grossRevenue);
    expect(forecast.d30.productionCost).toBe(40);
    expect(forecast.d30.policyRiskCost).toBeGreaterThan(0);
    expect(forecast.d30.churnCost).toBeGreaterThan(0);
    expect(forecast.d30.opportunityCost).toBeGreaterThan(0);
    expect(forecast.d30.netProfit).toBeLessThan(forecast.d30.grossRevenue);
    expect(forecast.confidence).toBe(0.8);
  });

  it("discounts low-confidence forecasts even when their gross estimate is larger", () => {
    const reliable = buildTopicRevenueForecast({
      expectedThirtyDayGross: 600,
      estimatedCost: 30,
      opportunity: opportunity({ confidence: 90 })
    });
    const speculative = buildTopicRevenueForecast({
      expectedThirtyDayGross: 1200,
      estimatedCost: 30,
      opportunity: opportunity({ confidence: 20 })
    });

    expect(discountedExpectedNetProfit(reliable)).toBeGreaterThan(discountedExpectedNetProfit(speculative));
  });

  it("creates a conservative backward-compatible forecast for legacy topics", () => {
    const forecast = resolveTopicRevenueForecast(topic());

    expect(forecast.confidence).toBeLessThanOrEqual(0.4);
    expect(forecast.d30.grossRevenue).toBeGreaterThan(0);
    expect(forecast.assumptions).toContain("legacy_expected_revenue");
  });
});
