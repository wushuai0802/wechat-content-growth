import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  AutoLoopConfig,
  ArticleOutcome,
  ContentExperimentTag,
  DecisionLog,
  ExperimentRun,
  ArticleMetrics,
  ArticlePackage,
  CostRecord,
  PublicationAttempt,
  RevenueRecord,
  RiskEvent,
  StrategySnapshot,
  StrategyLearningState,
  StrategySuggestion,
  TopicCandidate,
  TrendSignal,
  WechatAccount
} from "./domain";
import { DEFAULT_AUTO_LOOP_CONFIG } from "./profit-optimizer";
import {
  DEFAULT_CONTENT_STRATEGY_WEIGHTS,
  DEFAULT_MONETIZATION_CHANNEL_WEIGHTS,
  learnStrategyFromWorkspace
} from "./strategy-learning";
import { getArticleDraftsDir, getArticleInlineImagesDir, getCoverImagesDir, getReportsDir, getWorkspaceDataFile } from "./paths";
import { readArticleDocument, updateArticleDocument, type ArticleDocument, type ArticleDocumentPatch } from "./article-document";
import { createArticleVisualPlan } from "./article-visuals";
import { evaluateArticleQuality } from "./content-quality-gate";
import { evaluateEditorialVoice } from "./editorial-voice-gate";
import { generateDraftArticle } from "./draft-generator";
import { generateWeeklyReport } from "./report-generator";
import { accounts, articles, costs, metrics, revenue, strategySuggestions, topics, trendSignals } from "./sample-data";
import { generateTopicsFromSignals } from "./trend-topic-generator";
import { getTopicEvidenceBlockers } from "./topic-evidence";
import { applyArticleAction, type ArticleAction, applySuggestionAction, type SuggestionAction } from "./workflow";
import {
  reconcileHistoricalWechatObservations as reconcileHistoricalObservations,
  type HistoricalOutcomeReconciliation,
  type HistoricalWechatObservation
} from "./historical-outcome-reconciler";
import { deriveRiskEventsFromOutcomes } from "./outcome-importer";

export interface WorkspaceData {
  version: 1;
  updatedAt: string;
  topics: TopicCandidate[];
  trendSignals: TrendSignal[];
  articles: ArticlePackage[];
  costs: CostRecord[];
  revenue: RevenueRecord[];
  metrics: ArticleMetrics[];
  suggestions: StrategySuggestion[];
  accounts: WechatAccount[];
  autoLoopConfig: AutoLoopConfig;
  experimentRuns: ExperimentRun[];
  decisionLogs: DecisionLog[];
  strategySnapshots: StrategySnapshot[];
  publicationAttempts: PublicationAttempt[];
  articleOutcomes: ArticleOutcome[];
  riskEvents: RiskEvent[];
  strategyLearning: StrategyLearningState;
}

export interface WorkspaceStore {
  getWorkspace(): WorkspaceData;
  getArticleDetail(articleId: string): ArticleDocument | null;
  updateArticleDetail(articleId: string, patch: ArticleDocumentPatch): ArticleDocument | null;
  applyArticleAction(articleId: string, action: ArticleAction): WorkspaceData;
  applySuggestionAction(suggestionId: string, action: SuggestionAction): WorkspaceData;
  generateDraftFromTopic(topicId: string, options?: { markdownOverride?: string }): WorkspaceData;
  generateWeeklyReport(): { workspace: WorkspaceData; path: string };
  refreshTrendSignals(signals?: TrendSignal[], options?: { now?: Date }): WorkspaceData;
  getExperimentSummary(): ExperimentSummary;
  updateAutoLoopConfig(patch: Partial<AutoLoopConfig>, now?: Date): WorkspaceData;
  saveExperimentRunResult(result: ExperimentRunResult): WorkspaceData;
  stopAutoLoop(now?: Date): WorkspaceData;
  recordArticleOutcomes(outcomes: ArticleOutcome[], now?: Date, riskEvents?: RiskEvent[]): WorkspaceData;
  reconcileHistoricalWechatObservations(
    observations: HistoricalWechatObservation[],
    now?: Date
  ): HistoricalOutcomeReconciliation;
  recordPublicationAttempt(attempt: PublicationAttempt): WorkspaceData;
  resetWorkspace(): WorkspaceData;
}

