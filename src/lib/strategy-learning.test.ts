import { describe, expect, it } from "vitest";
import type { ArticleOutcome, ArticlePackage, RiskEvent } from "./domain";
import type { WorkspaceData } from "./workspace-store";
import { calculateArticleReward, learnContentShapeFromOutcomes, learnStrategyFromWorkspace } from "./strategy-learning";
import { createSeedWorkspace } from "./workspace-store";

function article(patch: Partial<ArticlePackage>): ArticlePackage {
  return {
    id: "article-test",
    topicId: "topic-test",
    title: "Test article",
    summary: "Summary",
    status: "published",
    contentPath: "E:/draft.md",
    coverPath: "E:/cover.png",
    qualityScore: 80,
    riskScore: 10,
    estimatedCost: 30,
    estimatedRevenue: 300,
    createdAt: "2026-06-18T00:00:00.000Z",
    ...patch
  };
}

function outcome(patch: Partial<ArticleOutcome>): ArticleOutcome {
  return {
    id: "outcome-test",
    articleId: "article-test",
    reads: 1000,
    shares: 20,
    favorites: 30,
    newFollowers: 10,
    unfollows: 1,
    revenue: 300,
    cost: 30,
    riskScore: 5,
    recordedAt: "2026-06-18T12:00:00.000Z",
    ...patch
  };
}

