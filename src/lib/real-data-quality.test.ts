import { describe, expect, it } from "vitest";
import type { ArticleOutcome, ArticleReward } from "./domain";
import { getReliableOutcomes, getReliableRewards, isKnownDemoOutcome } from "./real-data-quality";

const demoOutcome: ArticleOutcome = {
  id: "outcome-article-1-20260618120000-0",
  articleId: "article-1",
  reads: 1200,
  shares: 30,
  favorites: 45,
  newFollowers: 12,
  unfollows: 1,
  revenue: 330,
  cost: 42,
  riskScore: 8,
  recordedAt: "2026-06-18T12:00:00.000Z"
};

const realOutcome: ArticleOutcome = {
  id: "outcome-real-1",
  articleId: "article-real",
  reads: 863,
  shares: 9,
  favorites: 18,
  newFollowers: 7,
  unfollows: 1,
  revenue: 0,
  cost: 34,
  riskScore: 12,
  recordedAt: "2026-06-19T10:00:00.000Z"
};

describe("real data quality", () => {
  it("detects the known demo outcome tuple", () => {
    expect(isKnownDemoOutcome(demoOutcome)).toBe(true);
    expect(isKnownDemoOutcome(realOutcome)).toBe(false);
  });

  it("keeps reliable outcomes and filters demo rows", () => {
    expect(getReliableOutcomes([demoOutcome, realOutcome])).toEqual([realOutcome]);
  });

  it("filters rewards whose article only has a known demo outcome", () => {
    const rewards: ArticleReward[] = [
      { articleId: "article-1", reward: 449, netProfit: 288, trafficValue: 0, engagementValue: 0, followerValue: 0, modeledGrossValue: 330, riskPenalty: 16, followerPenalty: 0 },
      { articleId: "article-real", reward: 24, netProfit: -34, trafficValue: 0, engagementValue: 0, followerValue: 0, modeledGrossValue: 0, riskPenalty: 12, followerPenalty: 0 }
    ];

    expect(getReliableRewards(rewards, [demoOutcome, realOutcome])).toEqual([rewards[1]]);
  });
});
