import { describe, expect, it } from "vitest";
import type { StrategyLearningState, TopicCandidate } from "./domain";
import { DEFAULT_AUTO_LOOP_CONFIG, rankTopicsForProfit, scoreTopicForProfit } from "./profit-optimizer";
import type { ExplorationPolicy } from "./exploration-policy";

const explorationPolicy: ExplorationPolicy = {
  phase: "explore",
  reliableOutcomeCount: 10,
  richOutcomeCount: 0,
  coveredCategoryCount: 0,
  exploreRatio: 1,
  historyWeight: 0,
  forecastWeight: 0.35,
  realtimeWeight: 1,
  maxTopicsPerTrend: 1,
  reason: "cold start"
};

function topic(overrides: Partial<TopicCandidate>): TopicCandidate {
  return {
    id: "topic-base",
    title: "Base topic",
    source: "hot",
    category: "AI",
    audience: "operators",
    angle: "profit test",
    status: "candidate",
    expectedRevenue: 500,
    timeliness: 70,
    accountFit: 70,
    historicalSimilarity: 60,
    risk: 20,
    estimatedCost: 30,
    saturation: 40,
    createdAt: "2026-06-18T00:00:00.000Z",
    ...overrides
  };
}

describe("profit optimizer", () => {
  it("allows broad non-AI public-account topics for early exploration", () => {
    const ranked = rankTopicsForProfit(
      [
        topic({
          id: "life-saving",
          title: "Stop buying duplicate household items: a weekend home inventory checklist",
          category: "life money-saving family organization",
          angle: "popular public-account life checklist",
          expectedRevenue: 620,
          risk: 7,
          estimatedCost: 20,
          saturation: 18,
          historicalSimilarity: 20
        }),
        topic({
          id: "workplace-emotion",
          title: "New employee workplace anxiety: five small habits that make work easier",
          category: "workplace emotional value habits",
          angle: "relatable mass-market workplace article",
          expectedRevenue: 590,
          risk: 8,
          estimatedCost: 20,
          saturation: 22,
          historicalSimilarity: 24
        })
      ],
      { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 2, dailyCostCapCny: 100, maxRiskScore: 35 }
    );

    expect(ranked.map((item) => item.topic.id)).toEqual(["life-saving", "workplace-emotion"]);
  });

  it("rewards revenue and penalizes risk, saturation, and cost", () => {
    const winner = topic({ id: "winner", expectedRevenue: 900, risk: 10, saturation: 20, estimatedCost: 20 });
    const risky = topic({ id: "risky", expectedRevenue: 900, risk: 80, saturation: 80, estimatedCost: 80 });

    expect(scoreTopicForProfit(winner).score).toBeGreaterThan(scoreTopicForProfit(risky).score);
    expect(scoreTopicForProfit(winner).projectedNetProfit).toBeGreaterThan(scoreTopicForProfit(risky).projectedNetProfit);
  });

  it("ranks only candidate topics that fit risk and cost limits", () => {
    const ranked = rankTopicsForProfit(
      [
        topic({ id: "best", expectedRevenue: 900, risk: 10, saturation: 10, estimatedCost: 20 }),
        topic({ id: "published", status: "approved", expectedRevenue: 1200, risk: 5 }),
        topic({ id: "too-risky", expectedRevenue: 2000, risk: 90 }),
        topic({ id: "too-costly", expectedRevenue: 2000, estimatedCost: 999 })
      ],
      { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 2, dailyCostCapCny: 100, maxRiskScore: 35 }
    );

    expect(ranked.map((item) => item.topic.id)).toEqual(["best"]);
  });

  it("filters legacy public-hotspot topics before profit ranking", () => {
    const ranked = rankTopicsForProfit(
      [
        topic({
          id: "legacy-hotspot",
          title: "习近平给新华社老党员回信：公众号运营者该怎么判断机会",
          category: "百度热搜",
          expectedRevenue: 5000,
          risk: 1,
          estimatedCost: 1
        }),
        topic({ id: "safe-ai", title: "AI Agent 办公自动化：一个可复用的 AI 工作流落地方法", expectedRevenue: 600 })
      ],
      { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 2, dailyCostCapCny: 100, maxRiskScore: 35 }
    );

    expect(ranked.map((item) => item.topic.id)).toEqual(["safe-ai"]);
  });

  it.each(["高校取消录取资格", "积水中多人施救", "三大指数集体大跌"])(
    "keeps legacy high-stakes topic out of automated ranking: %s",
    (title) => {
      const ranked = rankTopicsForProfit(
        [
          topic({ id: "unsafe", title, expectedRevenue: 5000, risk: 1, estimatedCost: 1 }),
          topic({ id: "safe", title: "长期阅读习惯清单", expectedRevenue: 500, risk: 8, estimatedCost: 10 })
        ],
        { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 2, dailyCostCapCny: 100, maxRiskScore: 35 }
      );

      expect(ranked.map((item) => item.topic.id)).toEqual(["safe"]);
    }
  );

  it("uses learned source and category weights for the next ranking", () => {
    const learning: StrategyLearningState = {
      sourceWeights: { hot: 0.7, evergreen: 1, series: 1, experimental: 2 },
      categoryWeights: { experiment: 2, AI: 0.7 },
      experimentTagWeights: {},
      articleRewards: [],
      updatedAt: "2026-06-18T00:00:00.000Z"
    };
    const ranked = rankTopicsForProfit(
      [
        topic({ id: "hot-ai", source: "hot", category: "AI", expectedRevenue: 500 }),
        topic({
          id: "exp",
          title: "用 AI 自动化做内容选题复盘",
          source: "experimental",
          category: "content strategy",
          expectedRevenue: 500
        })
      ],
      { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 2, dailyCostCapCny: 100, maxRiskScore: 35 },
      learning
    );

    expect(ranked[0].topic.id).toBe("exp");
  });

  it("uses learned experiment tag weights to favor winning content formats", () => {
    const learning: StrategyLearningState = {
      sourceWeights: { hot: 1, evergreen: 1, series: 1, experimental: 1 },
      categoryWeights: {},
      experimentTagWeights: { "money-saving": 1.8, "side-income-beginner": 0.55 },
      articleRewards: [],
      updatedAt: "2026-06-18T00:00:00.000Z"
    };
    const ranked = rankTopicsForProfit(
      [
        topic({ id: "saving", title: "普通人用 AI 少花冤枉钱", category: "mass-market", experimentTag: "money-saving", expectedRevenue: 500, estimatedCost: 10 }),
        topic({ id: "side", title: "周末轻副业 AI 实验", category: "mass-market", experimentTag: "side-income-beginner", expectedRevenue: 500, estimatedCost: 10 })
      ],
      { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 2, dailyCostCapCny: 100, maxRiskScore: 35, exploreRatio: 0 },
      learning
    );

    expect(ranked[0].topic.id).toBe("saving");
  });

  it("reserves batch slots for exploratory mass-market angles", () => {
    const ranked = rankTopicsForProfit(
      [
        topic({ id: "proven-1", title: "AI 自动化高阶工作流", source: "series", category: "automation", expectedRevenue: 900, historicalSimilarity: 88, estimatedCost: 10 }),
        topic({ id: "proven-2", title: "AI 工具深度评测", source: "evergreen", category: "AI", expectedRevenue: 820, historicalSimilarity: 84, estimatedCost: 10 }),
        topic({ id: "explore", title: "普通人怎么用 AI 少走弯路", source: "experimental", category: "大众效率", expectedRevenue: 500, historicalSimilarity: 40, estimatedCost: 10 })
      ],
      { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 3, dailyCostCapCny: 100, maxRiskScore: 35, exploreRatio: 0.34 }
    );

    expect(ranked.map((item) => item.topic.id)).toContain("explore");
  });

  it("can spend exploration budget on WeChat public hot-article topics", () => {
    const ranked = rankTopicsForProfit(
      [
        topic({ id: "proven-1", title: "AI 自动化高转化工作流", source: "series", category: "automation", expectedRevenue: 900, historicalSimilarity: 90, estimatedCost: 10 }),
        topic({ id: "proven-2", title: "AI 工具深度评测", source: "evergreen", category: "AI", expectedRevenue: 850, historicalSimilarity: 86, estimatedCost: 10 }),
        topic({ id: "wechat-hot", title: "普通人用 AI 做副业复盘：从公众号热文里拆出的机会", source: "hot", category: "公众号热门文章", expectedRevenue: 520, accountFit: 82, historicalSimilarity: 45, estimatedCost: 10 })
      ],
      { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 3, dailyCostCapCny: 100, maxRiskScore: 35, exploreRatio: 0.34 }
    );

    expect(ranked.map((item) => item.topic.id)).toContain("wechat-hot");
  });

  it("prefers confidence-weighted profit over a larger speculative revenue guess", () => {
    const ranked = rankTopicsForProfit(
      [
        topic({
          id: "reliable",
          expectedRevenue: 600,
          opportunityProfile: {
            strategy: "chase",
            growthRate: 70,
            remainingHalfLifeHours: 36,
            audienceOverlap: 85,
            contentSupplyGap: 65,
            monetizationIntent: 55,
            sharePotential: 75,
            productionLatencyHours: 2,
            policyRisk: 8,
            confidence: 90,
            evidenceReadiness: "ready",
            evidencePlan: []
          }
        }),
        topic({
          id: "speculative",
          expectedRevenue: 1200,
          opportunityProfile: {
            strategy: "chase",
            growthRate: 90,
            remainingHalfLifeHours: 12,
            audienceOverlap: 45,
            contentSupplyGap: 20,
            monetizationIntent: 45,
            sharePotential: 80,
            productionLatencyHours: 8,
            policyRisk: 25,
            confidence: 15,
            evidenceReadiness: "ready",
            evidencePlan: []
          }
        })
      ],
      { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 2, dailyCostCapCny: 100, maxRiskScore: 35, exploreRatio: 0 }
    );

    expect(ranked[0].topic.id).toBe("reliable");
  });

  it("keeps manufacture topics out of automation until original evidence is ready", () => {
    const ranked = rankTopicsForProfit(
      [
        topic({
          id: "research-pending",
          expectedRevenue: 2000,
          contentStrategy: "manufacture",
          opportunityProfile: {
            strategy: "manufacture",
            growthRate: 80,
            remainingHalfLifeHours: 120,
            audienceOverlap: 85,
            contentSupplyGap: 90,
            monetizationIntent: 70,
            sharePotential: 90,
            productionLatencyHours: 18,
            policyRisk: 10,
            confidence: 80,
            evidenceReadiness: "needs_research",
            evidencePlan: ["完成原创实测"]
          }
        }),
        topic({ id: "ready", expectedRevenue: 500 })
      ],
      { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 2, dailyCostCapCny: 100, maxRiskScore: 35 }
    );

    expect(ranked.map((item) => item.topic.id)).toEqual(["ready"]);
  });

  it("uses learned strategy and monetization weights without overriding risk gates", () => {
    const learning: StrategyLearningState = {
      sourceWeights: { hot: 1, evergreen: 1, series: 1, experimental: 1 },
      categoryWeights: {},
      experimentTagWeights: {},
      contentStrategyWeights: { chase: 0.7, manufacture: 1, convert: 1.8 },
      monetizationChannelWeights: { traffic_ad: 0.7, affiliate: 1.8, lead: 1, follower_ltv: 1 },
      articleRewards: [],
      updatedAt: "2026-07-13T00:00:00.000Z"
    };
    const ranked = rankTopicsForProfit(
      [
        topic({ id: "ad", contentStrategy: "chase", primaryMonetizationChannel: "traffic_ad", expectedRevenue: 600 }),
        topic({ id: "cps", contentStrategy: "convert", primaryMonetizationChannel: "affiliate", expectedRevenue: 520 })
      ],
      { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 2, dailyCostCapCny: 100, maxRiskScore: 35, exploreRatio: 0 },
      learning
    );

    expect(ranked[0].topic.id).toBe("cps");
  });

  it("prioritizes fresh realtime topics and ignores learned winners during exploration", () => {
    const learning: StrategyLearningState = {
      sourceWeights: { hot: 0.4, evergreen: 1, series: 2.5, experimental: 1 },
      categoryWeights: { historicalWinner: 2.5, fresh: 0.4 },
      experimentTagWeights: {},
      articleRewards: [],
      updatedAt: "2026-07-13T00:00:00.000Z"
    };
    const ranked = rankTopicsForProfit(
      [
        topic({
          id: "old-winner",
          title: "AI historical winner",
          source: "series",
          category: "historicalWinner",
          expectedRevenue: 600,
          timeliness: 45,
          historicalSimilarity: 95,
          estimatedCost: 10,
          createdAt: "2026-06-01T00:00:00.000Z"
        }),
        topic({
          id: "fresh-hotspot",
          title: "AI fresh realtime hotspot",
          source: "hot",
          category: "fresh",
          expectedRevenue: 520,
          timeliness: 95,
          historicalSimilarity: 5,
          estimatedCost: 10,
          createdAt: "2026-07-13T10:00:00.000Z"
        })
      ],
      { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 1, dailyCostCapCny: 100 },
      learning,
      { policy: explorationPolicy, now: new Date("2026-07-13T12:00:00.000Z") }
    );

    expect(ranked[0].topic.id).toBe("fresh-hotspot");
  });

  it("spreads exploration slots across distinct realtime signals", () => {
    const ranked = rankTopicsForProfit(
      [
        topic({ id: "topic-trend-baidu-summer-chase", title: "AI summer hotspot", expectedRevenue: 700, estimatedCost: 10 }),
        topic({ id: "topic-trend-baidu-summer-convert", title: "AI summer buying guide", expectedRevenue: 680, estimatedCost: 10 }),
        topic({ id: "topic-trend-baidu-movie-chase", title: "AI movie hotspot", expectedRevenue: 500, estimatedCost: 10 })
      ],
      { ...DEFAULT_AUTO_LOOP_CONFIG, dailyArticleLimit: 2, dailyCostCapCny: 100 },
      undefined,
      { policy: explorationPolicy, now: new Date("2026-07-13T12:00:00.000Z") }
    );

    expect(ranked.map((item) => item.topic.id)).toContain("topic-trend-baidu-movie-chase");
    expect(ranked.filter((item) => item.topic.id.includes("trend-baidu-summer"))).toHaveLength(1);
  });
});
