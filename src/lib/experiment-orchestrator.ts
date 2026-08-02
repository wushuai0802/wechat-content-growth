import { readFileSync } from "node:fs";
import type { ArticlePackage, DecisionLog, ExperimentRun, StrategySnapshot } from "./domain";
import { evaluateArticleQuality, type ArticleQualityResult } from "./content-quality-gate";
import { resolveExplorationPolicy } from "./exploration-policy";
import { analyzeOperationalLearning } from "./operational-learning";
import { rankTopicsForProfit } from "./profit-optimizer";
import type { ExperimentRunResult, WorkspaceData } from "./workspace-store";

interface WechatDraftResult {
  workspace: WorkspaceData;
  draftId: string;
}

export interface RunAutoProfitExperimentDeps {
  workspace: WorkspaceData;
  now?: Date;
  generateDraft?: (topicId: string, workspace: WorkspaceData) => WorkspaceData | Promise<WorkspaceData>;
  createWechatDraft?: (articleId: string, workspace: WorkspaceData) => Promise<WechatDraftResult>;
}

function createId(prefix: string, now: Date, index?: number): string {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return typeof index === "number" ? `${prefix}-${stamp}-${index}` : `${prefix}-${stamp}`;
}

function logDecision(input: Omit<DecisionLog, "id" | "createdAt"> & { now: Date; index: number }): DecisionLog {
  return {
    id: createId("decision", input.now, input.index),
    runId: input.runId,
    type: input.type,
    targetId: input.targetId,
    reason: input.reason,
    score: Math.round(input.score * 100) / 100,
    createdAt: input.now.toISOString(),
    metadata: input.metadata
  };
}

function approveArticle(workspace: WorkspaceData, articleId: string, quality: ArticleQualityResult, evaluatedAt: string): WorkspaceData {
  return {
    ...workspace,
    articles: workspace.articles.map((article) =>
      article.id === articleId && article.status === "review"
        ? {
            ...article,
            status: "approved",
            qualityScore: quality.score,
            qualityAssessment: { ...quality, evaluatedAt }
          }
        : article
    )
  };
}

function findArticleForTopic(workspace: WorkspaceData, topicId: string): ArticlePackage | undefined {
  return [...workspace.articles].reverse().find((article) => article.topicId === topicId);
}

function readArticleMarkdown(article: ArticlePackage): string {
  try {
    return readFileSync(article.contentPath, "utf8");
  } catch {
    return "";
  }
}

