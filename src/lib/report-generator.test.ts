import { describe, expect, it } from "vitest";
import { createSeedWorkspace } from "./workspace-store";
import { generateWeeklyReport } from "./report-generator";

describe("generateWeeklyReport", () => {
  it("summarizes ROI, portfolio, review queue, and suggestions", () => {
    const report = generateWeeklyReport(createSeedWorkspace(), {
      now: new Date("2026-06-18T01:00:00.000Z")
    });

    expect(report.fileName).toBe("weekly-report-2026-06-18.md");
    expect(report.markdown).toContain("# 公众号内容增长周报");
    expect(report.markdown).toContain("净收益：696 CNY");
    expect(report.markdown).toContain("待审阅文章：2");
    expect(report.markdown).toContain("热点：2");
    expect(report.markdown).toContain("本周加码 AI 实操教程");
  });

  it("includes operational learning from work records", () => {
    const workspace = createSeedWorkspace();
    const report = generateWeeklyReport({
      ...workspace,
      decisionLogs: [
        { id: "d1", runId: "r1", type: "create_wechat_draft", targetId: "a1", reason: "image ratio invalid", score: 0, createdAt: "2026-06-19T00:00:00.000Z" },
        { id: "d2", runId: "r1", type: "create_wechat_draft", targetId: "a2", reason: "image ratio invalid", score: 0, createdAt: "2026-06-19T01:00:00.000Z" },
        { id: "d3", runId: "r1", type: "create_wechat_draft", targetId: "a3", reason: "image ratio invalid", score: 0, createdAt: "2026-06-19T02:00:00.000Z" }
      ]
    }, { now: new Date("2026-06-19T03:00:00.000Z") });

    expect(report.markdown).toContain("## Operational Learning");
    expect(report.markdown).toContain("draft_pipeline");
    expect(report.markdown).toContain("preflight");
  });
});
