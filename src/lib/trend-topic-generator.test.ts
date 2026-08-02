import { describe, expect, it } from "vitest";
import { generateTopicsFromSignals, rankTrendSignals } from "./trend-topic-generator";
import type { TrendSignal, WechatAccount } from "./domain";

const account: WechatAccount = {
  id: "account-main",
  name: "Content Growth Lab",
  appIdMasked: "wx****",
  positioning: "AI tools, productivity systems, content automation",
  audience: "knowledge workers / indie builders / growth operators / normal users",
  status: "connected",
  publishMode: "manual_review",
  monthlyRevenueTarget: 12000,
  monthlyCostCap: 1800,
  followers: 8420,
  owner: "main-account",
  updatedAt: "2026-06-18T06:30:00.000Z"
};

const signals: TrendSignal[] = [
  {
    id: "trend-ai-agent-office",
    title: "AI Agent office automation",
    source: "mock_hot_source",
    url: "https://example.com/ai-agent-office",
    heat: 91,
    growth: 24,
    competition: 42,
    category: "AI",
    keywords: ["AI Agent", "automation", "productivity"],
    observedAt: "2026-06-18T08:00:00.000Z"
  },
  {
    id: "trend-movie-news",
    title: "summer movie box office",
    source: "mock_hot_source",
    url: "https://example.com/movie",
    heat: 96,
    growth: 30,
    competition: 88,
    category: "entertainment",
    keywords: ["movie", "box office"],
    observedAt: "2026-06-18T08:05:00.000Z"
  }
];