export interface ExperimentRunResult {
  run: ExperimentRun;
  decisionLogs: DecisionLog[];
  strategySnapshot: StrategySnapshot;
  workspace: WorkspaceData;
}

export interface ExperimentSummary {
  config: AutoLoopConfig;
  latestRun: ExperimentRun | null;
  recentDecisions: DecisionLog[];
  latestStrategy: StrategySnapshot | null;
}

const contentExperimentTags: ContentExperimentTag[] = [
  "mass-pain-point",
  "money-saving",
  "side-income-beginner",
  "emotional-relief",
  "technical-tutorial",
  "buyer-guide",
  "profit-review",
  "workflow-playbook"
];

function inferContentExperimentTag(value: string): ContentExperimentTag | undefined {
  return contentExperimentTags.find((tag) => value.includes(tag));
}

export function createSeedWorkspace(): WorkspaceData {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    topics,
    trendSignals,
    articles,
    costs,
    revenue,
    metrics,
    suggestions: strategySuggestions,
    accounts,
    autoLoopConfig: { ...DEFAULT_AUTO_LOOP_CONFIG, updatedAt: new Date().toISOString() },
    experimentRuns: [],
    decisionLogs: [],
    strategySnapshots: [],
    publicationAttempts: [],
    articleOutcomes: [],
    riskEvents: [],
    strategyLearning: {
      sourceWeights: { hot: 1, evergreen: 1, series: 1, experimental: 1 },
      categoryWeights: {},
      experimentTagWeights: {},
      contentStrategyWeights: { ...DEFAULT_CONTENT_STRATEGY_WEIGHTS },
      monetizationChannelWeights: { ...DEFAULT_MONETIZATION_CHANNEL_WEIGHTS },
      articleRewards: [],
      updatedAt: new Date().toISOString()
    }
  };
}

export function createEmptyWorkspace(now: Date = new Date()): WorkspaceData {
  const timestamp = now.toISOString();
  return {
    version: 1,
    updatedAt: timestamp,
    topics: [],
    trendSignals: [],
    articles: [],
    costs: [],
    revenue: [],
    metrics: [],
    suggestions: [],
    accounts: [
      {
        id: "account-main",
        name: "未配置公众号",
        appIdMasked: "未配置",
        positioning: "待配置",
        audience: "待配置",
        status: "needs_review",
        publishMode: "manual_review",
        monthlyRevenueTarget: 0,
        monthlyCostCap: 0,
        followers: 0,
        owner: "未配置",
        updatedAt: timestamp
      }
    ],
    autoLoopConfig: { ...DEFAULT_AUTO_LOOP_CONFIG, updatedAt: timestamp },
    experimentRuns: [],
    decisionLogs: [],
    strategySnapshots: [],
    publicationAttempts: [],
    articleOutcomes: [],
    riskEvents: [],
    strategyLearning: {
      sourceWeights: { hot: 1, evergreen: 1, series: 1, experimental: 1 },
      categoryWeights: {},
      experimentTagWeights: {},
      contentStrategyWeights: { ...DEFAULT_CONTENT_STRATEGY_WEIGHTS },
      monetizationChannelWeights: { ...DEFAULT_MONETIZATION_CHANNEL_WEIGHTS },
      articleRewards: [],
      updatedAt: timestamp
    }
  };
}