describe("strategy learning", () => {
  it("ignores known demo outcomes when updating profit weights", () => {
    const workspace = createSeedWorkspace();
    const demoOnly: WorkspaceData = {
      ...workspace,
      articleOutcomes: [
        outcome({
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
        })
      ],
      riskEvents: []
    };

    const learning = learnStrategyFromWorkspace(demoOnly, new Date("2026-06-18T13:00:00.000Z"));

    expect(learning.articleRewards).toEqual([]);
    expect(learning.sourceWeights).toEqual({ hot: 1, evergreen: 1, series: 1, experimental: 1 });
    expect(learning.categoryWeights).toEqual({});
  });

  it("rewards profitable low-risk articles and penalizes churn and risk", () => {
    const profitable = calculateArticleReward(article({ estimatedCost: 30 }), outcome({ revenue: 300, cost: 30, newFollowers: 12, unfollows: 1, riskScore: 4 }), []);
    const riskyLoss = calculateArticleReward(
      article({ estimatedCost: 80 }),
      outcome({ revenue: 40, cost: 80, newFollowers: 1, unfollows: 9, riskScore: 60 }),
      [{ id: "risk-1", articleId: "article-test", type: "policy_warning", severity: 70, note: "warning", createdAt: "2026-06-18T13:00:00.000Z" }]
    );

    expect(profitable.reward).toBeGreaterThan(250);
    expect(riskyLoss.reward).toBeLessThan(-150);
  });

  it("adds modeled traffic and engagement value without changing real net profit", () => {
    const reward = calculateArticleReward(
      article({ qualityScore: 85 }),
      outcome({
        revenue: 0,
        cost: 20,
        reads: 1000,
        views: 3000,
        likes: 40,
        inLikes: 8,
        comments: 5,
        shares: 5,
        favorites: 10,
        newFollowers: 3,
        unfollows: 0,
        riskScore: 2
      }),
      []
    );

    expect(reward.netProfit).toBe(-20);
    expect(reward.trafficValue).toBeGreaterThan(0);
    expect(reward.engagementValue).toBeGreaterThan(0);
    expect(reward.followerValue).toBe(24);
    expect(reward.modeledGrossValue).toBeGreaterThan(0);
    expect(reward.reward).toBeGreaterThan(reward.netProfit);
  });

  it("uses official revenue as real revenue and metrics as learning signals", () => {
    const reward = calculateArticleReward(
      article({ qualityScore: 88 }),
      outcome({
        revenue: 120,
        cost: 30,
        reads: 2000,
        adImpressions: 1500,
        likes: 35,
        shares: 6,
        favorites: 12,
        newFollowers: 4,
        unfollows: 1,
        riskScore: 2
      }),
      []
    );

    expect(reward.netProfit).toBe(90);
    expect(reward.modeledGrossValue).toBeGreaterThan(120);
    expect(reward.reward).toBeGreaterThan(reward.netProfit);
  });

  it("raises weights for profitable sources and lowers weights for risky loss sources", () => {
    const workspace = createSeedWorkspace();
    const profitableTopic = workspace.topics.find((topic) => topic.source === "hot")!;
    const lossTopic = workspace.topics.find((topic) => topic.source === "experimental")!;
    const profitableArticle = article({ id: "article-profit", topicId: profitableTopic.id, estimatedCost: 20, estimatedRevenue: 500, riskScore: 8 });
    const lossArticle = article({ id: "article-loss", topicId: lossTopic.id, estimatedCost: 90, estimatedRevenue: 80, riskScore: 45 });
    const enriched: WorkspaceData = {
      ...workspace,
      articles: [...workspace.articles, profitableArticle, lossArticle],
      articleOutcomes: [
        outcome({ id: "outcome-profit", articleId: profitableArticle.id, revenue: 520, cost: 20, newFollowers: 30, unfollows: 1, riskScore: 5 }),
        outcome({ id: "outcome-loss", articleId: lossArticle.id, revenue: 30, cost: 90, newFollowers: 0, unfollows: 12, riskScore: 65 })
      ],
      riskEvents: [
        { id: "risk-loss", articleId: lossArticle.id, type: "quality_regression", severity: 50, note: "poor response", createdAt: "2026-06-18T13:00:00.000Z" }
      ]
    };

    const learning = learnStrategyFromWorkspace(enriched);

    expect(learning.sourceWeights.hot).toBeGreaterThan(learning.sourceWeights.experimental);
    expect(learning.articleRewards.find((item) => item.articleId === profitableArticle.id)?.reward).toBeGreaterThan(0);
    expect(learning.articleRewards.find((item) => item.articleId === lossArticle.id)?.reward).toBeLessThan(0);
  });

  it("learns which content experiment tags deserve more batch slots", () => {
    const workspace = createSeedWorkspace();
    const savingTopic = { ...workspace.topics[0], id: "topic-saving", experimentTag: "money-saving" as const, category: "mass-market" };
    const sideTopic = { ...workspace.topics[1], id: "topic-side", experimentTag: "side-income-beginner" as const, category: "mass-market" };
    const savingArticle = article({
      id: "article-saving",
      topicId: savingTopic.id,
      experimentTag: "money-saving",
      estimatedCost: 20,
      estimatedRevenue: 500,
      riskScore: 8
    });
    const sideArticle = article({
      id: "article-side",
      topicId: sideTopic.id,
      experimentTag: "side-income-beginner",
      estimatedCost: 80,
      estimatedRevenue: 80,
      riskScore: 30
    });
    const enriched: WorkspaceData = {
      ...workspace,
      topics: [savingTopic, sideTopic],
      articles: [savingArticle, sideArticle],
      articleOutcomes: [
        outcome({ id: "outcome-saving", articleId: savingArticle.id, revenue: 520, cost: 20, newFollowers: 30, unfollows: 1, riskScore: 5 }),
        outcome({ id: "outcome-side", articleId: sideArticle.id, revenue: 20, cost: 80, newFollowers: 0, unfollows: 8, riskScore: 45 })
      ],
      riskEvents: []
    };

    const learning = learnStrategyFromWorkspace(enriched);

    expect(learning.experimentTagWeights["money-saving"]).toBeGreaterThan(1);
    expect(learning.experimentTagWeights["side-income-beginner"]).toBeLessThan(1);
    expect(learning.articleRewards.find((item) => item.articleId === savingArticle.id)?.experimentTag).toBe("money-saving");
  });

  it("learns content strategy and monetization channel weights from reliable outcomes", () => {
    const workspace = createSeedWorkspace();
    const chaseTopic = {
      ...workspace.topics[0],
      id: "topic-chase-ad",
      contentStrategy: "chase" as const,
      primaryMonetizationChannel: "traffic_ad" as const
    };
    const convertTopic = {
      ...workspace.topics[1],
      id: "topic-convert-cps",
      contentStrategy: "convert" as const,
      primaryMonetizationChannel: "affiliate" as const
    };
    const chaseArticle = article({ id: "article-chase", topicId: chaseTopic.id });
    const convertArticle = article({ id: "article-convert", topicId: convertTopic.id });
    const enriched: WorkspaceData = {
      ...workspace,
      topics: [chaseTopic, convertTopic],
      articles: [chaseArticle, convertArticle],
      articleOutcomes: [
        outcome({
          id: "outcome-chase",
          articleId: chaseArticle.id,
          revenue: 100,
          adRevenue: 100,
          cost: 80,
          newFollowers: 1
        }),
        outcome({
          id: "outcome-convert",
          articleId: convertArticle.id,
          revenue: 620,
          affiliateRevenue: 520,
          adRevenue: 100,
          cost: 40,
          newFollowers: 20
        })
      ],
      riskEvents: []
    };

    const learning = learnStrategyFromWorkspace(enriched);

    expect(learning.contentStrategyWeights?.convert).toBeGreaterThan(learning.contentStrategyWeights?.chase ?? 0);
    expect(learning.monetizationChannelWeights?.affiliate).toBeGreaterThan(learning.monetizationChannelWeights?.traffic_ad ?? 0);
  });

  it("derives next-batch word count and image-density hints from winning outcomes", () => {
    const shape = learnContentShapeFromOutcomes([
      { articleId: "short", reward: 40, wordCount: 800, inlineImageCount: 1, coverStyle: "simple-life" },
      { articleId: "winner", reward: 500, wordCount: 1350, inlineImageCount: 2, coverStyle: "scenario-editorial" },
      { articleId: "long-loss", reward: -80, wordCount: 2600, inlineImageCount: 5, coverStyle: "hardcore-dashboard" }
    ]);

    expect(shape.recommendedWordCount.min).toBeLessThanOrEqual(1200);
    expect(shape.recommendedWordCount.max).toBeGreaterThanOrEqual(1500);
    expect(shape.recommendedInlineImages.reference).toBe(2);
    expect(shape.preferredCoverStyles).toContain("scenario-editorial");
  });
});
