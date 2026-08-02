import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { WorkspaceData } from "./workspace-store";
import { createSeedWorkspace } from "./workspace-store";
import { runAutoProfitExperiment } from "./experiment-orchestrator";

function workspace(overrides?: Partial<WorkspaceData>): WorkspaceData {
  const seed = createSeedWorkspace();
  return {
    ...seed,
    autoLoopConfig: {
      ...seed.autoLoopConfig,
      enabled: true,
      dailyArticleLimit: 2,
      dailyCostCapCny: 100,
      minQualityScore: 70,
      maxRiskScore: 35,
      updatedAt: "2026-06-18T00:00:00.000Z"
    },
    articles: [],
    experimentRuns: [],
    decisionLogs: [],
    strategySnapshots: [],
    ...overrides
  };
}

function safeMarkdown(title = "AI 内容工作流如何做周复盘"): string {
  return [
    `# ${title}`,
    "",
    "这是一篇面向知识工作者和内容运营者的实践文章，重点解决如何把 AI 工具接入日常工作流，而不是追逐热点本身。文章会给出可执行步骤、复盘指标和风险边界，方便读者直接小范围试用。内容不承诺收益，也不包含内部评分信息。今天我们先从低风险、可验证、容易复盘的场景开始。这样做的价值在于减少重复劳动，同时保留人工判断。读者可以用一周时间观察效果，再决定是否扩大到更多任务。整个流程强调记录、核对和迭代。只有当效率提升能被数据证明时，才值得继续投入更多成本。这个思路适合个人创作者、小团队和正在搭建自动化系统的运营人员。文章避免使用未经验证的案例，也不把工具能力包装成万能方案。读者读完后应该能得到一套清晰的行动清单。最小可行实验比一次性重构全部流程更稳。",

    "",
    "## 适用场景",
    "会议纪要、选题收集、素材归档和周报整理都适合先做自动化试验。",
    "",
    "## 操作步骤",
    "1. 先选择一个重复发生且风险较低的任务。",
    "2. 写下当前人工处理耗时和常见错误。",
    "3. 用 AI 生成初稿或结构化结果，再人工核对关键事实。",
    "4. 连续记录三次结果，再决定是否扩大使用。",
    "",
    "## 注意事项",
    "不要上传隐私、合同、客户资料或未公开业务信息。所有自动化输出都需要在发布或同步前做人工核对。",
    "",
    "## 复盘指标",
    "重点记录节省时间、返工次数、输出稳定性和团队接受度。"

  ].join("\n");
}