export function createWorkspaceStore(options?: { dataFile?: string; draftDir?: string; coverDir?: string; inlineImageDir?: string }): WorkspaceStore {
  const dataFile = options?.dataFile ?? getWorkspaceDataFile();

  function writeWorkspace(data: WorkspaceData, expectedUpdatedAt: string | undefined = data.updatedAt): WorkspaceData {
    mkdirSync(dirname(dataFile), { recursive: true });
    if (existsSync(dataFile) && expectedUpdatedAt) {
      const persisted = JSON.parse(readFileSync(dataFile, "utf8").replace(/^\uFEFF/, "")) as Partial<WorkspaceData>;
      if (persisted.updatedAt && persisted.updatedAt !== expectedUpdatedAt) {
        throw new Error("Workspace changed concurrently; reload before retrying the operation");
      }
    }
    const previousTimestamp = Date.parse(data.updatedAt);
    const nextTimestamp = new Date(Math.max(
      Date.now(),
      Number.isFinite(previousTimestamp) ? previousTimestamp + 1 : 0
    )).toISOString();
    const nextData = {
      ...data,
      updatedAt: nextTimestamp
    };
    const tempFile = `${dataFile}.${process.pid}.${Date.now()}.tmp`;
    const backupFile = `${dataFile}.bak`;
    try {
      writeFileSync(tempFile, `${JSON.stringify(nextData, null, 2)}\n`, "utf8");
      if (existsSync(dataFile)) copyFileSync(dataFile, backupFile);
      renameSync(tempFile, dataFile);
    } finally {
      rmSync(tempFile, { force: true });
    }
    return nextData;
  }

  function readWorkspace(): WorkspaceData {
    if (!existsSync(dataFile)) {
      return writeWorkspace(createSeedWorkspace());
    }

    const parsed = JSON.parse(readFileSync(dataFile, "utf8").replace(/^\uFEFF/, "")) as Partial<WorkspaceData>;
    const parsedLearning = parsed.strategyLearning;
    const strategyLearning = {
      sourceWeights: parsedLearning?.sourceWeights ?? { hot: 1, evergreen: 1, series: 1, experimental: 1 },
      categoryWeights: parsedLearning?.categoryWeights ?? {},
      experimentTagWeights: parsedLearning?.experimentTagWeights ?? {},
      contentStrategyWeights: parsedLearning?.contentStrategyWeights ?? { ...DEFAULT_CONTENT_STRATEGY_WEIGHTS },
      monetizationChannelWeights: parsedLearning?.monetizationChannelWeights ?? { ...DEFAULT_MONETIZATION_CHANNEL_WEIGHTS },
      articleRewards: parsedLearning?.articleRewards ?? [],
      updatedAt: parsedLearning?.updatedAt ?? new Date().toISOString()
    } satisfies StrategyLearningState;
    const restoredTopics = (parsed.topics ?? topics).map((topic) => ({
      ...topic,
      experimentTag: topic.experimentTag ?? inferContentExperimentTag(topic.id)
    }));
    const topicTags = new Map(restoredTopics.map((topic) => [topic.id, topic.experimentTag]));
    const restoredArticles = (parsed.articles ?? articles).map((article) => ({
      ...article,
      experimentTag: article.experimentTag ?? topicTags.get(article.topicId) ?? inferContentExperimentTag(article.id)
    }));

    return {
      ...parsed,
      topics: restoredTopics,
      trendSignals: parsed.trendSignals ?? trendSignals,
      articles: restoredArticles,
      accounts: parsed.accounts ?? accounts,
      autoLoopConfig: parsed.autoLoopConfig ?? { ...DEFAULT_AUTO_LOOP_CONFIG, updatedAt: new Date().toISOString() },
      experimentRuns: parsed.experimentRuns ?? [],
      decisionLogs: parsed.decisionLogs ?? [],
      strategySnapshots: parsed.strategySnapshots ?? [],
      publicationAttempts: parsed.publicationAttempts ?? [],
      articleOutcomes: parsed.articleOutcomes ?? [],
      riskEvents: parsed.riskEvents ?? [],
      strategyLearning
    } as WorkspaceData;
  }

  return {
    getWorkspace() {
      return readWorkspace();
    },
    getArticleDetail(articleId) {
      const current = readWorkspace();
      const article = current.articles.find((item) => item.id === articleId);
      return article ? readArticleDocument(article) : null;
    },
    updateArticleDetail(articleId, patch) {
      const current = readWorkspace();
      const article = current.articles.find((item) => item.id === articleId);
      if (!article) {
        return null;
      }

      const updatedArticle = updateArticleDocument(article, patch);
      const markdown = patch.markdown ?? readArticleDocument(updatedArticle).markdown;
      const category = current.topics.find((topic) => topic.id === updatedArticle.topicId)?.category;
      const quality = evaluateArticleQuality({
        title: updatedArticle.title,
        category,
        markdown,
        contentBrief: updatedArticle.contentBrief,
        factPack: updatedArticle.factPack
      });
      const editorialVoice = evaluateEditorialVoice({
        markdown,
        articleType: updatedArticle.contentBrief?.articleType,
        factPack: updatedArticle.factPack
      });
      const shouldRefreshVisualPlan = Boolean(updatedArticle.visualPlan)
        && patch.visualPlan === undefined
        && ["planned", "needs_visual_review"].includes(updatedArticle.visualPlan!.status)
        && (patch.title !== undefined || patch.markdown !== undefined);
      const assessedArticle: ArticlePackage = {
        ...updatedArticle,
        qualityScore: quality.score,
        qualityAssessment: {
          ...quality,
          evaluatedAt: new Date().toISOString()
        },
        editorialVoiceAssessment: {
          ...editorialVoice,
          evaluatedAt: new Date().toISOString()
        },
        visualPlan: shouldRefreshVisualPlan
          ? createArticleVisualPlan(updatedArticle, markdown, new Date(), { model: updatedArticle.visualPlan?.model })
          : updatedArticle.visualPlan
      };
      const updatedWorkspace = writeWorkspace({
        ...current,
        articles: current.articles.map((item) => (item.id === articleId ? assessedArticle : item))
      });
      const persistedArticle = updatedWorkspace.articles.find((item) => item.id === articleId) ?? assessedArticle;
      return readArticleDocument(persistedArticle);
    },
    applyArticleAction(articleId, action) {
      const current = readWorkspace();
      const article = current.articles.find((item) => item.id === articleId);
      if (action === "approve" && article?.editorialVoiceAssessment && !article.editorialVoiceAssessment.passed) {
        throw new Error(`Article editorial voice assessment did not pass: ${article.editorialVoiceAssessment.score}`);
      }
      return writeWorkspace({
        ...current,
        articles: applyArticleAction(current.articles, articleId, action)
      });
    },
    applySuggestionAction(suggestionId, action) {
      const current = readWorkspace();
      return writeWorkspace({
        ...current,
        suggestions: applySuggestionAction(current.suggestions, suggestionId, action)
      });
    },
    generateDraftFromTopic(topicId, generationOptions) {
      const current = readWorkspace();
      const topic = current.topics.find((item) => item.id === topicId);
      if (!topic) {
        return current;
      }
      const evidenceBlockers = getTopicEvidenceBlockers(topic);
      if (evidenceBlockers.length > 0) {
        throw new Error(`Topic evidence is not ready: ${evidenceBlockers.join(", ")}`);
      }

      const generated = generateDraftArticle(topic, {
        sequence: current.articles.length + 1,
        draftDir: options?.draftDir ?? getArticleDraftsDir(),
        coverDir: options?.coverDir ?? getCoverImagesDir(),
        markdownOverride: generationOptions?.markdownOverride
      });
      const visualPlan = createArticleVisualPlan(generated.article, generated.markdown, new Date(), {
        imageDir: options?.inlineImageDir ?? getArticleInlineImagesDir(),
        maxInlineImages: 3,
        model: "gpt-image-2"
      });
      const plannedArticle = { ...generated.article, visualPlan };
      mkdirSync(dirname(generated.article.contentPath), { recursive: true });
      writeFileSync(generated.article.contentPath, generated.markdown, "utf8");

      return writeWorkspace({
        ...current,
        articles: [...current.articles, plannedArticle]
      });
    },
    generateWeeklyReport() {
      const current = readWorkspace();
      const report = generateWeeklyReport(current);
      const reportPath = join(getReportsDir(), report.fileName);
      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, report.markdown, "utf8");

      return {
        workspace: current,
        path: reportPath
      };
    },
    refreshTrendSignals(signals, refreshOptions) {
      const current = readWorkspace();
      const nextSignals = (signals ?? current.trendSignals).map((signal) => ({ ...signal }));
      const generatedTopics = generateTopicsFromSignals(nextSignals, {
        account: current.accounts[0] ?? accounts[0],
        existingTopicTitles: current.topics.map((topic) => topic.title),
        now: refreshOptions?.now
      });
      const existingTopicIds = new Set(current.topics.map((topic) => topic.id));
      const uniqueGeneratedTopics = generatedTopics.filter((topic) => !existingTopicIds.has(topic.id));

      return writeWorkspace({
        ...current,
        trendSignals: nextSignals,
        topics: [...current.topics, ...uniqueGeneratedTopics]
      });
    },
    getExperimentSummary() {
      const current = readWorkspace();
      const latestRun = [...current.experimentRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
      const latestStrategy = [...current.strategySnapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

      return {
        config: current.autoLoopConfig,
        latestRun,
        recentDecisions: [...current.decisionLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
        latestStrategy
      };
    },
    updateAutoLoopConfig(patch, now) {
      const current = readWorkspace();
      return writeWorkspace({
        ...current,
        autoLoopConfig: {
          ...current.autoLoopConfig,
          ...patch,
          updatedAt: (now ?? new Date()).toISOString()
        }
      });
    },
    saveExperimentRunResult(result) {
      return writeWorkspace({
        ...result.workspace,
        experimentRuns: [...result.workspace.experimentRuns, result.run],
        decisionLogs: [...result.workspace.decisionLogs, ...result.decisionLogs],
        strategySnapshots: [...result.workspace.strategySnapshots, result.strategySnapshot]
      });
    },
    stopAutoLoop(now) {
      const current = readWorkspace();
      const stoppedAt = (now ?? new Date()).toISOString();
      return writeWorkspace({
        ...current,
        autoLoopConfig: {
          ...current.autoLoopConfig,
          enabled: false,
          updatedAt: stoppedAt
        },
        experimentRuns: current.experimentRuns.map((run) =>
          run.status === "running" || run.status === "planned"
            ? { ...run, status: "stopped", completedAt: stoppedAt, summary: "AutoProfit loop stopped by operator." }
            : run
        )
      });
    },
    recordArticleOutcomes(outcomes, now, riskEvents) {
      const current = readWorkspace();
      const outcomeIds = new Set(outcomes.map((outcome) => outcome.id));
      const riskEventIds = new Set((riskEvents ?? []).map((event) => event.id));
      const nextWorkspace = {
        ...current,
        articleOutcomes: [
          ...current.articleOutcomes.filter((outcome) => !outcomeIds.has(outcome.id)),
          ...outcomes
        ],
        riskEvents: [
          ...current.riskEvents.filter((event) => !riskEventIds.has(event.id)),
          ...(riskEvents ?? [])
        ]
      } satisfies WorkspaceData;
      return writeWorkspace({
        ...nextWorkspace,
        strategyLearning: learnStrategyFromWorkspace(nextWorkspace, now)
      });
    },
    reconcileHistoricalWechatObservations(observations, now) {
      const current = readWorkspace();
      const reconciliation = reconcileHistoricalObservations(current, observations);
      const outcomeIds = new Set(reconciliation.outcomes.map((outcome) => outcome.id));
      const riskEvents = deriveRiskEventsFromOutcomes(reconciliation.outcomes, now);
      const riskEventIds = new Set(riskEvents.map((event) => event.id));
      const nextWorkspace = {
        ...reconciliation.workspace,
        articleOutcomes: [
          ...reconciliation.workspace.articleOutcomes.filter((outcome) => !outcomeIds.has(outcome.id)),
          ...reconciliation.outcomes
        ],
        riskEvents: [
          ...reconciliation.workspace.riskEvents.filter((event) => !riskEventIds.has(event.id)),
          ...riskEvents
        ]
      } satisfies WorkspaceData;
      const persistedWorkspace = writeWorkspace({
        ...nextWorkspace,
        strategyLearning: learnStrategyFromWorkspace(nextWorkspace, now)
      });
      return { ...reconciliation, workspace: persistedWorkspace };
    },
    recordPublicationAttempt(attempt) {
      const current = readWorkspace();
      return writeWorkspace({
        ...current,
        publicationAttempts: [...current.publicationAttempts.filter((item) => item.id !== attempt.id), attempt]
      });
    },
    resetWorkspace() {
      const current = readWorkspace();
      return writeWorkspace(createEmptyWorkspace(), current.updatedAt);
    }
  };
}

export const workspaceStore = createWorkspaceStore();
