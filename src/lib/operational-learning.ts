import type { DecisionLog, PublicationAttempt, RiskEvent } from "./domain";
import { getReliableOutcomes } from "./real-data-quality";
import type { WorkspaceData } from "./workspace-store";

export type OperationalImprovementArea = "data_loop" | "draft_pipeline" | "risk_control" | "content_quality" | "cost_control";
export type OperationalImprovementPriority = "high" | "medium" | "low";

export interface OperationalImprovement {
  area: OperationalImprovementArea;
  priority: OperationalImprovementPriority;
  evidence: string;
  action: string;
}

export interface OperationalLearningResult {
  longRunReady: boolean;
  blockers: string[];
  improvements: OperationalImprovement[];
}

export function analyzeOperationalLearning(workspace: WorkspaceData): OperationalLearningResult {
  const improvements: OperationalImprovement[] = [];
  const blockers: string[] = [];
  const failedDraftLogs = workspace.decisionLogs.filter((log) => log.type === "create_wechat_draft" && log.score <= 0);
  const failedDraftAttempts = workspace.publicationAttempts.filter((attempt) => attempt.status === "failed" || attempt.status === "blocked");
  const publishedArticles = workspace.articles.filter((article) => article.status === "published");
  const outcomesByArticle = new Set(getReliableOutcomes(workspace.articleOutcomes ?? []).map((outcome) => outcome.articleId));
  const publishedWithoutOutcomes = publishedArticles.filter((article) => !outcomesByArticle.has(article.id));
  const severeRiskEvents = (workspace.riskEvents ?? []).filter((event) => event.severity >= 50);
  const blockedQualityLogs = workspace.decisionLogs.filter((log) => log.reason.toLowerCase().includes("quality gate blocked"));

  if (failedDraftLogs.length + failedDraftAttempts.length >= 3) {
    improvements.push({
      area: "draft_pipeline",
      priority: "high",
      evidence: summarizeFailures(failedDraftLogs, failedDraftAttempts),
      action: "Add or tighten preflight checks before WeChat draft creation: author, title duplication, image ratio, duplicate image blocks, token health, and scheduled-publish lock state."
    });
  }

  if (publishedWithoutOutcomes.length > 0) {
    const message = `${publishedWithoutOutcomes.length} published article(s) have no imported outcome data.`;
    blockers.push(message);
    improvements.push({
      area: "data_loop",
      priority: "high",
      evidence: message,
      action: "Run outcome import after publication and block next strategy learning if published articles are missing outcome import beyond the reporting window."
    });
  }

  if (severeRiskEvents.length > 0) {
    improvements.push({
      area: "risk_control",
      priority: "high",
      evidence: `${severeRiskEvents.length} severe risk event(s): ${severeRiskEvents.map((event) => event.type).join(", ")}`,
      action: "Lower max risk for the next batch and add the risk-event language or source pattern to the content quality gate."
    });
  }

  if (blockedQualityLogs.length >= 2) {
    improvements.push({
      area: "content_quality",
      priority: "medium",
      evidence: `${blockedQualityLogs.length} draft(s) were blocked by content quality gate.`,
      action: "Extract blocked reasons into generation prompts and reject similar drafts before image generation cost is spent."
    });
  }

  if (workspace.autoLoopConfig.enabled && workspace.autoLoopConfig.dailyCostCapCny <= 0) {
    blockers.push("Auto loop is enabled but daily cost cap is zero or negative.");
    improvements.push({
      area: "cost_control",
      priority: "high",
      evidence: "Invalid daily cost cap for a running loop.",
      action: "Set a positive daily cost cap or disable the loop before running long-duration experiments."
    });
  }

  return {
    longRunReady: blockers.length === 0 && !improvements.some((item) => item.priority === "high"),
    blockers,
    improvements
  };
}

function summarizeFailures(logs: DecisionLog[], attempts: PublicationAttempt[]): string {
  const logReasons = logs.slice(0, 3).map((log) => log.reason);
  const attemptReasons = attempts.slice(0, 3).map((attempt) => attempt.error ?? attempt.status);
  return [...logReasons, ...attemptReasons].join(" | ");
}