describe("trend topic generation", () => {
  it("ranks trend signals by opportunity, not raw heat alone", () => {
    const ranked = rankTrendSignals(signals, new Date("2026-06-18T09:00:00.000Z"));

    expect(ranked[0].id).toBe("trend-ai-agent-office");
    expect(ranked[0].opportunityScore).toBeGreaterThan(ranked[1].opportunityScore);
  });

  it("prefers a newly observed signal when opportunity inputs are otherwise equal", () => {
    const ranked = rankTrendSignals([
      { ...signals[0], id: "trend-old", observedAt: "2026-06-10T09:00:00.000Z" },
      { ...signals[0], id: "trend-fresh", observedAt: "2026-06-18T08:30:00.000Z" }
    ], new Date("2026-06-18T09:00:00.000Z"));

    expect(ranked[0].id).toBe("trend-fresh");
    expect(ranked[0].opportunityScore).toBeGreaterThan(ranked[1].opportunityScore);
  });

  it("generates profit-fit candidate topics from safe trend signals", () => {
    const topics = generateTopicsFromSignals([signals[0]], {
      account,
      existingTopicTitles: [],
      now: new Date("2026-06-18T09:00:00.000Z"),
      limit: 3
    });

    expect(topics).toHaveLength(3);
    expect(topics[0]).toMatchObject({
      id: "topic-trend-ai-agent-office-chase",
      source: "hot",
      status: "candidate",
      experimentTag: "mass-pain-point",
      contentStrategy: "chase",
      primaryMonetizationChannel: "traffic_ad"
    });
    expect(new Set(topics.map((topic) => topic.contentStrategy))).toEqual(new Set(["chase", "manufacture", "convert"]));
    expect(topics[0].accountFit).toBeGreaterThan(60);
    expect(topics[0].expectedRevenue).toBeGreaterThan(topics[0].estimatedCost);
    expect(topics[0].opportunityProfile?.remainingHalfLifeHours).toBeGreaterThan(0);
    expect(topics[0].revenueForecast?.d7.netProfit).toBeGreaterThan(0);
    expect(topics.find((topic) => topic.contentStrategy === "manufacture")?.opportunityProfile?.evidenceReadiness).toBe("needs_research");
    expect(topics.find((topic) => topic.contentStrategy === "convert")?.primaryMonetizationChannel).toBe("affiliate");
  });

  it("turns WeChat public hot article signals into exploratory candidate topics", () => {
    const topics = generateTopicsFromSignals([
      {
        id: "trend-wechat-public-ai-side-income-review",
        title: "普通人开始用 AI 做副业复盘",
        source: "wechat_public",
        url: "https://mp.weixin.qq.com/s/example",
        heat: 88,
        growth: 22,
        competition: 45,
        category: "公众号热门文章",
        keywords: ["AI", "副业", "普通人", "复盘"],
        observedAt: "2026-06-19T10:00:00.000Z"
      }
    ], { account, existingTopicTitles: [], now: new Date("2026-06-19T10:05:00.000Z"), limit: 2 });

    expect(topics).toHaveLength(2);
    expect(topics.every((topic) => ["chase", "manufacture", "convert"].includes(topic.contentStrategy ?? ""))).toBe(true);
    expect(topics[0].title).toContain("AI");
    expect(topics[0].accountFit).toBeGreaterThan(60);
  });

  it("fills the candidate pool breadth-first across distinct realtime signals", () => {
    const broadSignals = Array.from({ length: 20 }, (_, index) => ({
      ...signals[0],
      id: `trend-broad-${index}`,
      title: `Everyday realtime topic ${index}`,
      observedAt: "2026-06-18T08:30:00.000Z"
    }));
    const topics = generateTopicsFromSignals(broadSignals, {
      account,
      existingTopicTitles: [],
      now: new Date("2026-06-18T09:00:00.000Z")
    });

    expect(topics).toHaveLength(30);
    expect(new Set(topics.slice(0, 20).map((topic) => topic.id.replace(/-chase$/, ""))).size).toBe(20);
    expect(topics.slice(0, 20).every((topic) => topic.contentStrategy === "chase")).toBe(true);
  });

  it("does not generate duplicate topics for existing titles", () => {
    const firstBatch = generateTopicsFromSignals([signals[0]], {
      account,
      existingTopicTitles: [],
      now: new Date("2026-06-18T09:00:00.000Z")
    });
    const topics = generateTopicsFromSignals([signals[0]], {
      account,
      existingTopicTitles: [firstBatch[0].title],
      now: new Date("2026-06-18T10:00:00.000Z")
    });

    expect(topics.some((topic) => topic.id === "topic-trend-ai-agent-office-chase")).toBe(false);
    expect(topics.some((topic) => topic.id === "topic-trend-ai-agent-office-manufacture")).toBe(true);
  });

  it("uses richer opportunity fields instead of treating raw heat as profit", () => {
    const [generated] = generateTopicsFromSignals([
      {
        ...signals[0],
        id: "trend-commercial-gap",
        growthRate: 84,
        remainingHalfLifeHours: 48,
        audienceOverlap: 88,
        contentSupplyGap: 81,
        monetizationIntent: 90,
        sharePotential: 72,
        productionLatencyHours: 2,
        policyRisk: 8,
        confidence: 86
      }
    ], { account, existingTopicTitles: [], limit: 1 });

    expect(generated.opportunityProfile).toMatchObject({
      strategy: "chase",
      growthRate: 84,
      audienceOverlap: 88,
      contentSupplyGap: 81,
      monetizationIntent: 90,
      confidence: 86
    });
    expect(generated.revenueForecast?.confidence).toBe(0.86);
  });

  it("does not use account positioning as a topic filter or scoring input", () => {
    const educationAccount: WechatAccount = {
      ...account,
      id: "account-education-description",
      positioning: "安徽高考志愿和专业分析",
      audience: "安徽考生和家长"
    };
    const aiTopics = generateTopicsFromSignals([signals[1]], {
      account,
      existingTopicTitles: [],
      now: new Date("2026-07-13T10:00:00.000Z"),
      limit: 3
    });
    const educationTopics = generateTopicsFromSignals([signals[1]], {
      account: educationAccount,
      existingTopicTitles: [],
      now: new Date("2026-07-13T10:00:00.000Z"),
      limit: 3
    });

    expect(aiTopics).toHaveLength(3);
    expect(educationTopics).toHaveLength(3);
    expect(aiTopics.map((topic) => ({
      title: topic.title,
      accountFit: topic.accountFit,
      profitAudienceFit: topic.profitAudienceFit,
      expectedRevenue: topic.expectedRevenue
    }))).toEqual(educationTopics.map((topic) => ({
      title: topic.title,
      accountFit: topic.accountFit,
      profitAudienceFit: topic.profitAudienceFit,
      expectedRevenue: topic.expectedRevenue
    })));
  });

  it("filters public political trends before topic generation", () => {
    const topics = generateTopicsFromSignals(
      [
        {
          id: "trend-public-political-news",
          title: "political public incident",
          source: "baidu",
          heat: 99,
          growth: 60,
          competition: 20,
          category: "news",
          keywords: ["public policy", "war"],
          observedAt: "2026-06-18T08:00:00.000Z"
        }
      ],
      {
        account,
        existingTopicTitles: [],
        now: new Date("2026-06-18T09:00:00.000Z")
      }
    );

    expect(topics).toHaveLength(0);
  });

  it.each(["高校取消录取资格", "三大指数集体大跌", "A股基金突然暴跌"])(
    "marks admissions or financial signal as high-stakes research: %s",
    (title) => {
      const topics = generateTopicsFromSignals([
        {
          ...signals[0],
          id: `trend-high-stakes-${title}`,
          title,
          category: "实时热点",
          keywords: [title]
        }
      ], { account, existingTopicTitles: [], now: new Date("2026-06-18T09:00:00.000Z"), limit: 3 });

      expect(topics).toHaveLength(3);
      expect(topics.every((topic) => topic.risk >= 55)).toBe(true);
      expect(topics.every((topic) => topic.opportunityProfile?.evidenceReadiness === "needs_research")).toBe(true);
    }
  );

  it.each(["外交动态", "南方暴雨", "台风路径", "洪水汛情", "突发地震", "居民楼火灾", "山区泥石流", "积水中多人施救", "山体滑坡救援", "居民楼爆炸坍塌"])(
    "filters unsafe public-affairs or disaster trend: %s",
    (title) => {
      const topics = generateTopicsFromSignals([
        {
          ...signals[0],
          id: `trend-unsafe-${title}`,
          title,
          category: "实时新闻",
          keywords: [title]
        }
      ], { account, existingTopicTitles: [], now: new Date("2026-06-18T09:00:00.000Z") });

      expect(topics).toHaveLength(0);
    }
  );
});
