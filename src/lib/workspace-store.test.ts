import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ArticleOutcome, PublicationAttempt, RiskEvent, TrendSignal } from "./domain";
import { createSeedWorkspace, createWorkspaceStore } from "./workspace-store";

const tempDirs: string[] = [];

function tempDataFile() {
  const dir = mkdtempSync(join(tmpdir(), "wechat-content-growth-"));
  tempDirs.push(dir);
  return join(dir, "nested", "workspace.json");
}

function tempOutputDir() {
  const dir = mkdtempSync(join(tmpdir(), "wechat-content-growth-output-"));
  tempDirs.push(dir);
  return dir;
}

const importedSignals: TrendSignal[] = [
  {
    id: "trend-ai-agent-office",
    title: "AI Agent 办公自动化",
    source: "mock_hot_source",
    heat: 91,
    growth: 24,
    competition: 42,
    category: "人工智能",
    keywords: ["AI Agent", "办公自动化", "效率工具"],
    observedAt: "2026-06-18T08:00:00.000Z"
  }
];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("createWorkspaceStore", () => {
  it("blocks approval while the editorial voice assessment is below threshold", () => {
    const dataFile = tempDataFile();
    mkdirSync(dirname(dataFile), { recursive: true });
    const workspace = createSeedWorkspace();
    const article = {
      ...workspace.articles[0],
      status: "review" as const,
      editorialVoiceAssessment: {
        passed: false,
        score: 64,
        metrics: {
          sentenceLengthStdDev: 7,
          paragraphLengthStdDev: 15,
          shortSentenceCount: 0,
          longSentenceCount: 0,
          templatePhraseCount: 2,
          formulaicEnumerationCount: 4,
          explicitStanceCount: 0,
          qualificationCount: 0,
          sourceAnchorCount: 0,
          formulaicEndingCount: 1,
          paragraphCount: 8,
          sentenceCount: 12
        },
        reasons: ["文章仍然过于模板化。"],
        evaluatedAt: "2026-07-15T00:00:00.000Z"
      }
    };
    writeFileSync(dataFile, `${JSON.stringify({ ...workspace, articles: [article] }, null, 2)}\n`, "utf8");
    const store = createWorkspaceStore({ dataFile });

    expect(() => store.applyArticleAction(article.id, "approve")).toThrow(
      "Article editorial voice assessment did not pass: 64"
    );
  });

  it("initializes a missing workspace file from seed data", () => {
    const store = createWorkspaceStore({ dataFile: tempDataFile() });
    const workspace = store.getWorkspace();

    expect(workspace.articles.length).toBe(4);
    expect(workspace.topics.length).toBe(6);
    expect(workspace.suggestions.length).toBe(4);
    expect(workspace.accounts[0]?.name).toBe("内容增长实验室");
  });

  it("reads workspace JSON files that include a UTF-8 BOM", () => {
    const dataFile = tempDataFile();
    mkdirSync(dirname(dataFile), { recursive: true });
    writeFileSync(
      dataFile,
      `\uFEFF${JSON.stringify({ ...createWorkspaceStore({ dataFile: tempDataFile() }).getWorkspace(), topics: [] })}`,
      "utf8"
    );

    const workspace = createWorkspaceStore({ dataFile }).getWorkspace();

    expect(workspace.topics).toHaveLength(0);
  });

  it("persists article actions to disk", () => {
    const dataFile = tempDataFile();
    const store = createWorkspaceStore({ dataFile });

    store.applyArticleAction("article-1", "approve");

    const reloaded = createWorkspaceStore({ dataFile }).getWorkspace();
    expect(reloaded.articles.find((article) => article.id === "article-1")?.status).toBe("approved");
  });

  it("persists suggestion decisions to disk", () => {
    const dataFile = tempDataFile();
    const store = createWorkspaceStore({ dataFile });

    store.applySuggestionAction("suggestion-1", "accept");

    const reloaded = createWorkspaceStore({ dataFile }).getWorkspace();
    expect(reloaded.suggestions.some((suggestion) => suggestion.id === "suggestion-1")).toBe(false);
  });

  it("resets persisted state back to seed data", () => {
    const dataFile = tempDataFile();
    const store = createWorkspaceStore({ dataFile });

    store.applyArticleAction("article-1", "approve");
    store.applySuggestionAction("suggestion-1", "accept");
    const reset = store.resetWorkspace();

    expect(reset.articles).toEqual([]);
    expect(reset.topics).toEqual([]);
    expect(reset.suggestions).toEqual([]);
    expect(reset.revenue).toEqual([]);
    expect(reset.costs).toEqual([]);
    expect(reset.metrics).toEqual([]);
    expect(reset.accounts[0]?.name).toBe("未配置公众号");
  });

  it("generates a draft article and persists it", () => {
    const dataFile = tempDataFile();
    const outputDir = tempOutputDir();
    const store = createWorkspaceStore({ dataFile, draftDir: outputDir, coverDir: outputDir });

    const updated = store.generateDraftFromTopic("topic-hot-1");

    expect(updated.articles).toHaveLength(5);
    expect(updated.articles[4].topicId).toBe("topic-hot-1");
    expect(updated.articles[4].status).toBe("review");
    expect(updated.articles[4].contentPath).toContain(outputDir);
  });

  it("plans article-specific raster visuals without writing publishable placeholders", () => {
    const dataFile = tempDataFile();
    const outputDir = tempOutputDir();
    const store = createWorkspaceStore({ dataFile, draftDir: outputDir, coverDir: outputDir, inlineImageDir: outputDir });

    const firstWorkspace = store.generateDraftFromTopic("topic-hot-1");
    const secondWorkspace = store.generateDraftFromTopic("topic-hot-2");
    const firstArticle = firstWorkspace.articles.at(-1)!;
    const secondArticle = secondWorkspace.articles.at(-1)!;

    expect(firstArticle.coverPath).toContain(outputDir);
    expect(secondArticle.coverPath).toContain(outputDir);
    expect(existsSync(firstArticle.coverPath)).toBe(false);
    expect(existsSync(secondArticle.coverPath)).toBe(false);
    expect(firstArticle.visualPlan?.status).toBe("planned");
    expect(secondArticle.visualPlan?.status).toBe("planned");
    expect(firstArticle.visualPlan?.assets[0].prompt).not.toBe(secondArticle.visualPlan?.assets[0].prompt);
    expect(firstArticle.visualPlan?.assets.every((asset) => asset.status === "planned")).toBe(true);
  });

  it("imports trend signals and persists generated candidate topics", () => {
    const dataFile = tempDataFile();
    const store = createWorkspaceStore({ dataFile });

    const updated = store.refreshTrendSignals(importedSignals, { now: new Date("2026-06-18T09:00:00.000Z") });

    expect(updated.trendSignals).toHaveLength(1);
    expect(updated.topics.some((topic) => topic.id === "topic-trend-ai-agent-office-chase")).toBe(true);
    expect(updated.topics.filter((topic) => topic.id.startsWith("topic-trend-ai-agent-office-"))).toHaveLength(3);

    const reloaded = createWorkspaceStore({ dataFile }).getWorkspace();
    expect(reloaded.trendSignals[0]?.title).toBe("AI Agent 办公自动化");
    expect(reloaded.topics.some((topic) => topic.id === "topic-trend-ai-agent-office-chase")).toBe(true);
  });

  it("does not duplicate generated topics when refreshing the same trend signal", () => {
    const store = createWorkspaceStore({ dataFile: tempDataFile() });

    store.refreshTrendSignals(importedSignals, { now: new Date("2026-06-18T09:00:00.000Z") });
    const updated = store.refreshTrendSignals(importedSignals, { now: new Date("2026-06-18T10:00:00.000Z") });

    expect(updated.topics.filter((topic) => topic.id.startsWith("topic-trend-ai-agent-office-"))).toHaveLength(3);
  });

  it("does not inject mock trend signals into an empty persisted workspace", () => {
    const dataFile = tempDataFile();
    const store = createWorkspaceStore({ dataFile });
    const emptyWorkspace = {
      ...store.getWorkspace(),
      topics: [],
      trendSignals: [],
      articles: [],
      costs: [],
      revenue: [],
      metrics: [],
      suggestions: [],
      accounts: []
    };
    writeFileSync(dataFile, JSON.stringify(emptyWorkspace), "utf8");

    const updated = createWorkspaceStore({ dataFile }).refreshTrendSignals();

    expect(updated.trendSignals).toHaveLength(0);
    expect(updated.topics).toHaveLength(0);
  });

  it("reads article detail with Markdown content", () => {
    const dataFile = tempDataFile();
    const outputDir = tempOutputDir();
    const store = createWorkspaceStore({ dataFile, draftDir: outputDir, coverDir: outputDir });
    const workspace = store.generateDraftFromTopic("topic-hot-1");
    const article = workspace.articles.at(-1);
    expect(article).toBeDefined();

    const detail = store.getArticleDetail(article!.id);

    expect(detail?.article.id).toBe(article!.id);
    expect(detail?.markdown).toContain(article!.title);
  });

  it("updates article detail metadata and Markdown content", () => {
    const dataFile = tempDataFile();
    const outputDir = tempOutputDir();
    const store = createWorkspaceStore({ dataFile, draftDir: outputDir, coverDir: outputDir });
    const workspace = store.generateDraftFromTopic("topic-hot-1");
    const article = workspace.articles.at(-1)!;
    writeFileSync(article.contentPath, "# 旧正文", "utf8");

    const updated = store.updateArticleDetail(article.id, {
      title: "编辑后的标题",
      summary: "编辑后的摘要",
      markdown: "# 编辑后的标题\n\n正文已修改"
    });

    expect(updated?.article.title).toBe("编辑后的标题");
    expect(updated?.article.summary).toBe("编辑后的摘要");
    expect(readFileSync(article.contentPath, "utf8")).toBe("# 编辑后的标题\n\n正文已修改");
    expect(updated?.article.qualityAssessment?.passed).toBe(false);
    expect(updated?.article.qualityScore).toBe(updated?.article.qualityAssessment?.score);
    expect(updated?.article.visualPlan?.status).toBe("planned");
    expect(updated?.article.visualPlan?.assets[0].prompt).toContain("编辑后的标题");
    expect(updated?.article.visualPlan?.assets[0].prompt).not.toContain(article.title);

    const reloaded = createWorkspaceStore({ dataFile }).getWorkspace();
    expect(reloaded.articles.find((item) => item.id === article.id)?.title).toBe("编辑后的标题");
    expect(reloaded.articles.find((item) => item.id === article.id)?.qualityAssessment?.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining("过短")])
    );
  });

  it("preserves an explicitly generated visual plan when saving image Markdown", () => {
    const dataFile = tempDataFile();
    const outputDir = tempOutputDir();
    const store = createWorkspaceStore({ dataFile, draftDir: outputDir, coverDir: outputDir });
    const workspace = store.generateDraftFromTopic("topic-hot-1");
    const article = workspace.articles.at(-1)!;
    const visualPlan = {
      ...article.visualPlan!,
      status: "needs_visual_review" as const,
      assets: article.visualPlan!.assets.map((asset) => ({
        ...asset,
        status: "failed" as const,
        error: "image provider timeout"
      }))
    };

    const updated = store.updateArticleDetail(article.id, {
      markdown: `# ${article.title}\n\n正文已插入图片标记`,
      visualPlan
    });

    expect(updated?.article.visualPlan?.status).toBe("needs_visual_review");
    expect(updated?.article.visualPlan?.assets[0]).toMatchObject({
      status: "failed",
      error: "image provider timeout"
    });
  });

  it("backfills experiment fields for old workspace JSON", () => {
    const dataFile = tempDataFile();
    const store = createWorkspaceStore({ dataFile });
    const oldWorkspace = store.getWorkspace();
    const {
      autoLoopConfig: _config,
      experimentRuns: _runs,
      decisionLogs: _logs,
      strategySnapshots: _snapshots,
      publicationAttempts: _attempts,
      articleOutcomes: _outcomes,
      riskEvents: _risks,
      strategyLearning: _learning,
      ...legacy
    } = oldWorkspace;
    writeFileSync(dataFile, JSON.stringify(legacy), "utf8");

    const reloaded = createWorkspaceStore({ dataFile }).getWorkspace();

    expect(reloaded.autoLoopConfig.enabled).toBe(false);
    expect(reloaded.experimentRuns).toEqual([]);
    expect(reloaded.decisionLogs).toEqual([]);
    expect(reloaded.strategySnapshots).toEqual([]);
    expect(reloaded.publicationAttempts).toEqual([]);
    expect(reloaded.articleOutcomes).toEqual([]);
    expect(reloaded.riskEvents).toEqual([]);
    expect(reloaded.strategyLearning.sourceWeights.hot).toBe(1);
  });

  it("persists experiment run results", () => {
    const dataFile = tempDataFile();
    const store = createWorkspaceStore({ dataFile });
    const workspace = store.getWorkspace();
    const now = "2026-06-18T12:00:00.000Z";

    store.saveExperimentRunResult({
      workspace,
      run: {
        id: "run-1",
        status: "completed",
        mode: "draft_only",
        startedAt: now,
        completedAt: now,
        selectedTopicIds: ["topic-hot-1"],
        generatedArticleIds: [],
        wechatDraftArticleIds: [],
        publishedArticleIds: [],
        estimatedCost: 10,
        projectedRevenue: 100,
        projectedNetProfit: 90,
        failureCount: 0,
        summary: "completed"
      },
      decisionLogs: [{
        id: "decision-1",
        runId: "run-1",
        type: "select_topic",
        targetId: "topic-hot-1",
        reason: "highest projected profit",
        score: 100,
        createdAt: now
      }],
      strategySnapshot: {
        id: "strategy-1",
        runId: "run-1",
        objective: "maximize_net_profit",
        topicWeights: { hot: 1, evergreen: 0.7, series: 0.6, experimental: 0.5 },
        riskPolicy: "max risk 35",
        budgetPolicy: "cap 30 CNY",
        createdAt: now
      }
    });

    const summary = createWorkspaceStore({ dataFile }).getExperimentSummary();

    expect(summary.latestRun?.id).toBe("run-1");
    expect(summary.recentDecisions[0]?.id).toBe("decision-1");
    expect(summary.latestStrategy?.id).toBe("strategy-1");
  });

  it("stops the auto loop and marks active runs stopped", () => {
    const dataFile = tempDataFile();
    const store = createWorkspaceStore({ dataFile });
    const workspace = store.getWorkspace();
    const now = "2026-06-18T12:00:00.000Z";
    store.saveExperimentRunResult({
      workspace: { ...workspace, autoLoopConfig: { ...workspace.autoLoopConfig, enabled: true } },
      run: {
        id: "run-active",
        status: "running",
        mode: "draft_only",
        startedAt: now,
        selectedTopicIds: [],
        generatedArticleIds: [],
        wechatDraftArticleIds: [],
        publishedArticleIds: [],
        estimatedCost: 0,
        projectedRevenue: 0,
        projectedNetProfit: 0,
        failureCount: 0,
        summary: "running"
      },
      decisionLogs: [],
      strategySnapshot: {
        id: "strategy-active",
        runId: "run-active",
        objective: "maximize_net_profit",
        topicWeights: { hot: 1, evergreen: 0.7, series: 0.6, experimental: 0.5 },
        riskPolicy: "max risk 35",
        budgetPolicy: "cap 30 CNY",
        createdAt: now
      }
    });

    const stopped = createWorkspaceStore({ dataFile }).stopAutoLoop(new Date("2026-06-18T12:05:00.000Z"));

    expect(stopped.autoLoopConfig.enabled).toBe(false);
    expect(stopped.experimentRuns[0].status).toBe("stopped");
    expect(stopped.experimentRuns[0].completedAt).toBe("2026-06-18T12:05:00.000Z");
  });

  it("records article outcomes and recomputes strategy learning", () => {
    const dataFile = tempDataFile();
    const store = createWorkspaceStore({ dataFile });
    const outcome: ArticleOutcome = {
      id: "outcome-article-1",
      articleId: "article-1",
      reads: 5000,
      shares: 120,
      favorites: 220,
      newFollowers: 60,
      unfollows: 2,
      revenue: 700,
      cost: 42,
      riskScore: 5,
      recordedAt: "2026-06-18T13:00:00.000Z"
    };

    const updated = store.recordArticleOutcomes([outcome], new Date("2026-06-18T13:05:00.000Z"));

    expect(updated.articleOutcomes).toHaveLength(1);
    expect(updated.strategyLearning.articleRewards[0]?.articleId).toBe("article-1");
    expect(updated.strategyLearning.sourceWeights.hot).toBeGreaterThan(1);
  });

  it("keeps known demo outcomes out of recomputed strategy learning", () => {
    const dataFile = tempDataFile();
    const store = createWorkspaceStore({ dataFile });
    const outcome: ArticleOutcome = {
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
    };

    const updated = store.recordArticleOutcomes([outcome], new Date("2026-06-18T13:05:00.000Z"));

    expect(updated.articleOutcomes).toHaveLength(1);
    expect(updated.strategyLearning.articleRewards).toEqual([]);
    expect(updated.strategyLearning.sourceWeights.hot).toBe(1);
  });

  it("records publication attempts", () => {
    const dataFile = tempDataFile();
    const store = createWorkspaceStore({ dataFile });
    const attempt: PublicationAttempt = {
      id: "pub-1",
      articleId: "article-1",
      status: "draft_created",
      channel: "wechat",
      draftId: "media-1",
      createdAt: "2026-06-18T13:00:00.000Z"
    };

    const updated = store.recordPublicationAttempt(attempt);

    expect(updated.publicationAttempts[0]).toEqual(attempt);
  });

  it("rejects stale whole-workspace writes instead of losing a concurrent update", () => {
    const dataFile = tempDataFile();
    const firstStore = createWorkspaceStore({ dataFile });
    const staleWorkspace = firstStore.getWorkspace();
    createWorkspaceStore({ dataFile }).applySuggestionAction("suggestion-1", "accept");

    expect(() => firstStore.saveExperimentRunResult({
      workspace: staleWorkspace,
      run: {
        id: "run-stale",
        status: "completed",
        mode: "draft_only",
        startedAt: "2026-06-18T12:00:00.000Z",
        completedAt: "2026-06-18T12:00:00.000Z",
        selectedTopicIds: [],
        generatedArticleIds: [],
        wechatDraftArticleIds: [],
        publishedArticleIds: [],
        estimatedCost: 0,
        projectedRevenue: 0,
        projectedNetProfit: 0,
        failureCount: 0,
        summary: "stale"
      },
      decisionLogs: [],
      strategySnapshot: {
        id: "strategy-stale",
        runId: "run-stale",
        objective: "maximize_net_profit",
        topicWeights: { hot: 1, evergreen: 1, series: 1, experimental: 1 },
        riskPolicy: "test",
        budgetPolicy: "test",
        createdAt: "2026-06-18T12:00:00.000Z"
      }
    })).toThrow("Workspace changed concurrently");
  });

  it("records risk events and keeps strategy learning current", () => {
    const dataFile = tempDataFile();
    const store = createWorkspaceStore({ dataFile });
    const outcome: ArticleOutcome = {
      id: "outcome-risky",
      articleId: "article-1",
      reads: 1000,
      shares: 8,
      favorites: 12,
      newFollowers: 3,
      unfollows: 11,
      revenue: 20,
      cost: 80,
      riskScore: 70,
      recordedAt: "2026-06-18T14:00:00.000Z"
    };
    const riskEvent: RiskEvent = {
      id: "risk-outcome-risky-low-roi",
      articleId: "article-1",
      type: "low_roi",
      severity: 75,
      note: "Imported outcome produced negative net profit.",
      createdAt: "2026-06-18T14:05:00.000Z"
    };

    const updated = store.recordArticleOutcomes([outcome], new Date("2026-06-18T14:05:00.000Z"), [riskEvent]);

    expect(updated.riskEvents).toEqual([riskEvent]);
    expect(updated.strategyLearning.articleRewards[0]?.riskPenalty).toBeGreaterThan(0);
  });

});