function writeTempDraft(name: string, markdown = safeMarkdown()): string {
  const draftDir = join(tmpdir(), `wechat-content-growth-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(draftDir, { recursive: true });
  const contentPath = join(draftDir, name);
  writeFileSync(contentPath, markdown, "utf8");
  return contentPath;
}
describe("runAutoProfitExperiment", () => {
  it("returns a stopped result when the loop is disabled", async () => {
    const result = await runAutoProfitExperiment({
      workspace: workspace({ autoLoopConfig: { ...createSeedWorkspace().autoLoopConfig, enabled: false } }),
      now: new Date("2026-06-18T12:00:00.000Z")
    });

    expect(result.run.status).toBe("stopped");
    expect(result.decisionLogs[0]?.type).toBe("stop_loop");
  });

  it("selects profitable topics and generates drafts", async () => {
    const result = await runAutoProfitExperiment({
      workspace: workspace(),
      now: new Date("2026-06-18T12:00:00.000Z"),
      generateDraft: (topicId, current) => ({
        ...current,
        articles: [
          ...current.articles,
          {
            id: `article-${topicId}`,
            topicId,
            title: `Article ${topicId}`,
            summary: "summary",
            status: "review",
            contentPath: writeTempDraft(`${topicId}.md`),
            coverPath: "cover.png",
            qualityScore: 80,
            riskScore: 10,
            estimatedCost: 5,
            estimatedRevenue: 100,
            createdAt: "2026-06-18T12:00:00.000Z"
          }
        ]
      })
    });

    expect(result.run.status).toBe("completed");
    expect(result.run.selectedTopicIds).toHaveLength(2);
    expect(result.run.generatedArticleIds).toHaveLength(2);
    expect(result.workspace.articles.every((article) => article.status === "approved")).toBe(true);
    expect(result.workspace.articles.every((article) => article.qualityAssessment?.passed)).toBe(true);
    expect(result.workspace.articles.every((article) => article.qualityScore === article.qualityAssessment?.score)).toBe(true);
    expect(result.decisionLogs.some((log) => log.type === "select_topic")).toBe(true);
    expect(result.decisionLogs.some((log) => log.type === "approve_article")).toBe(true);
  });

  it("creates WeChat drafts when a draft dependency is provided", async () => {
    const result = await runAutoProfitExperiment({
      workspace: workspace(),
      now: new Date("2026-06-18T12:00:00.000Z"),
      generateDraft: (topicId, current) => ({
        ...current,
        articles: [
          ...current.articles,
          {
            id: `article-${topicId}`,
            topicId,
            title: `Article ${topicId}`,
            summary: "summary",
            status: "review",
            contentPath: writeTempDraft(`${topicId}.md`),
            coverPath: "cover.png",
            qualityScore: 80,
            riskScore: 10,
            estimatedCost: 5,
            estimatedRevenue: 100,
            createdAt: "2026-06-18T12:00:00.000Z"
          }
        ]
      }),
      createWechatDraft: async (articleId, current) => ({
        workspace: {
          ...current,
          articles: current.articles.map((article) =>
            article.id === articleId ? { ...article, status: "wechat_draft" } : article
          )
        },
        draftId: `draft-${articleId}`
      })
    });

    expect(result.run.wechatDraftArticleIds).toHaveLength(2);
    expect(result.workspace.articles.every((article) => article.status === "wechat_draft")).toBe(true);
    expect(result.decisionLogs.some((log) => log.type === "create_wechat_draft")).toBe(true);
  });

  it("logs failed draft creation without aborting the whole run", async () => {
    const result = await runAutoProfitExperiment({
      workspace: workspace(),
      now: new Date("2026-06-18T12:00:00.000Z"),
      generateDraft: (topicId, current) => ({
        ...current,
        articles: [
          ...current.articles,
          {
            id: `article-${topicId}`,
            topicId,
            title: `Article ${topicId}`,
            summary: "summary",
            status: "review",
            contentPath: writeTempDraft(`${topicId}.md`),
            coverPath: "cover.png",
            qualityScore: 80,
            riskScore: 10,
            estimatedCost: 5,
            estimatedRevenue: 100,
            createdAt: "2026-06-18T12:00:00.000Z"
          }
        ]
      }),
      createWechatDraft: async () => {
        throw new Error("wechat unavailable");
      }
    });

    expect(result.run.failureCount).toBeGreaterThan(0);
    expect(result.decisionLogs.some((log) => log.type === "create_wechat_draft" && log.score === 0)).toBe(true);
  });

  it("blocks unsafe generated content before creating a WeChat draft", async () => {
    const draftDir = join(tmpdir(), `wechat-content-gate-${Date.now()}`);
    mkdirSync(draftDir, { recursive: true });
    const contentPath = join(draftDir, "unsafe.md");
    writeFileSync(
      contentPath,
      [
        "# 习近平给新华社老党员张连生回信：公众号运营者该怎么判断机会",
        "",
        "## 正文草稿",
        "这类公共政治热点不应该进入真实收益实验草稿箱。",
        "",
        "## 收益假设",
        "本选题预估收益 636 CNY。",
        "",
        "## 审阅提示",
        "发布前建议人工检查。"
      ].join("\n"),
      "utf8"
    );
    let draftCalls = 0;

    const result = await runAutoProfitExperiment({
      workspace: workspace({ autoLoopConfig: { ...workspace().autoLoopConfig, dailyArticleLimit: 1 } }),
      now: new Date("2026-06-18T12:00:00.000Z"),
      generateDraft: (topicId, current) => ({
        ...current,
        articles: [
          ...current.articles,
          {
            id: `article-${topicId}`,
            topicId,
            title: "习近平给新华社老党员张连生回信：公众号运营者该怎么判断机会",
            summary: "summary",
            status: "review",
            contentPath,
            coverPath: "cover.png",
            qualityScore: 95,
            riskScore: 1,
            estimatedCost: 5,
            estimatedRevenue: 100,
            createdAt: "2026-06-18T12:00:00.000Z"
          }
        ]
      }),
      createWechatDraft: async (articleId, current) => {
        draftCalls += 1;
        return { workspace: current, draftId: `draft-${articleId}` };
      }
    });

    expect(draftCalls).toBe(0);
    expect(result.run.wechatDraftArticleIds).toHaveLength(0);
    expect(result.decisionLogs.some((log) => log.type === "skip_topic" && log.reason.includes("Content quality gate blocked"))).toBe(true);
  });

  it("approves exploratory articles when content quality passes even if topic similarity is low", async () => {
    const contentPath = writeTempDraft("explore.md");
    const lowSimilarityTopic = {
      ...workspace().topics[0],
      id: "topic-explore-mass",
      title: "AI phone file cleanup for normal users",
      source: "experimental" as const,
      category: "mass-market productivity",
      audience: "office workers / students / family users",
      angle: "everyday pain point story plus simple checklist",
      expectedRevenue: 500,
      accountFit: 82,
      historicalSimilarity: 30,
      risk: 10,
      estimatedCost: 10,
      saturation: 30
    };

    const result = await runAutoProfitExperiment({
      workspace: workspace({
        topics: [lowSimilarityTopic],
        autoLoopConfig: { ...workspace().autoLoopConfig, dailyArticleLimit: 1, dailyCostCapCny: 100 }
      }),
      now: new Date("2026-06-18T12:00:00.000Z"),
      generateDraft: (_topicId, current) => ({
        ...current,
        articles: [
          ...current.articles,
          {
            id: "article-explore",
            topicId: "topic-explore-mass",
            title: "AI phone file cleanup for normal users",
            summary: "A normal-user phone cleanup article.",
            status: "review" as const,
            contentPath,
            coverPath: "cover.png",
            qualityScore: 56,
            riskScore: 10,
            estimatedCost: 10,
            estimatedRevenue: 500,
            createdAt: "2026-06-18T12:00:00.000Z"
          }
        ]
      }),
      createWechatDraft: async (articleId, current) => ({ workspace: current, draftId: `draft-${articleId}` })
    });

    expect(result.run.wechatDraftArticleIds).toEqual(["article-explore"]);
    expect(result.decisionLogs.some((log) => log.type === "approve_article" && log.targetId === "article-explore")).toBe(true);
  });

  it("supports async draft generation and logs generation failures", async () => {
    const result = await runAutoProfitExperiment({
      workspace: workspace({ autoLoopConfig: { ...workspace().autoLoopConfig, dailyArticleLimit: 1 } }),
      now: new Date("2026-06-18T12:00:00.000Z"),
      generateDraft: async (topicId, current) => {
        if (topicId) {
          throw new Error("CPA timeout");
        }
        return current;
      }
    });

    expect(result.run.generatedArticleIds).toHaveLength(0);
    expect(result.run.failureCount).toBe(1);
    expect(result.decisionLogs.some((log) => log.type === "generate_article" && log.reason.includes("CPA timeout"))).toBe(true);
  });

  it("blocks the next run when published articles are missing outcome data", async () => {
    const seed = workspace();
    const result = await runAutoProfitExperiment({
      workspace: {
        ...seed,
        articles: [
          {
            id: "published-missing-outcome",
            topicId: seed.topics[0].id,
            title: "Published article without outcome",
            summary: "summary",
            status: "published",
            contentPath: writeTempDraft("published.md"),
            coverPath: "cover.png",
            qualityScore: 80,
            riskScore: 10,
            estimatedCost: 10,
            estimatedRevenue: 100,
            createdAt: "2026-06-18T12:00:00.000Z"
          }
        ],
        articleOutcomes: []
      },
      now: new Date("2026-06-19T00:00:00.000Z")
    });

    expect(result.run.status).toBe("stopped");
    expect(result.run.selectedTopicIds).toHaveLength(0);
    expect(result.decisionLogs.some((log) => log.type === "stop_loop" && log.reason.includes("outcome data"))).toBe(true);
  });
});
