import { describe, expect, it } from "vitest";
import type { ArticlePackage, TopicCandidate } from "./domain";
import {
  reconcileHistoricalWechatObservations,
  type HistoricalWechatObservation
} from "./historical-outcome-reconciler";
import { createEmptyWorkspace } from "./workspace-store";

const existingTopic: TopicCandidate = {
  id: "topic-existing",
  title: "Original topic",
  source: "experimental",
  category: "workplace",
  audience: "workers",
  angle: "practical",
  status: "rejected",
  expectedRevenue: 0,
  timeliness: 0,
  accountFit: 0,
  historicalSimilarity: 0,
  risk: 0,
  estimatedCost: 0,
  saturation: 0,
  createdAt: "2026-06-20T00:00:00.000Z"
};

const existingArticle: ArticlePackage = {
  id: "article-existing",
  topicId: existingTopic.id,
  title: "Original title",
  summary: "Existing draft",
  status: "archived",
  contentPath: "D:\\draft.md",
  coverPath: "D:\\cover.png",
  qualityScore: 80,
  riskScore: 5,
  estimatedCost: 20,
  estimatedRevenue: 0,
  createdAt: "2026-06-20T01:00:00.000Z"
};

const observations: HistoricalWechatObservation[] = [
  {
    id: "20260620-existing",
    titleAtPublish: "Published title",
    publishedAt: "2026-06-20T07:25:00.000Z",
    recordedAt: "2026-07-13T09:00:00.000Z",
    reads: 100,
    revenue: 0,
    observedMetrics: ["reads", "revenue"],
    dataQuality: "partial",
    preferredArticleId: existingArticle.id,
    category: "workplace",
    audience: "new workers",
    angle: "first-month habits",
    contentStrategy: "chase",
    primaryMonetizationChannel: "traffic_ad",
    experimentTag: "mass-pain-point"
  },
  {
    id: "20260621-created",
    titleAtPublish: "Historical emotional article",
    publishedAt: "2026-06-21T02:46:00.000Z",
    recordedAt: "2026-07-13T09:00:00.000Z",
    reads: 36,
    revenue: 0,
    excludedRevenue: 20,
    exclusionReason: "Self-funded test tip; excluded from learning.",
    observedMetrics: ["reads", "revenue"],
    category: "family-emotion",
    audience: "adult children",
    angle: "family expression",
    contentStrategy: "chase",
    primaryMonetizationChannel: "traffic_ad",
    experimentTag: "emotional-relief"
  }
];

describe("reconcileHistoricalWechatObservations", () => {
  it("matches known articles, creates missing historical stubs, and preserves provenance", () => {
    const workspace = createEmptyWorkspace(new Date("2026-07-13T08:00:00.000Z"));
    workspace.topics = [existingTopic];
    workspace.articles = [existingArticle];

    const result = reconcileHistoricalWechatObservations(workspace, observations);

    expect(result.matchedArticleIds).toEqual([existingArticle.id]);
    expect(result.createdArticleIds).toEqual(["article-history-20260621-created"]);
    expect(result.workspace.articles.find((article) => article.id === existingArticle.id)?.status).toBe("published");
    expect(result.workspace.topics.find((topic) => topic.id === existingTopic.id)).toMatchObject({
      status: "approved",
      contentStrategy: "chase",
      primaryMonetizationChannel: "traffic_ad"
    });
    expect(result.outcomes[1]).toMatchObject({
      reads: 36,
      revenue: 0,
      excludedRevenue: 20,
      dataSource: "wechat_admin_observation",
      dataQuality: "partial",
      observedMetrics: ["reads", "revenue"]
    });
  });

  it("is idempotent for generated topics, articles, and publication attempts", () => {
    const first = reconcileHistoricalWechatObservations(createEmptyWorkspace(), [observations[1]]);
    const second = reconcileHistoricalWechatObservations(first.workspace, [observations[1]]);

    expect(second.workspace.topics).toHaveLength(1);
    expect(second.workspace.articles).toHaveLength(1);
    expect(second.workspace.publicationAttempts).toHaveLength(1);
    expect(second.createdArticleIds).toHaveLength(0);
    expect(second.matchedArticleIds).toEqual(["article-history-20260621-created"]);
  });

  it("rejects duplicate observation ids", () => {
    expect(() => reconcileHistoricalWechatObservations(createEmptyWorkspace(), [observations[1], observations[1]]))
      .toThrow("Duplicate historical observation id");
  });
});
