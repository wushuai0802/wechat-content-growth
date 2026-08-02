import { describe, expect, it } from "vitest";
import {
  calculateNetRevenue,
  calculateTopicScore,
  classifyROI
} from "./scoring";
import type { CostRecord, RevenueRecord, TopicCandidate } from "./domain";

describe("calculateNetRevenue", () => {
  it("subtracts article costs from all revenue streams", () => {
    const revenue: RevenueRecord[] = [
      {
        id: "rev-1",
        articleId: "article-1",
        type: "ad",
        amount: 180,
        currency: "CNY",
        source: "manual",
        confidence: 0.9,
        recordedAt: "2026-06-17T09:00:00.000Z"
      },
      {
        id: "rev-2",
        articleId: "article-1",
        type: "affiliate",
        amount: 70,
        currency: "CNY",
        source: "manual",
        confidence: 0.8,
        recordedAt: "2026-06-17T09:05:00.000Z"
      }
    ];

    const costs: CostRecord[] = [
      {
        id: "cost-1",
        articleId: "article-1",
        type: "text_generation",
        provider: "mock",
        quantity: 1,
        unitCost: 12,
        totalCost: 12,
        createdAt: "2026-06-17T08:00:00.000Z"
      },
      {
        id: "cost-2",
        articleId: "article-1",
        type: "image_generation",
        provider: "mock",
        quantity: 2,
        unitCost: 8,
        totalCost: 16,
        createdAt: "2026-06-17T08:10:00.000Z"
      }
    ];

    expect(calculateNetRevenue(revenue, costs)).toBe(222);
  });
});

describe("calculateTopicScore", () => {
  it("rewards upside and penalizes risk, cost, and saturation", () => {
    const topic: TopicCandidate = {
      id: "topic-1",
      title: "AI 新工具如何重做个人知识库",
      source: "hot",
      category: "AI productivity",
      audience: "知识工作者",
      angle: "实操教程",
      status: "candidate",
      expectedRevenue: 500,
      timeliness: 82,
      accountFit: 91,
      historicalSimilarity: 76,
      risk: 18,
      estimatedCost: 45,
      saturation: 34,
      createdAt: "2026-06-17T07:00:00.000Z"
    };

    expect(calculateTopicScore(topic)).toBe(76);
  });
});

describe("classifyROI", () => {
  it("classifies losses, watchlist items, promising articles, and winners", () => {
    expect(classifyROI(-10)).toBe("loss");
    expect(classifyROI(18)).toBe("watch");
    expect(classifyROI(80)).toBe("promising");
    expect(classifyROI(180)).toBe("winner");
  });
});
