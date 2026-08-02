import { describe, expect, it } from "vitest";
import type { ArticleOutcome, ExperimentRun } from "./domain";
import type { WorkspaceData } from "./workspace-store";
import { createSeedWorkspace } from "./workspace-store";
import { decideDailyArticleLimit } from "./daily-run-planner";

function workspace(overrides?: Partial<WorkspaceData>): WorkspaceData {
  const seed = createSeedWorkspace();
  return {
    ...seed,
    autoLoopConfig: {
      ...seed.autoLoopConfig,
      enabled: true,
      dailyArticleLimit: 3,
      dailyCostCapCny: 160,
      minQualityScore: 70,
      maxRiskScore: 35,
      updatedAt: "2026-06-19T00:00:00.000Z"
    },
    articles: [],
    articleOutcomes: [],
    experimentRuns: [],
    decisionLogs: [],
    publicationAttempts: [],
    riskEvents: [],
    ...overrides
  };
}

function run(overrides?: Partial<ExperimentRun>): ExperimentRun {
  return {
    id: `run-${Math.random().toString(36).slice(2)}`,
    status: "completed",
    mode: "draft_only",
    startedAt: "2026-06-18T08:00:00.000Z",
    completedAt: "2026-06-18T08:05:00.000Z",
    selectedTopicIds: [],
    generatedArticleIds: [],
    wechatDraftArticleIds: [],
    publishedArticleIds: [],
    estimatedCost: 0,
    projectedRevenue: 0,
    projectedNetProfit: 0,
    failureCount: 0,
    summary: "test run",
    ...overrides
  };
}

