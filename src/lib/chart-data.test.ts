import { describe, expect, it } from "vitest";
import type { ArticleMetrics, CostRecord, RevenueRecord, TopicCandidate } from "./domain";
import { buildContentMixBars, buildDailyFinancialSeries, buildReadTrendSeries } from "./chart-data";

const revenue: RevenueRecord[] = [
  {
    id: "revenue-1",
    articleId: "article-1",
    type: "ad",
    amount: 100,
    currency: "CNY",
    source: "manual",
    confidence: 0.9,
    recordedAt: "2026-06-17T09:00:00.000Z"
  },
  {
    id: "revenue-2",
    articleId: "article-2",
    type: "affiliate",
    amount: 60,
    currency: "CNY",
    source: "manual",
    confidence: 0.8,
    recordedAt: "2026-06-18T10:00:00.000Z"
  }
];

const costs: CostRecord[] = [
  {
    id: "cost-1",
    articleId: "article-1",
    type: "text_generation",
    provider: "seed",
    quantity: 1,
    unitCost: 20,
    totalCost: 20,
    createdAt: "2026-06-17T10:00:00.000Z"
  },
  {
    id: "cost-2",
    articleId: "article-2",
    type: "manual_review",
    provider: "human",
    quantity: 0.5,
    unitCost: 80,
    totalCost: 40,
    createdAt: "2026-06-18T11:00:00.000Z"
  }
];

const topics = [
  { source: "hot" },
  { source: "hot" },
  { source: "evergreen" },
  { source: "series" }
] as TopicCandidate[];

const metrics: ArticleMetrics[] = [
  {
    articleId: "article-1",
    reads: 1000,
    shares: 10,
    favorites: 20,
    newFollowers: 5,
    unfollows: 1,
    collectedAt: "2026-06-17T12:00:00.000Z"
  },
  {
    articleId: "article-1",
    reads: 1800,
    shares: 16,
    favorites: 34,
    newFollowers: 9,
    unfollows: 1,
    collectedAt: "2026-06-18T12:00:00.000Z"
  }
];

describe("chart data helpers", () => {
  it("builds daily revenue, cost, and net financial series", () => {
    expect(buildDailyFinancialSeries(revenue, costs)).toEqual([
      { date: "06-17", revenue: 100, cost: 20, net: 80 },
      { date: "06-18", revenue: 60, cost: 40, net: 20 }
    ]);
  });

  it("builds content mix bars with percentages", () => {
    expect(buildContentMixBars(topics)).toEqual([
      { source: "hot", label: "热点", count: 2, percent: 50 },
      { source: "evergreen", label: "常青", count: 1, percent: 25 },
      { source: "series", label: "系列", count: 1, percent: 25 },
      { source: "experimental", label: "实验", count: 0, percent: 0 }
    ]);
  });

  it("builds read trend points in chronological order", () => {
    expect(buildReadTrendSeries(metrics)).toEqual([
      { date: "06-17", reads: 1000, followers: 5 },
      { date: "06-18", reads: 1800, followers: 9 }
    ]);
  });
});