export async function runAutoProfitExperiment(deps: RunAutoProfitExperimentDeps): Promise<ExperimentRunResult> {
  const now = deps.now ?? new Date();
  let workspace = deps.workspace;
  const config = workspace.autoLoopConfig;
  const explorationPolicy = resolveExplorationPolicy(workspace);
  const runId = createId("run", now);
  const decisions: DecisionLog[] = [];
  let decisionIndex = 0;

  const mode = config.autoPublishEnabled ? "auto_publish" : "draft_only";
  const selectedTopicIds: string[] = [];
  const generatedArticleIds: string[] = [];
  const wechatDraftArticleIds: string[] = [];
  const publishedArticleIds: string[] = [];
  let failureCount = 0;

  const strategySnapshot: StrategySnapshot = {
    id: createId("strategy", now),
    runId,
    objective: "maximize_net_profit",
    topicWeights: explorationPolicy.phase === "explore"
      ? { hot: 1.4, evergreen: 0.6, series: 0.4, experimental: 1 }
      : explorationPolicy.phase === "mixed"
        ? { hot: 1.2, evergreen: 0.8, series: 0.7, experimental: 0.9 }
        : { hot: 1, evergreen: 0.7, series: 0.6, experimental: 0.5 },
    riskPolicy: `quality >= ${config.minQualityScore}; risk <= ${config.maxRiskScore}`,
    budgetPolicy: `daily cost cap ${config.dailyCostCapCny} CNY; article limit ${config.dailyArticleLimit}; phase ${explorationPolicy.phase}; exploration ${Math.round(explorationPolicy.exploreRatio * 100)}%`,
    createdAt: now.toISOString()
  };

  if (!config.enabled) {
    decisions.push(logDecision({
      runId,
      type: "stop_loop",
      targetId: "auto-loop",
      reason: "AutoProfit loop is disabled.",
      score: 0,
      now,
      index: decisionIndex++
    }));

    return {
      workspace,
      strategySnapshot,
      decisionLogs: decisions,
      run: {
        id: runId,
        status: "stopped",
        mode,
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        selectedTopicIds,
        generatedArticleIds,
        wechatDraftArticleIds,
        publishedArticleIds,
        estimatedCost: 0,
        projectedRevenue: 0,
        projectedNetProfit: 0,
        failureCount: 0,
        summary: "AutoProfit loop is disabled. No experiment run executed."
      }
    };
  }

  const operationalLearning = analyzeOperationalLearning(workspace);
  const missingOutcomeBlocker = operationalLearning.blockers.find((blocker) => blocker.includes("outcome data"));
  if (missingOutcomeBlocker) {
    decisions.push(logDecision({
      runId,
      type: "stop_loop",
      targetId: "outcomes",
      reason: `Missing outcome data blocks next AutoProfit run: ${missingOutcomeBlocker}`,
      score: 0,
      now,
      index: decisionIndex++
    }));

    return {
      workspace,
      strategySnapshot,
      decisionLogs: decisions,
      run: {
        id: runId,
        status: "stopped",
        mode,
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        selectedTopicIds,
        generatedArticleIds,
        wechatDraftArticleIds,
        publishedArticleIds,
        estimatedCost: 0,
        projectedRevenue: 0,
        projectedNetProfit: 0,
        failureCount: 0,
        summary: "AutoProfit loop stopped until published article outcome data is imported."
      }
    };
  }

  const rankedTopics = rankTopicsForProfit(
    workspace.topics,
    config,
    workspace.strategyLearning,
    { policy: explorationPolicy, now }
  );
  for (const item of rankedTopics) {
    selectedTopicIds.push(item.topic.id);
    decisions.push(logDecision({
      runId,
      type: "select_topic",
      targetId: item.topic.id,
      reason: `Selected in ${explorationPolicy.phase} phase with realtime-first score ${item.score} and projected net profit ${item.projectedNetProfit}.`,
      score: item.score,
      now,
      index: decisionIndex++,
      metadata: {
        projectedNetProfit: item.projectedNetProfit,
        expectedRevenue: item.forecast.d30.grossRevenue,
        forecast24hNetProfit: item.forecast.h24.netProfit,
        forecast7dNetProfit: item.forecast.d7.netProfit,
        forecast30dNetProfit: item.forecast.d30.netProfit,
        forecastConfidence: item.forecast.confidence,
        contentStrategy: item.topic.contentStrategy ?? item.topic.opportunityProfile?.strategy ?? "legacy",
        monetizationChannel: item.topic.primaryMonetizationChannel ?? item.forecast.primaryChannel,
        estimatedCost: item.topic.estimatedCost,
        risk: item.topic.risk,
        saturation: item.topic.saturation,
        learningPhase: explorationPolicy.phase,
        reliableOutcomeCount: explorationPolicy.reliableOutcomeCount,
        richOutcomeCount: explorationPolicy.richOutcomeCount,
        historyWeight: explorationPolicy.historyWeight
      }
    }));
  }

  if (selectedTopicIds.length === 0) {
    decisions.push(logDecision({
      runId,
      type: "stop_loop",
      targetId: "topics",
      reason: "No candidate topics fit AutoProfit limits.",
      score: 0,
      now,
      index: decisionIndex++
    }));
  }

  for (const topicId of selectedTopicIds) {
    const beforeIds = new Set(workspace.articles.map((article) => article.id));
    if (deps.generateDraft) {
      try {
        workspace = await deps.generateDraft(topicId, workspace);
      } catch (error) {
        failureCount += 1;
        decisions.push(logDecision({
          runId,
          type: "generate_article",
          targetId: topicId,
          reason: error instanceof Error ? error.message : "Draft generation failed.",
          score: 0,
          now,
          index: decisionIndex++
        }));
        if (failureCount >= config.consecutiveFailureLimit) {
          break;
        }
        continue;
      }
    }
    const generated = workspace.articles.find((article) => !beforeIds.has(article.id) && article.topicId === topicId)
      ?? findArticleForTopic(workspace, topicId);

    if (!generated) {
      failureCount += 1;
      decisions.push(logDecision({
        runId,
        type: "generate_article",
        targetId: topicId,
        reason: "Draft generation did not produce an article.",
        score: 0,
        now,
        index: decisionIndex++
      }));
      if (failureCount >= config.consecutiveFailureLimit) {
        break;
      }
      continue;
    }

    if (!generatedArticleIds.includes(generated.id)) {
      generatedArticleIds.push(generated.id);
    }
    decisions.push(logDecision({
      runId,
      type: "generate_article",
      targetId: generated.id,
      reason: `Generated article for topic ${topicId}.`,
      score: generated.qualityScore,
      now,
      index: decisionIndex++
    }));

    const contentQuality = evaluateArticleQuality({
      title: generated.title,
      category: workspace.topics.find((topic) => topic.id === generated.topicId)?.category,
      markdown: readArticleMarkdown(generated),
      contentBrief: generated.contentBrief,
      factPack: generated.factPack
    });

    if (!contentQuality.passed) {
      decisions.push(logDecision({
        runId,
        type: "skip_topic",
        targetId: generated.id,
        reason: `Content quality gate blocked draft: ${contentQuality.reasons.join("；")}`,
        score: contentQuality.score,
        now,
        index: decisionIndex++,
        metadata: {
          contentQualityScore: contentQuality.score
        }
      }));
      continue;
    }

    const approvalQualityScore = contentQuality.score;
    if (approvalQualityScore >= config.minQualityScore && generated.riskScore <= config.maxRiskScore) {
      workspace = approveArticle(workspace, generated.id, contentQuality, now.toISOString());
      decisions.push(logDecision({
        runId,
        type: "approve_article",
        targetId: generated.id,
        reason: `Auto-approved with content quality ${contentQuality.score}, topic quality ${generated.qualityScore}, and risk ${generated.riskScore}.`,
        score: approvalQualityScore - generated.riskScore,
        now,
        index: decisionIndex++,
        metadata: {
          contentQualityScore: contentQuality.score,
          topicQualityScore: generated.qualityScore,
          factualReliability: contentQuality.dimensions.factualReliability
        }
      }));
    } else {
      decisions.push(logDecision({
        runId,
        type: "skip_topic",
        targetId: generated.id,
        reason: `Article failed quality/risk threshold: content quality ${contentQuality.score}, topic quality ${generated.qualityScore}, risk ${generated.riskScore}.`,
        score: 0,
        now,
        index: decisionIndex++
      }));
      continue;
    }

    if (deps.createWechatDraft) {
      try {
        const draft = await deps.createWechatDraft(generated.id, workspace);
        workspace = draft.workspace;
        wechatDraftArticleIds.push(generated.id);
        decisions.push(logDecision({
          runId,
          type: "create_wechat_draft",
          targetId: generated.id,
          reason: `Created WeChat draft ${draft.draftId}.`,
          score: 1,
          now,
          index: decisionIndex++
        }));
      } catch (error) {
        failureCount += 1;
        decisions.push(logDecision({
          runId,
          type: "create_wechat_draft",
          targetId: generated.id,
          reason: error instanceof Error ? error.message : "Failed to create WeChat draft.",
          score: 0,
          now,
          index: decisionIndex++
        }));
        if (failureCount >= config.consecutiveFailureLimit) {
          break;
        }
      }
    }
  }

  const selectedScores = rankedTopics.filter((item) => selectedTopicIds.includes(item.topic.id));
  const estimatedCost = selectedScores.reduce((sum, item) => sum + item.topic.estimatedCost, 0);
  const projectedRevenue = selectedScores.reduce((sum, item) => sum + item.forecast.d30.grossRevenue, 0);
  const projectedNetProfit = selectedScores.reduce((sum, item) => sum + item.projectedNetProfit, 0);
  const status = failureCount >= config.consecutiveFailureLimit ? "failed" : "completed";

  return {
    workspace,
    decisionLogs: decisions,
    strategySnapshot,
    run: {
      id: runId,
      status,
      mode,
      startedAt: now.toISOString(),
      completedAt: now.toISOString(),
      selectedTopicIds,
      generatedArticleIds,
      wechatDraftArticleIds,
      publishedArticleIds,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      projectedRevenue: Math.round(projectedRevenue * 100) / 100,
      projectedNetProfit: Math.round(projectedNetProfit * 100) / 100,
      failureCount,
      summary: `${explorationPolicy.phase} phase selected ${selectedTopicIds.length}, generated ${generatedArticleIds.length}, drafted ${wechatDraftArticleIds.length}, failures ${failureCount}.`
    }
  };
}
