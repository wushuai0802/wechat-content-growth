import { describe, expect, it } from "vitest";
import type { WorkspaceData } from "./workspace-store";
import { createSeedWorkspace } from "./workspace-store";
import { analyzeOperationalLearning } from "./operational-learning";

function workspace(patch: Partial<WorkspaceData>): WorkspaceData {
  return {
    ...createSeedWorkspace(),
    decisionLogs: [],
    publicationAttempts: [],
    articleOutcomes: [],
    riskEvents: [],
    ...patch
  };
}

describe("analyzeOperationalLearning", () => {
  it("turns repeated draft creation failures into an operational improvement", () => {
    const result = analyzeOperationalLearning(workspace({
      decisionLogs: [
        { id: "d1", runId: "r1", type: "create_wechat_draft", targetId: "a1", reason: "draft update failed: image ratio invalid", score: 0, createdAt: "2026-06-19T00:00:00.000Z" },
        { id: "d2", runId: "r1", type: "create_wechat_draft", targetId: "a2", reason: "draft update failed: image ratio invalid", score: 0, createdAt: "2026-06-19T01:00:00.000Z" },
        { id: "d3", runId: "r1", type: "create_wechat_draft", targetId: "a3", reason: "draft update failed: image ratio invalid", score: 0, createdAt: "2026-06-19T02:00:00.000Z" }
      ]
    }));

    expect(result.improvements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        area: "draft_pipeline",
        priority: "high",
        action: expect.stringContaining("preflight")
      })
    ]));
  });

  it("detects missing outcome data as a blocker for profit learning", () => {
    const result = analyzeOperationalLearning(workspace({
      articles: [
        { id: "a1", topicId: "t1", title: "A", summary: "S", status: "published", contentPath: "", coverPath: "", qualityScore: 80, riskScore: 10, estimatedCost: 10, estimatedRevenue: 100, createdAt: "2026-06-19T00:00:00.000Z" },
        { id: "a2", topicId: "t1", title: "B", summary: "S", status: "published", contentPath: "", coverPath: "", qualityScore: 80, riskScore: 10, estimatedCost: 10, estimatedRevenue: 100, createdAt: "2026-06-19T00:00:00.000Z" }
      ],
      articleOutcomes: []
    }));

    expect(result.improvements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        area: "data_loop",
        priority: "high",
        action: expect.stringContaining("outcome import")
      })
    ]));
  });

  it("keeps the system in long-run ready state when logs and outcomes are healthy", () => {
    const result = analyzeOperationalLearning(workspace({
      articles: [
        { id: "a1", topicId: "t1", title: "A", summary: "S", status: "published", contentPath: "", coverPath: "", qualityScore: 82, riskScore: 8, estimatedCost: 10, estimatedRevenue: 100, createdAt: "2026-06-19T00:00:00.000Z" }
      ],
      articleOutcomes: [
        { id: "o1", articleId: "a1", reads: 1000, shares: 20, favorites: 30, newFollowers: 8, unfollows: 1, revenue: 120, cost: 10, riskScore: 5, recordedAt: "2026-06-20T00:00:00.000Z" }
      ],
      decisionLogs: [
        { id: "d1", runId: "r1", type: "select_topic", targetId: "t1", reason: "Selected for projected net profit 90.", score: 100, createdAt: "2026-06-19T00:00:00.000Z" }
      ]
    }));

    expect(result.longRunReady).toBe(true);
    expect(result.blockers).toEqual([]);
  });
});
