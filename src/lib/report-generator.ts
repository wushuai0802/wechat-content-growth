import { buildPortfolioMix, getDashboardStats, summarizeSuggestions } from "./strategy";
import { analyzeOperationalLearning } from "./operational-learning";
import type { WorkspaceData } from "./workspace-store";

export interface WeeklyReport {
  fileName: string;
  markdown: string;
}

export function generateWeeklyReport(
  workspace: WorkspaceData,
  options?: { now?: Date }
): WeeklyReport {
  const now = options?.now ?? new Date();
  const date = formatShanghaiDate(now);
  const stats = getDashboardStats({
    articles: workspace.articles,
    revenue: workspace.revenue,
    costs: workspace.costs
  });
  const mix = buildPortfolioMix(workspace.topics);
  const suggestions = summarizeSuggestions(workspace.suggestions).slice(0, 5);
  const reviewArticles = workspace.articles.filter((article) => article.status === "review");
  const operationalLearning = analyzeOperationalLearning(workspace);
  const operationalImprovementLines = operationalLearning.improvements.length > 0
    ? operationalLearning.improvements.map((item) => `- [${item.priority}] ${item.area}: ${item.action}`)
    : ["- No high-priority operational improvements detected from current logs."];

  const markdown = [
    "# 公众号内容增长周报",
    "",
    `生成日期：${date}`,
    "",
    "## 收益概览",
    "",
    `- 收入：${stats.totalRevenue} CNY`,
    `- 成本：${stats.totalCost} CNY`,
    `- 净收益：${stats.netRevenue} CNY`,
    `- 待审阅文章：${stats.pendingReviews}`,
    `- 已通过文章：${stats.approvedArticles}`,
    "",
    "## 内容组合",
    "",
    `- 热点：${mix.hot}`,
    `- 常青：${mix.evergreen}`,
    `- 系列：${mix.series}`,
    `- 实验：${mix.experimental}`,
    "",
    "## 待处理稿件",
    "",
    ...reviewArticles.map((article) => `- ${article.title}（质量 ${article.qualityScore}，风险 ${article.riskScore}）`),
    "",
    "## 策略建议",
    "",
    ...suggestions.map((suggestion) => `- [${suggestion.priority}] ${suggestion.title}：${suggestion.action}`),
    "",
    "## Operational Learning",
    "",
    `- Long-run ready: ${operationalLearning.longRunReady ? "yes" : "no"}`,
    ...operationalLearning.blockers.map((blocker) => `- Blocker: ${blocker}`),
    ...operationalImprovementLines,
    "",
    "## 下一步",
    "",
    "- 优先处理高分热点和系列文章。",
    "- 控制低置信选题的图片生成预算。",
    "- 继续积累真实收益和人工审核成本，为后续策略权重调整提供依据。",
    ""
  ].join("\n");

  return {
    fileName: `weekly-report-${date}.md`,
    markdown
  };
}

function formatShanghaiDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