describe("decideDailyArticleLimit", () => {
  it("reports the current ten-outcome cold start as full realtime exploration", () => {
    const seed = workspace();
    const articles = Array.from({ length: 10 }, (_, index) => ({
      id: `historical-article-${index}`,
      topicId: seed.topics[index % seed.topics.length].id,
      title: `Historical article ${index}`,
      summary: "partial historical observation",
      status: "published" as const,
      contentPath: "draft.md",
      coverPath: "cover.png",
      qualityScore: 80,
      riskScore: 10,
      estimatedCost: 0,
      estimatedRevenue: 0,
      createdAt: "2026-06-18T00:00:00.000Z"
    }));
    const articleOutcomes: ArticleOutcome[] = articles.map((article, index) => ({
      id: `historical-outcome-${index}`,
      articleId: article.id,
      reads: index + 1,
      shares: 0,
      favorites: 0,
      newFollowers: 0,
      unfollows: 0,
      revenue: 0,
      cost: 0,
      riskScore: 0,
      observedMetrics: ["reads", "revenue"],
      dataSource: "wechat_admin_observation",
      dataQuality: "partial",
      recordedAt: "2026-07-13T12:00:00.000Z"
    }));

    const plan = decideDailyArticleLimit({ workspace: workspace({ articles, articleOutcomes }) });

    expect(plan.signals).toMatchObject({
      learningPhase: "explore",
      reliableOutcomeCount: 10,
      effectiveExploreRatio: 1,
      historyWeight: 0
    });
  });

  it("stops when published articles are waiting for imported outcome data", () => {
    const seed = workspace();
    const plan = decideDailyArticleLimit({
      workspace: workspace({
        articles: [
          {
            id: "published-no-outcome",
            topicId: seed.topics[0].id,
            title: "Published no outcome",
            summary: "summary",
            status: "published",
            contentPath: "draft.md",
            coverPath: "cover.png",
            qualityScore: 80,
            riskScore: 10,
            estimatedCost: 10,
            estimatedRevenue: 100,
            createdAt: "2026-06-18T00:00:00.000Z"
          }
        ]
      })
    });

    expect(plan.shouldRun).toBe(false);
    expect(plan.recommendedArticleLimit).toBe(0);
    expect(plan.constraints.some((item) => item.includes("outcome data"))).toBe(true);
  });

  it("keeps generating when old WeChat drafts are still waiting for manual cleanup", () => {
    const seed = workspace();
    const pendingDrafts = Array.from({ length: 6 }, (_, index) => ({
      id: `draft-${index}`,
      topicId: seed.topics[0].id,
      title: `Draft ${index}`,
      summary: "summary",
      status: "wechat_draft" as const,
      contentPath: "draft.md",
      coverPath: "cover.png",
      qualityScore: 80,
      riskScore: 10,
      estimatedCost: 10,
      estimatedRevenue: 100,
      createdAt: "2026-06-18T00:00:00.000Z"
    }));

    const plan = decideDailyArticleLimit({ workspace: workspace({ articles: pendingDrafts }) });

    expect(plan.shouldRun).toBe(true);
    expect(plan.recommendedArticleLimit).toBe(3);
    expect(plan.signals.pendingWechatDrafts).toBe(6);
    expect(plan.constraints.some((item) => item.includes("pending WeChat drafts"))).toBe(false);
  });

  it("reduces volume after repeated recent failures", () => {
    const plan = decideDailyArticleLimit({
      workspace: workspace({
        experimentRuns: [
          run({ startedAt: "2026-06-19T03:00:00.000Z", status: "failed", failureCount: 3 }),
          run({ startedAt: "2026-06-18T03:00:00.000Z", failureCount: 1 }),
          run({ startedAt: "2026-06-17T03:00:00.000Z", failureCount: 1 })
        ]
      })
    });

    expect(plan.shouldRun).toBe(true);
    expect(plan.recommendedArticleLimit).toBeLessThan(3);
    expect(plan.constraints.some((item) => item.includes("recent failures"))).toBe(true);
  });

  it("expands carefully when recent rewards are strong and candidates are available", () => {
    const seed = workspace();
    const plan = decideDailyArticleLimit({
      workspace: workspace({
        topics: [
          ...seed.topics,
          {
            ...seed.topics[0],
            id: "topic-extra-ai-1",
            title: "AI automation checklist for normal office workers",
            expectedRevenue: 620,
            estimatedCost: 20,
            risk: 8,
            saturation: 18
          },
          {
            ...seed.topics[0],
            id: "topic-extra-ai-2",
            title: "AI productivity workflow for beginner creators",
            expectedRevenue: 580,
            estimatedCost: 22,
            risk: 9,
            saturation: 20
          }
        ],
        strategyLearning: {
          sourceWeights: { hot: 1, evergreen: 1, series: 1, experimental: 1 },
          categoryWeights: {},
          experimentTagWeights: {},
          articleRewards: [
            { articleId: "a1", reward: 620, netProfit: 480, trafficValue: 0, engagementValue: 0, followerValue: 0, modeledGrossValue: 480, riskPenalty: 0, followerPenalty: 0 },
            { articleId: "a2", reward: 460, netProfit: 350, trafficValue: 0, engagementValue: 0, followerValue: 0, modeledGrossValue: 350, riskPenalty: 0, followerPenalty: 0 },
            { articleId: "a3", reward: 310, netProfit: 260, trafficValue: 0, engagementValue: 0, followerValue: 0, modeledGrossValue: 260, riskPenalty: 0, followerPenalty: 0 }
          ],
          updatedAt: "2026-06-19T00:00:00.000Z"
        }
      }),
      maxArticleLimit: 5
    });

    expect(plan.shouldRun).toBe(true);
    expect(plan.recommendedArticleLimit).toBeGreaterThan(3);
    expect(plan.recommendedArticleLimit).toBeLessThanOrEqual(5);
  });

  it("does not use known demo outcomes as recent reward signals", () => {
    const plan = decideDailyArticleLimit({
      workspace: workspace({
        articleOutcomes: [
          {
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
          }
        ],
        strategyLearning: {
          sourceWeights: { hot: 1.9, evergreen: 1, series: 1, experimental: 1 },
          categoryWeights: { "百度热搜": 1.9 },
          experimentTagWeights: {},
          articleRewards: [
            { articleId: "article-1", reward: 449, netProfit: 288, trafficValue: 0, engagementValue: 0, followerValue: 0, modeledGrossValue: 330, riskPenalty: 16, followerPenalty: 0 }
          ],
          updatedAt: "2026-06-18T12:05:00.000Z"
        }
      })
    });

    expect(plan.signals.recentAverageReward).toBe(0);
  });

  it("never recommends more articles than the profitable affordable candidate set", () => {
    const seed = workspace();
    const plan = decideDailyArticleLimit({
      workspace: workspace({
        autoLoopConfig: {
          ...seed.autoLoopConfig,
          enabled: true,
          dailyArticleLimit: 5,
          dailyCostCapCny: 45,
          minQualityScore: 70,
          maxRiskScore: 35,
          updatedAt: "2026-06-19T00:00:00.000Z"
        }
      }),
      maxArticleLimit: 5
    });

    expect(plan.recommendedArticleLimit).toBe(1);
    expect(plan.constraints.some((item) => item.includes("affordable candidates"))).toBe(true);
  });
});
