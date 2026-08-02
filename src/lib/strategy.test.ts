import { describe, expect, it } from "vitest";
import { articles, costs, revenue, strategySuggestions, topics } from "./sample-data";
import { buildPortfolioMix, getDashboardStats, summarizeSuggestions } from "./strategy";

describe("buildPortfolioMix", () => {
  it("groups candidate topics into operating buckets", () => {
    expect(buildPortfolioMix(topics)).toEqual({
      hot: 2,
      evergreen: 2,
      series: 1,
      experimental: 1
    });
  });
});

describe("summarizeSuggestions", () => {
  it("returns high-priority recommendations first", () => {
    const summary = summarizeSuggestions(strategySuggestions);

    expect(summary.map((item) => item.priority)).toEqual(["high", "high", "medium", "low"]);
    expect(summary[0].requiresApproval).toBe(true);
  });
});

describe("getDashboardStats", () => {
  it("calculates revenue, costs, net revenue, and review counts", () => {
    expect(getDashboardStats({ articles, revenue, costs })).toEqual({
      totalRevenue: 870,
      totalCost: 174,
      netRevenue: 696,
      pendingReviews: 2,
      approvedArticles: 1
    });
  });
});
