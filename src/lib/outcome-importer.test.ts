import { describe, expect, it } from "vitest";
import { deriveRiskEventsFromOutcomes, parseOutcomeImport } from "./outcome-importer";

describe("parseOutcomeImport", () => {
  it("parses CSV article outcomes", () => {
    const outcomes = parseOutcomeImport([
      "articleId,reads,shares,favorites,newFollowers,unfollows,revenue,cost,riskScore,recordedAt",
      "article-1,1200,30,45,12,1,330,42,8,2026-06-18T12:00:00.000Z"
    ].join("\n"));

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      articleId: "article-1",
      reads: 1200,
      revenue: 330,
      cost: 42,
      riskScore: 8
    });
  });

  it("parses optional traffic and engagement metrics from CSV outcomes", () => {
    const outcomes = parseOutcomeImport([
      "articleId,reads,views,likes,inLikes,comments,adImpressions,adClicks,shares,favorites,newFollowers,unfollows,revenue,cost,riskScore,recordedAt",
      "article-1,1200,3600,80,12,6,2400,18,30,45,12,1,330,42,8,2026-06-18T12:00:00.000Z"
    ].join("\n"));

    expect(outcomes[0]).toMatchObject({
      articleId: "article-1",
      reads: 1200,
      views: 3600,
      likes: 80,
      inLikes: 12,
      comments: 6,
      adImpressions: 2400,
      adClicks: 18
    });
  });

  it("parses optional WeChat monetization revenue breakdowns", () => {
    const outcomes = parseOutcomeImport([
      "articleId,reads,shares,favorites,newFollowers,unfollows,revenue,adRevenue,affiliateRevenue,leadRevenue,followerValueRevenue,cost,riskScore,recordedAt",
      "article-1,5000,80,120,45,3,680,420,180,30,50,75,6,2026-07-13T12:00:00.000Z"
    ].join("\n"));

    expect(outcomes[0]).toMatchObject({
      revenue: 680,
      adRevenue: 420,
      affiliateRevenue: 180,
      leadRevenue: 30,
      followerValueRevenue: 50
    });
  });

  it("parses optional publication attribution fields from CSV outcomes", () => {
    const outcomes = parseOutcomeImport([
      "articleId,reads,shares,favorites,newFollowers,unfollows,revenue,cost,riskScore,recordedAt,publishedAt,titleAtPublish,titleChangedAfterDraft",
      "article-1,1200,30,45,12,1,330,42,8,2026-06-19T12:00:00.000Z,2026-06-19T09:45:00.000Z,发布时标题,true"
    ].join("\n"));

    expect(outcomes[0]).toMatchObject({
      articleId: "article-1",
      publishedAt: "2026-06-19T09:45:00.000Z",
      titleAtPublish: "发布时标题",
      titleChangedAfterDraft: true
    });
  });

  it("parses JSON article outcomes", () => {
    const outcomes = parseOutcomeImport(JSON.stringify([
      {
        articleId: "article-2",
        reads: 800,
        views: 2100,
        likes: 42,
        inLikes: 7,
        comments: 3,
        adImpressions: 1600,
        adClicks: 11,
        shares: 12,
        favorites: 20,
        newFollowers: 4,
        unfollows: 6,
        revenue: 50,
        cost: 80,
        riskScore: 55,
        recordedAt: "2026-06-18T13:00:00.000Z"
      }
    ]));

    expect(outcomes[0]).toMatchObject({
      articleId: "article-2",
      views: 2100,
      likes: 42,
      inLikes: 7,
      comments: 3,
      adImpressions: 1600,
      adClicks: 11,
      unfollows: 6,
      revenue: 50,
      riskScore: 55
    });
  });

  it("parses optional publication attribution fields from JSON outcomes", () => {
    const outcomes = parseOutcomeImport(JSON.stringify([
      {
        articleId: "article-json",
        reads: 900,
        shares: 8,
        favorites: 16,
        newFollowers: 5,
        unfollows: 0,
        revenue: 130,
        cost: 40,
        riskScore: 12,
        recordedAt: "2026-06-19T13:00:00.000Z",
        publishedAt: "2026-06-19T10:15:00.000Z",
        titleAtPublish: "JSON 发布标题",
        titleChangedAfterDraft: false
      }
    ]));

    expect(outcomes[0]).toMatchObject({
      publishedAt: "2026-06-19T10:15:00.000Z",
      titleAtPublish: "JSON 发布标题",
      titleChangedAfterDraft: false
    });
  });

  it("preserves partial metric provenance and excluded self-funded revenue", () => {
    const outcomes = parseOutcomeImport(JSON.stringify([
      {
        articleId: "article-observed",
        reads: 36,
        shares: 0,
        favorites: 0,
        newFollowers: 0,
        unfollows: 0,
        revenue: 0,
        cost: 0,
        riskScore: 0,
        recordedAt: "2026-07-13T09:00:00.000Z",
        observedMetrics: ["reads", "revenue"],
        dataSource: "wechat_admin_observation",
        dataQuality: "partial",
        excludedRevenue: 20,
        exclusionReason: "Self-funded test tip; excluded from learning."
      }
    ]));

    expect(outcomes[0]).toMatchObject({
      observedMetrics: ["reads", "revenue"],
      dataSource: "wechat_admin_observation",
      dataQuality: "partial",
      revenue: 0,
      excludedRevenue: 20,
      exclusionReason: "Self-funded test tip; excluded from learning."
    });
  });

  it("parses observed metrics from CSV without treating missing fields as observed", () => {
    const outcomes = parseOutcomeImport([
      "articleId,reads,shares,favorites,newFollowers,unfollows,revenue,cost,riskScore,recordedAt,observedMetrics,dataSource,dataQuality",
      "article-1,100,0,0,0,0,0,0,0,2026-07-13T09:00:00.000Z,reads|revenue,wechat_admin_observation,partial"
    ].join("\n"));

    expect(outcomes[0]).toMatchObject({
      observedMetrics: ["reads", "revenue"],
      dataSource: "wechat_admin_observation",
      dataQuality: "partial"
    });
  });
});

describe("deriveRiskEventsFromOutcomes", () => {
  it("creates risk events when imported results show policy, churn, or ROI problems", () => {
    const [outcome] = parseOutcomeImport(JSON.stringify([{
      articleId: "article-risky",
      reads: 1000,
      shares: 5,
      favorites: 8,
      newFollowers: 3,
      unfollows: 12,
      revenue: 20,
      cost: 80,
      riskScore: 72,
      recordedAt: "2026-06-18T13:00:00.000Z"
    }]));

    const events = deriveRiskEventsFromOutcomes([outcome], new Date("2026-06-18T13:05:00.000Z"));

    expect(events.map((event) => event.type)).toEqual(["policy_warning", "follower_churn", "low_roi"]);
    expect(events[0]).toMatchObject({
      articleId: "article-risky",
      severity: 72,
      createdAt: "2026-06-18T13:05:00.000Z"
    });
  });
});
