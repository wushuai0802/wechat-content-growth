"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Cpu,
  FileText,
  Gauge,
  HardDrive,
  Image,
  KeyRound,
  Layers3,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCcw,
  Send,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Upload,
  Workflow
} from "lucide-react";
import { classifyROI } from "@/lib/scoring";
import { buildContentMixBars, buildDailyFinancialSeries, buildReadTrendSeries } from "@/lib/chart-data";
import { buildPortfolioMix, getDashboardStats, summarizeSuggestions } from "@/lib/strategy";
import { getReliableOutcomes, getReliableRewards } from "@/lib/real-data-quality";
import type { DailyArticleLimitDecision } from "@/lib/daily-run-planner";
import type { ArticleAction, SuggestionAction } from "@/lib/workflow";
import type { WorkspaceData } from "@/lib/workspace-store";
import { isSafeProfitTopic, scoreTopicForProfit } from "@/lib/profit-optimizer";
import { isTopicEvidenceReady } from "@/lib/topic-evidence";

const currency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0
});

const sourceLabel = {
  hot: "热点",
  evergreen: "常青",
  series: "系列",
  experimental: "实验"
};

const contentStrategyLabel = {
  chase: "追热点",
  manufacture: "造热点",
  convert: "转化"
};

const monetizationChannelLabel = {
  traffic_ad: "流量主",
  affiliate: "CPS",
  lead: "线索",
  follower_ltv: "关注者价值"
};

const statusLabel = {
  drafting: "生成中",
  review: "待审阅",
  approved: "已通过",
  wechat_draft: "微信草稿",
  publish_submitted: "发布处理中",
  needs_reconcile: "待核对",
  published: "已发布",
  archived: "归档"
};

const priorityLabel = {
  high: "高优先级",
  medium: "中优先级",
  low: "观察"
};

const chartPalette = {
  revenue: "var(--success)",
  cost: "var(--warning)",
  net: "var(--accent)",
  reads: "var(--accent)",
  followers: "var(--success)"
};

function chartMax(values: number[]): number {
  return Math.max(1, ...values.map((value) => Math.abs(value)));
}

function linePath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

interface CpaConfigView {
  configured: boolean;
  baseUrl: string;
  model: string;
  keyConfigured: boolean;
  models: string[];
}

interface WechatConfigView {
  configured: boolean;
  appIdMasked: string;
  appSecretConfigured: boolean;
  tokenConfigured: boolean;
  encodingAesKeyConfigured: boolean;
  callbackUrl: string;
  publishMode: "draft_only" | "manual_review" | "auto_publish";
}

function FinancialBarChart({ series }: { series: ReturnType<typeof buildDailyFinancialSeries> }) {
  const maxValue = chartMax(series.flatMap((point) => [point.revenue, point.cost]));
  return (
    <div className="barChart" role="img" aria-label="每日收入和成本柱状图">
      {series.map((point) => (
        <div className="barGroup" key={point.date}>
          <div className="barStack">
            <span className="bar revenue" style={{ height: `${Math.max(6, (point.revenue / maxValue) * 100)}%` }} />
            <span className="bar cost" style={{ height: `${Math.max(6, (point.cost / maxValue) * 100)}%` }} />
          </div>
          <strong>{point.date}</strong>
          <small>净 {currency.format(point.net)}</small>
        </div>
      ))}
    </div>
  );
}

function ContentMixChart({ bars }: { bars: ReturnType<typeof buildContentMixBars> }) {
  return (
    <div className="horizontalBars" role="img" aria-label="内容组合占比柱状图">
      {bars.map((bar) => (
        <div className="horizontalBarRow" key={bar.source}>
          <span>{bar.label}</span>
          <div className="horizontalTrack">
            <div className={bar.source} style={{ width: `${bar.percent}%` }} />
          </div>
          <strong>{bar.count}</strong>
        </div>
      ))}
    </div>
  );
}

function ReadLineChart({ series }: { series: ReturnType<typeof buildReadTrendSeries> }) {
  const width = 420;
  const height = 160;
  const padding = 24;
  const maxReads = chartMax(series.map((point) => point.reads));
  const points = series.length > 0 ? series.map((point, index) => {
    const x = series.length === 1 ? width / 2 : padding + (index / (series.length - 1)) * (width - padding * 2);
    const y = height - padding - (point.reads / maxReads) * (height - padding * 2);
    return { x, y, point };
  }) : [];

  return (
    <div className="lineChart" role="img" aria-label="阅读趋势折线图">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <path className="chartGridLine" d={`M ${padding} ${height - padding} L ${width - padding} ${height - padding}`} />
        {points.length > 1 ? <path className="readLine" d={linePath(points)} /> : null}
        {points.map(({ x, y, point }) => (
          <g key={`${point.date}-${point.reads}`}>
            <circle className="readPoint" cx={x} cy={y} r="4" />
            <text x={x} y={height - 6} textAnchor="middle">{point.date}</text>
          </g>
        ))}
      </svg>
      <div className="lineChartSummary">
        {series.map((point) => (
          <span key={point.date}>{point.date} · {point.reads.toLocaleString("zh-CN")} 阅读 · +{point.followers} 粉</span>
        ))}
      </div>
    </div>
  );
}

export function DashboardClient({
  initialWorkspace,
  initialDailyPlan
}: {
  initialWorkspace: WorkspaceData;
  initialDailyPlan?: DailyArticleLimitDecision;
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [activity, setActivity] = useState(`工作区已加载，数据保存于本地运行目录。更新时间：${new Date(initialWorkspace.updatedAt).toLocaleString("zh-CN")}`);
  const [isSaving, setIsSaving] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [cpaConfig, setCpaConfig] = useState<CpaConfigView | null>(null);
  const [cpaBaseUrl, setCpaBaseUrl] = useState("");
  const [cpaModel, setCpaModel] = useState("");
  const [trendImportContent, setTrendImportContent] = useState("");
  const [wechatConfig, setWechatConfig] = useState<WechatConfigView | null>(null);
  const [wechatAppId, setWechatAppId] = useState("");
  const [wechatAppSecret, setWechatAppSecret] = useState("");
  const [wechatToken, setWechatToken] = useState("");
  const [wechatEncodingAesKey, setWechatEncodingAesKey] = useState("");
  const [wechatCallbackUrl, setWechatCallbackUrl] = useState("");
  const [wechatPublishMode, setWechatPublishMode] = useState<WechatConfigView["publishMode"]>("draft_only");
  const [dailyPlan, setDailyPlan] = useState<DailyArticleLimitDecision | null>(initialDailyPlan ?? null);
  const [dailyPlanError, setDailyPlanError] = useState<string | null>(null);

  const { articles, costs: initialCosts, revenue: initialRevenue, suggestions, topics: initialTopics } = workspace;
  const visibleArticles = useMemo(() => articles.filter((article) => article.status !== "archived"), [articles]);
  const trendSignals = workspace.trendSignals ?? [];
  const accounts = workspace.accounts ?? [];

  const stats = useMemo(
    () => getDashboardStats({ articles: visibleArticles, revenue: initialRevenue, costs: initialCosts }),
    [visibleArticles, initialCosts, initialRevenue]
  );
  const mix = useMemo(() => buildPortfolioMix(initialTopics), [initialTopics]);
  const financialSeries = useMemo(
    () => buildDailyFinancialSeries(initialRevenue, initialCosts),
    [initialRevenue, initialCosts]
  );
  const contentMixBars = useMemo(() => buildContentMixBars(initialTopics), [initialTopics]);
  const readTrendSeries = useMemo(() => buildReadTrendSeries(workspace.metrics), [workspace.metrics]);
  const rankedTopics = useMemo(
    () =>
      [...initialTopics]
        .filter((topic) => topic.status === "candidate")
        .filter(isSafeProfitTopic)
        .filter((topic) => topic.risk <= (workspace.autoLoopConfig?.maxRiskScore ?? 35))
        .map((topic) => scoreTopicForProfit(topic, workspace.strategyLearning))
        .sort((left, right) => right.score - left.score),
    [initialTopics, workspace.autoLoopConfig?.maxRiskScore, workspace.strategyLearning]
  );
  const orderedSuggestions = useMemo(() => summarizeSuggestions(suggestions), [suggestions]);
  const roiClass = classifyROI(stats.netRevenue);
  const reviewArticles = useMemo(() => visibleArticles.filter((article) => article.status === "review"), [visibleArticles]);
  const publishedArticles = useMemo(() => visibleArticles.filter((article) => article.status === "published"), [visibleArticles]);
  const costRatio = stats.totalRevenue > 0 ? Math.round((stats.totalCost / stats.totalRevenue) * 100) : 0;
  const latestArticle = visibleArticles.at(-1);
  const topTrendSignals = useMemo(
    () => [...trendSignals].sort((left, right) => right.heat + right.growth - (left.heat + left.growth)).slice(0, 4),
    [trendSignals]
  );
  const autoLoopConfig = workspace.autoLoopConfig;
  const latestExperimentRun = useMemo(
    () => [...(workspace.experimentRuns ?? [])].sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0] ?? null,
    [workspace.experimentRuns]
  );
  const latestDecision = useMemo(
    () => [...(workspace.decisionLogs ?? [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null,
    [workspace.decisionLogs]
  );
  const pendingWechatDraftCount = useMemo(
    () => visibleArticles.filter((article) =>
      article.status === "wechat_draft" || article.status === "publish_submitted" || article.status === "needs_reconcile"
    ).length,
    [visibleArticles]
  );
  const topicMaintenance = useMemo(() => {
    const legacyTopics = initialTopics.filter((topic) =>
      topic.id.startsWith("topic-trend-baidu-") ||
      topic.category === "百度热搜" ||
      topic.title.includes("公众号运营者该怎么判断机会")
    );
    const legacyCandidates = legacyTopics.filter((topic) => topic.status === "candidate");
    return {
      candidateCount: initialTopics.filter((topic) => topic.status === "candidate").length,
      rejectedLegacyCount: legacyTopics.filter((topic) => topic.status === "rejected").length,
      legacyCandidateCount: legacyCandidates.length,
      statusLabel: legacyCandidates.length > 0 ? "需处理" : "干净"
    };
  }, [initialTopics]);
  const dailyPlanStatus = dailyPlan?.shouldRun ? "建议运行" : dailyPlan ? "建议暂停" : dailyPlanError ? "读取失败" : "读取中";
  const dailyPlanStatusClass = dailyPlan?.shouldRun ? "ok" : "warn";
  const dailyPlanConstraints = dailyPlan?.constraints.length
    ? dailyPlan.constraints
    : ["当前没有阻塞条件，系统会按真实数据继续实验。"];
  const reliableOutcomes = useMemo(() => getReliableOutcomes(workspace.articleOutcomes ?? []), [workspace.articleOutcomes]);
  const reliableRewards = useMemo(
    () => getReliableRewards(workspace.strategyLearning?.articleRewards ?? [], workspace.articleOutcomes ?? []),
    [workspace.strategyLearning?.articleRewards, workspace.articleOutcomes]
  );
  const outcomeCount = reliableOutcomes.length;
  const rewardSampleCount = reliableRewards.length;
  const recentRiskEventCount = workspace.riskEvents?.filter((event) => event.severity >= 2).length ?? 0;
  const manualBoundaryLabel = autoLoopConfig?.autoPublishEnabled ? "需复核发布权限" : "人工只发布";
  const nextActionLabel = dailyPlan?.shouldRun
    ? `生成 ${dailyPlan.recommendedArticleLimit} 篇候选草稿`
    : pendingWechatDraftCount > 0
      ? "先发布或清理微信草稿"
      : "等待真实数据或新热点";

  useEffect(() => {
    void loadCpaConfig();
    void loadWechatConfig();
    void loadDailyPlan();
  }, []);

  useEffect(() => {
    const sectionIds = ["dashboard", "topics", "settings", "accounts", "review", "strategy"];
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible?.target.id) {
          setActiveSection(visible.target.id);
        }
      },
      {
        root: null,
        rootMargin: "-18% 0px -62% 0px",
        threshold: [0.08, 0.2, 0.45, 0.7]
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const loadCpaConfig = async () => {
    try {
      const response = await fetch("/api/cpa/provider/config");
      if (!response.ok) {
        throw new Error("读取 CPA 配置失败");
      }
      const config = (await response.json()) as CpaConfigView;
      setCpaConfig(config);
      setCpaBaseUrl(config.baseUrl);
      setCpaModel(config.model);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "读取 CPA 配置失败");
    }
  };

  const loadWechatConfig = async () => {
    try {
      const response = await fetch("/api/wechat/accounts");
      if (!response.ok) {
        throw new Error("读取公众号配置失败");
      }
      const config = (await response.json()) as WechatConfigView;
      setWechatConfig(config);
      setWechatCallbackUrl(config.callbackUrl);
      setWechatPublishMode(config.publishMode);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "读取公众号配置失败");
    }
  };

  const loadDailyPlan = async () => {
    try {
      const response = await fetch("/api/experiments/daily-plan", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("读取今日计划失败");
      }
      const plan = (await response.json()) as DailyArticleLimitDecision;
      setDailyPlan(plan);
      setDailyPlanError(null);
    } catch (error) {
      setDailyPlanError(error instanceof Error ? error.message : "读取今日计划失败");
    }
  };

  const generateWechatServerToken = async () => {
    try {
      const response = await fetch("/api/wechat/token/generate", { method: "POST" });
      if (!response.ok) {
        throw new Error("生成服务器 Token 失败");
      }
      const result = (await response.json()) as { token: string };
      setWechatToken(result.token);
      setActivity("已生成服务器 Token，请把它同步填到微信公众平台服务器配置里。");
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "生成服务器 Token 失败");
    }
  };

  const saveWechatConfig = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/wechat/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: wechatAppId,
          appSecret: wechatAppSecret,
          token: wechatToken,
          encodingAesKey: wechatEncodingAesKey,
          callbackUrl: wechatCallbackUrl,
          publishMode: wechatPublishMode
        })
      });
      const result = (await response.json()) as WechatConfigView & { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "保存公众号配置失败");
      }
      setWechatConfig(result);
      setWechatAppSecret("");
      setActivity("公众号配置已保存到本地运行目录。下一步在微信后台填同一个 Token 和回调 URL。");
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "保存公众号配置失败");
    } finally {
      setIsSaving(false);
    }
  };

  const checkWechatToken = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/wechat/token/health");
      const result = (await response.json()) as { ok?: boolean; error?: string; appIdMasked?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "公众号 token 检测失败");
      }
      setActivity(`公众号 access_token 检测通过：${result.appIdMasked ?? "已配置账号"}`);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "公众号 token 检测失败");
    } finally {
      setIsSaving(false);
    }
  };

  const runArticleAction = async (
    articleId: string,
    action: ArticleAction,
    message: string
  ) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/articles/${articleId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        throw new Error("保存文章状态失败");
      }

      const updated = (await response.json()) as WorkspaceData;
      setWorkspace(updated);
      setActivity(`${message} 已保存。`);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "保存文章状态失败");
    } finally {
      setIsSaving(false);
    }
  };

  const runSuggestionAction = async (
    suggestionId: string,
    action: SuggestionAction,
    message: string
  ) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/suggestions/${suggestionId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        throw new Error("保存策略建议失败");
      }

      const updated = (await response.json()) as WorkspaceData;
      setWorkspace(updated);
      setActivity(`${message} 已保存。`);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "保存策略建议失败");
    } finally {
      setIsSaving(false);
    }
  };

  const resetWorkspace = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/workspace/reset", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("重置工作区失败");
      }

      const updated = (await response.json()) as WorkspaceData;
      setWorkspace(updated);
      setActivity("工作区已重置为种子数据。");
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "重置工作区失败");
    } finally {
      setIsSaving(false);
    }
  };

  const importTrends = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/trends/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trendImportContent })
      });

      const result = (await response.json()) as {
        workspace?: WorkspaceData;
        importedCount?: number;
        generatedTopicCount?: number;
        error?: string;
      };

      if (!response.ok || !result.workspace) {
        throw new Error(result.error ?? "导入热点失败");
      }

      setWorkspace(result.workspace);
      setTrendImportContent("");
      setActivity(`已导入 ${result.importedCount ?? 0} 条真实热点，新增 ${result.generatedTopicCount ?? 0} 个候选选题。`);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "导入热点失败");
    } finally {
      setIsSaving(false);
    }
  };

  const refreshTrends = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/trends/fetch", {
        method: "POST"
      });

      const result = (await response.json()) as {
        workspace?: WorkspaceData;
        source?: string;
        sources?: Array<{ source: string; status: "ok" | "empty" | "failed" }>;
        importedCount?: number;
        generatedTopicCount?: number;
        error?: string;
      };

      if (!response.ok || !result.workspace) {
        throw new Error(result.error ?? "抓取真实热点失败");
      }

      setWorkspace(result.workspace);
      const unavailableSources = result.sources?.filter((item) => item.status !== "ok").map((item) => item.source) ?? [];
      const unavailableNote = unavailableSources.length > 0 ? ` ${unavailableSources.join("、")} 暂不可用，已使用其余来源。` : "";
      setActivity(`已从 ${result.source ?? "真实热点源"} 抓取 ${result.importedCount ?? 0} 条热点，新增 ${result.generatedTopicCount ?? 0} 个候选选题。${unavailableNote}`);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "抓取真实热点失败");
    } finally {
      setIsSaving(false);
    }
  };

  const generateDraft = async (topicId: string, topicTitle: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/topics/${topicId}/generate`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("生成草稿失败");
      }

      const updated = (await response.json()) as WorkspaceData;
      setWorkspace(updated);
      setActivity(`已生成「${topicTitle}」草稿并保存到本地文稿目录。`);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "生成草稿失败");
    } finally {
      setIsSaving(false);
    }
  };

  const generateWeeklyReport = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/reports/weekly", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("生成周报失败");
      }

      const result = (await response.json()) as { path: string; workspace: WorkspaceData };
      setWorkspace(result.workspace);
      setActivity(`周报已生成：${result.path}`);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "生成周报失败");
    } finally {
      setIsSaving(false);
    }
  };

  const refreshWorkspace = async () => {
    const response = await fetch("/api/workspace");
    if (!response.ok) {
      throw new Error("刷新工作区失败");
    }
    const updated = (await response.json()) as WorkspaceData;
    setWorkspace(updated);
    return updated;
  };

  const runAutoProfitLoop = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/experiments/run", {
        method: "POST"
      });
      if (!response.ok) {
        throw new Error("AutoProfit 运行失败");
      }
      await refreshWorkspace();
      await loadDailyPlan();
      setActivity("AutoProfit 已按当前配置完成一次实验运行。");
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "AutoProfit 运行失败");
    } finally {
      setIsSaving(false);
    }
  };

  const stopAutoProfitLoop = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/experiments/stop", { method: "POST" });
      if (!response.ok) {
        throw new Error("停止 AutoProfit 失败");
      }
      await refreshWorkspace();
      await loadDailyPlan();
      setActivity("AutoProfit 循环已停止。");
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "停止 AutoProfit 失败");
    } finally {
      setIsSaving(false);
    }
  };

  const saveCpaConfig = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/cpa/provider/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: cpaBaseUrl,
          model: cpaModel
        })
      });

      if (!response.ok) {
        throw new Error("保存模型配置失败");
      }

      const config = (await response.json()) as CpaConfigView;
      setCpaConfig(config);
      setCpaBaseUrl(config.baseUrl);
      setCpaModel(config.model);
      setActivity(`模型已切换为 ${config.model}。`);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "保存模型配置失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className={`shell ${isSidebarCollapsed ? "sidebarCollapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">CG</div>
          <div>
            <strong>内容增长中枢</strong>
            <span>WeChat ROI Ops</span>
          </div>
          <button
            className="sidebarToggle"
            title={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
            onClick={() => setIsSidebarCollapsed((value) => !value)}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <nav className="navList" aria-label="主导航">
          <span className="navGroup">工作流</span>
          <a className={`navItem ${activeSection === "dashboard" ? "active" : ""}`} href="#dashboard">
            <Gauge size={17} />
            <span>总览</span>
          </a>
          <a className={`navItem ${activeSection === "topics" ? "active" : ""}`} href="#topics">
            <TrendingUp size={17} />
            <span>选题雷达</span>
          </a>
          <a className={`navItem ${activeSection === "review" ? "active" : ""}`} href="#review">
            <Sparkles size={17} />
            <span>草稿生产</span>
          </a>
          <a className={`navItem ${activeSection === "review" ? "active" : ""}`} href="#review">
            <FileText size={17} />
            <span>审阅发布</span>
          </a>
          <a className={`navItem ${activeSection === "strategy" ? "active" : ""}`} href="#strategy">
            <Lightbulb size={17} />
            <span>策略复盘</span>
          </a>
          <span className="navGroup">系统</span>
          <a className={`navItem ${activeSection === "settings" ? "active" : ""}`} href="#settings">
            <Settings size={17} />
            <span>模型配置</span>
          </a>
          <a className={`navItem ${activeSection === "accounts" ? "active" : ""}`} href="#accounts">
            <KeyRound size={17} />
            <span>账号管理</span>
          </a>
        </nav>
        <div className="storageBox">
          <span>本地数据 · 人工审核</span>
          <strong>默认只进草稿箱</strong>
          <a href="https://github.com/wushuai0802/wechat-content-growth" target="_blank" rel="noreferrer">
            查看源代码
          </a>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar" id="dashboard">
          <div>
            <p className="eyebrow">当前阶段 · MVP 工作台</p>
            <h1>公众号内容收益优化后台</h1>
          </div>
          <div className="topbarActions">
            <button className="iconButton" title="抓取策略" onClick={() => setActivity("策略视图已刷新。")}>
              <RefreshCcw size={17} />
            </button>
            <button className="ghostButton" onClick={resetWorkspace}>
              <RefreshCcw size={16} />
              重置数据
            </button>
            <button className="primaryButton" onClick={refreshTrends} disabled={isSaving}>
              <Sparkles size={17} />
              抓取真实热点
            </button>
          </div>
        </header>

        <div className="activityBar">
          {activity}
          {isSaving ? <span>保存中...</span> : null}
        </div>

        <section className="metricGrid" aria-label="收益概览">
          <div className="metricPanel accent">
            <span>净收益</span>
            <strong>{currency.format(stats.netRevenue)}</strong>
            <small className={`roi ${roiClass}`}>{roiClass.toUpperCase()}</small>
          </div>
          <div className="metricPanel">
            <span>收入</span>
            <strong>{currency.format(stats.totalRevenue)}</strong>
            <small>广告 / 转化 / 粉丝估值</small>
          </div>
          <div className="metricPanel">
            <span>成本</span>
            <strong>{currency.format(stats.totalCost)}</strong>
            <small>文本 / 图片 / 审核</small>
          </div>
          <div className="metricPanel">
            <span>待审阅</span>
            <strong>{stats.pendingReviews}</strong>
            <small>{stats.approvedArticles} 篇已通过</small>
          </div>
        </section>

        <section className="chartGrid" aria-label="数据观察">
          <div className="chartPanel financialChartPanel">
            <div className="sectionHeader compactHeader">
              <div>
                <p className="eyebrow">财务走势</p>
                <h2>收入 / 成本</h2>
              </div>
              <div className="chartLegend">
                <span><i style={{ background: chartPalette.revenue }} />收入</span>
                <span><i style={{ background: chartPalette.cost }} />成本</span>
              </div>
            </div>
            <FinancialBarChart series={financialSeries} />
          </div>

          <div className="chartPanel">
            <div className="sectionHeader compactHeader">
              <div>
                <p className="eyebrow">内容结构</p>
                <h2>选题组合</h2>
              </div>
              <Layers3 size={19} />
            </div>
            <ContentMixChart bars={contentMixBars} />
          </div>

          <div className="chartPanel readChartPanel">
            <div className="sectionHeader compactHeader">
              <div>
                <p className="eyebrow">内容表现</p>
                <h2>阅读趋势</h2>
              </div>
              <div className="chartLegend">
                <span><i style={{ background: chartPalette.reads }} />阅读</span>
                <span><i style={{ background: chartPalette.followers }} />转粉</span>
              </div>
            </div>
            <ReadLineChart series={readTrendSeries} />
          </div>
        </section>

        <section className="autoProfitPanel" aria-label="AutoProfit 实验循环">
          <div className="sectionHeader compactHeader">
            <div>
              <p className="eyebrow">自动收益实验</p>
              <h2>AutoProfit 循环</h2>
            </div>
            <span className={autoLoopConfig?.enabled ? "statusPill ok" : "statusPill warn"}>
              {autoLoopConfig?.enabled ? "已启用" : "未启用"}
            </span>
          </div>
          <div className="autopilotBrief" aria-label="长期实验运营摘要">
            <div className="autopilotSignal primarySignal">
              <span>今日动作</span>
              <strong>{nextActionLabel}</strong>
              <small>{manualBoundaryLabel}，AI 负责选题、生成、配图、建草稿和数据学习。</small>
            </div>
            <div className="autopilotSignal">
              <span>学习闭环</span>
              <strong>{outcomeCount > 0 ? "真实反馈" : "等待真实导入"}</strong>
              <small>{outcomeCount} 条可靠结果 / {rewardSampleCount} 个可靠奖励样本</small>
            </div>
            <div className="autopilotSignal">
              <span>服务保障</span>
              <strong>计划任务 + 开机兜底</strong>
              <small>每日 09:30 自动决策，3002 控制台用于人工确认。</small>
            </div>
            <div className="autopilotSignal">
              <span>风险学习</span>
              <strong>{recentRiskEventCount} 个高风险信号</strong>
              <small>质量、政策、取消关注和低 ROI 会影响下一轮权重。</small>
            </div>
            <div className="autopilotSignal uiSignal">
              <span>界面进化</span>
              <strong>降低操作成本</strong>
              <small>发布前错漏、返工和数据漏导入会沉淀为下一轮 UI 优化。</small>
            </div>
          </div>
          <div className="dailyPlanCard" aria-label="今日计划">
            <div className="dailyPlanTopline">
              <div>
                <p className="eyebrow">今日计划</p>
                <h3>AI 推荐生成篇数</h3>
              </div>
              <span className={`statusPill ${dailyPlanStatusClass}`}>{dailyPlanStatus}</span>
            </div>
            <div className="dailyPlanMain">
              <strong>{dailyPlan?.recommendedArticleLimit ?? "--"}</strong>
              <span>篇</span>
              <p>{dailyPlanError ?? dailyPlan?.reason ?? "正在读取今日自动实验决策。"}</p>
            </div>
            <div className="dailyPlanSignals">
              <span>待发布草稿 {dailyPlan?.signals.pendingWechatDrafts ?? pendingWechatDraftCount}</span>
              <span>可选主题 {dailyPlan?.signals.affordableCandidates ?? rankedTopics.length}</span>
              <span>近期失败 {dailyPlan?.signals.recentFailureCount ?? 0}</span>
              <span>近期真实奖励 {dailyPlan ? currency.format(dailyPlan.signals.recentAverageReward) : "--"}</span>
            </div>
            <ul className="dailyPlanReasons">
              {dailyPlanConstraints.slice(0, 3).map((constraint) => (
                <li key={constraint}>{constraint}</li>
              ))}
            </ul>
            <div className="maintenanceStrip" aria-label="候选池维护状态">
              <div>
                <span>候选池维护</span>
                <strong>{topicMaintenance.statusLabel}</strong>
              </div>
              <div>
                <span>可用候选</span>
                <strong>{topicMaintenance.candidateCount}</strong>
              </div>
              <div>
                <span>已隔离旧热点</span>
                <strong>{topicMaintenance.rejectedLegacyCount}</strong>
              </div>
              <div>
                <span>旧热点候选</span>
                <strong>{topicMaintenance.legacyCandidateCount}</strong>
              </div>
            </div>
          </div>
          <div className="autoProfitStats">
            <div>
              <span>最近状态</span>
              <strong>{latestExperimentRun?.status ?? "暂无运行"}</strong>
            </div>
            <div>
              <span>选题 / 生成</span>
              <strong>{latestExperimentRun ? `${latestExperimentRun.selectedTopicIds.length} / ${latestExperimentRun.generatedArticleIds.length}` : "0 / 0"}</strong>
            </div>
            <div>
              <span>微信草稿</span>
              <strong>{latestExperimentRun?.wechatDraftArticleIds.length ?? 0}</strong>
            </div>
            <div>
              <span>预估净收益</span>
              <strong>{currency.format(latestExperimentRun?.projectedNetProfit ?? 0)}</strong>
            </div>
          </div>
          <div className="autoProfitMeta">
            <span>模式：{autoLoopConfig?.autoPublishEnabled ? "自动发布" : "草稿优先"}</span>
            <span>每日上限：{autoLoopConfig?.dailyArticleLimit ?? 0} 篇</span>
            <span>成本上限：{currency.format(autoLoopConfig?.dailyCostCapCny ?? 0)}</span>
            <span>预计成本：{currency.format(latestExperimentRun?.estimatedCost ?? 0)}</span>
          </div>
          <p className="autoProfitDecision">
            {latestDecision?.reason ?? "还没有决策日志。运行一次后会记录选题、生成、审批和草稿动作。"}
          </p>
          <div className="autoProfitActions">
            <button className="primaryButton" onClick={runAutoProfitLoop} disabled={isSaving}>
              <Workflow size={16} />
              运行一次
            </button>
            <button className="ghostButton" onClick={stopAutoProfitLoop} disabled={isSaving}>
              <PanelLeftClose size={16} />
              停止循环
            </button>
          </div>
        </section>

        <section className="commandGrid">
          <div className="panel topicPanel" id="topics">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">选题雷达</p>
                <h2>高优先级选题</h2>
              </div>
              <button className="ghostButton" onClick={() => setActivity("内容日历将在 Phase 2 接入节日和行业事件源。")}>
                <CalendarClock size={16} />
                内容日历
              </button>
            </div>
            <div className="topicList">
              {rankedTopics.length === 0 ? (
                <div className="emptyState">
                  <strong>暂无可生产选题</strong>
                  <span>先抓取真实热点或导入公众号热点表，系统会重新生成候选主题。</span>
                </div>
              ) : null}
              {rankedTopics.slice(0, 5).map((ranked) => {
                const topic = ranked.topic;
                const strategy = topic.contentStrategy ?? topic.opportunityProfile?.strategy;
                const channel = topic.primaryMonetizationChannel ?? ranked.forecast.primaryChannel;
                const evidenceReady = isTopicEvidenceReady(topic);
                return (
                <article className="topicRow" key={topic.id}>
                  <div className="scoreDial" title="置信度折现后的综合利润分">{Math.round(ranked.score)}</div>
                  <div className="rowMain">
                    <div className="rowTitle">
                      <h3>{topic.title}</h3>
                      <span className={`chip ${topic.source}`}>
                        {strategy ? contentStrategyLabel[strategy] : sourceLabel[topic.source]}
                      </span>
                    </div>
                    <p>
                      7 天净收益 {currency.format(ranked.forecast.d7.netProfit)} · {monetizationChannelLabel[channel]} ·
                      置信度 {Math.round(ranked.forecast.confidence * 100)}% · 风险 {topic.risk}
                      {!evidenceReady ? " · 待补原创证据" : ""}
                    </p>
                  </div>
                  <button
                    className="iconButton"
                    title={evidenceReady ? "生成草稿" : "需先完成并核验原创证据"}
                    onClick={() => generateDraft(topic.id, topic.title)}
                    disabled={!evidenceReady}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </article>
                );
              })}
            </div>
          </div>

          <div className="panel portfolioPanel">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">内容组合</p>
                <h2>内容组合</h2>
              </div>
              <BarChart3 size={20} />
            </div>
            <div className="mixGrid">
              {Object.entries(mix).map(([source, count]) => (
                <div className="mixItem" key={source}>
                  <span>{sourceLabel[source as keyof typeof sourceLabel]}</span>
                  <strong>{count}</strong>
                  <div className="barTrack">
                    <div style={{ width: `${count * 18}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel trendPanel">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">热点信号池</p>
                <h2>趋势信号</h2>
              </div>
              <button className="ghostButton" onClick={refreshTrends} disabled={isSaving}>
                <RefreshCcw size={16} />
                抓取
              </button>
            </div>
            <div className="trendImportBox">
              <label className="field">
                <span>导入真实热点</span>
                <textarea
                  value={trendImportContent}
                  onChange={(event) => setTrendImportContent(event.target.value)}
                  placeholder={["title,source,heat,growth,competition,category,keywords,url", "AI 搜索产品更新,manual,82,18,44,人工智能,AI搜索|效率工具,https://example.com/a"].join("\n")}
                />
              </label>
              <button className="primaryButton" onClick={importTrends} disabled={isSaving || !trendImportContent.trim()}>
                <Upload size={16} />
                导入热点
              </button>
            </div>
            <div className="trendList">
              {topTrendSignals.length === 0 ? (
                <div className="emptyState">
                  <strong>热点池为空</strong>
                  <span>每日任务会自动导入热点，也可以手动粘贴 CSV/JSON 做补充。</span>
                </div>
              ) : null}
              {topTrendSignals.map((signal) => (
                <article className="trendRow" key={signal.id}>
                  <div>
                    <h3>{signal.title}</h3>
                    <p>{signal.category} · {signal.keywords.slice(0, 3).join(" / ")}</p>
                  </div>
                  <div className="trendStats" aria-label="趋势指标">
                    <span>热度 {signal.heat}</span>
                    <span>增长 {signal.growth}</span>
                    <span>竞争 {signal.competition}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="opsRail" aria-label="运行状态">
            <section className="railPanel darkPanel">
              <div className="railHeader">
                <Cpu size={18} />
                <span>CPA Provider</span>
              </div>
              <strong>{cpaConfig?.model || "未加载"}</strong>
              <p>{cpaConfig?.baseUrl || "正在读取本地 CPA 配置"}</p>
              <div className="statusLine">
                <Activity size={15} />
                <span>模型池 {cpaConfig?.models.length ?? 0} · {cpaConfig?.keyConfigured ? "生产可用" : "待配置 key"}</span>
              </div>
            </section>

            <section className="railPanel">
              <div className="railHeader">
                <CircleDollarSign size={18} />
                <span>{stats.totalRevenue > 0 ? "真实收益漏斗" : "收益漏斗待导入"}</span>
              </div>
              <div className="funnelList">
                <div>
                  <span>收入</span>
                  <strong>{currency.format(stats.totalRevenue)}</strong>
                </div>
                <div>
                  <span>成本率</span>
                  <strong>{costRatio}%</strong>
                </div>
                <div>
                  <span>已发布</span>
                  <strong>{publishedArticles.length}</strong>
                </div>
              </div>
            </section>

            <section className="railPanel">
              <div className="railHeader">
                <ClipboardCheck size={18} />
                <span>今日动作</span>
              </div>
              <ul className="actionList">
                <li>审阅 {reviewArticles.length} 篇待定稿</li>
                <li>根据净收益生成周报</li>
                <li>保留热点/常青/系列比例</li>
              </ul>
            </section>

            <section className="railPanel compact">
              <div className="railHeader">
                <HardDrive size={18} />
                <span>存储</span>
              </div>
              <p>运行数据、文稿、图片和报表默认保存在 .data/。</p>
            </section>
          </aside>
        </section>

        <section className="settingsPanel" id="settings">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">系统设置</p>
              <h2>模型与生产配置</h2>
            </div>
            <button className="ghostButton" onClick={loadCpaConfig}>
              <RefreshCcw size={16} />
              刷新配置
            </button>
          </div>
          <div className="settingsGrid">
            <div className="settingCard primarySetting">
              <div className="settingTitle">
                <Cpu size={18} />
                <div>
                  <strong>CPA 模型</strong>
                  <span>控制后续草稿生成使用的模型</span>
                </div>
              </div>
              <label className="field">
                <span>baseURL</span>
                <input value={cpaBaseUrl} onChange={(event) => setCpaBaseUrl(event.target.value)} />
              </label>
              <label className="field">
                <span>模型</span>
                <select value={cpaModel} onChange={(event) => setCpaModel(event.target.value)}>
                  {cpaConfig?.models.length ? (
                    cpaConfig.models.map((model) => (
                      <option value={model} key={model}>{model}</option>
                    ))
                  ) : (
                    <option value={cpaModel}>{cpaModel || "未加载模型"}</option>
                  )}
                </select>
              </label>
              <div className="settingActions">
                <span className={cpaConfig?.keyConfigured ? "statusPill ok" : "statusPill warn"}>
                  <KeyRound size={14} />
                  {cpaConfig?.keyConfigured ? "Key 已配置" : "Key 未配置"}
                </span>
                <button className="primaryButton" onClick={saveCpaConfig}>
                  <Check size={16} />
                  保存并切换
                </button>
              </div>
            </div>

            <div className="settingCard">
              <div className="settingTitle">
                <Workflow size={18} />
                <div>
                  <strong>工作流约束</strong>
                  <span>保证自动化不越过人工审阅</span>
                </div>
              </div>
              <div className="constraintList">
                <span>选题评分低于 60 进入观察池</span>
                <span>所有 CPA 草稿默认进入待审阅</span>
                <span>发布动作只在微信 adapter 接入后启用</span>
              </div>
            </div>

            <div className="settingCard">
              <div className="settingTitle">
                <SlidersHorizontal size={18} />
                <div>
                  <strong>成本控制</strong>
                  <span>下一阶段会接入模型价格和生成预算</span>
                </div>
              </div>
              <div className="budgetLine">
                <span>当前成本率</span>
                <strong>{costRatio}%</strong>
              </div>
              <div className="budgetLine">
                <span>待审阅稿件</span>
                <strong>{reviewArticles.length}</strong>
              </div>
            </div>
          </div>
        </section>

                <section className="accountPanel" id="accounts">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">账号资产</p>
              <h2>公众号账号接入</h2>
            </div>
            <button className="ghostButton" onClick={loadWechatConfig}>
              <RefreshCcw size={16} />
              刷新配置
            </button>
          </div>
          <div className="wechatSetupGrid">
            <article className="wechatSetupCard">
              <div className="settingTitle">
                <KeyRound size={18} />
                <div>
                  <strong>本地公众号配置</strong>
                  <span>密钥只保存到本地运行目录，不写入代码仓。</span>
                </div>
              </div>
              <div className="constraintList compactList">
                <span>1. 微信公众平台：设置与开发 → 基本配置。</span>
                <span>2. 复制 AppID，重置或复制 AppSecret。</span>
                <span>3. 服务器配置 Token 可点下方生成，并填回微信后台。</span>
                <span>4. URL 必须是公网 HTTPS，不能用 127.0.0.1。</span>
              </div>
              <div className="wechatStatusLine">
                <span className={wechatConfig?.configured ? "statusPill ok" : "statusPill warn"}>
                  {wechatConfig?.configured ? "已保存配置" : "未保存配置"}
                </span>
                <span>{wechatConfig?.appIdMasked || "AppID 待填写"}</span>
              </div>
            </article>

            <article className="wechatSetupCard wechatFormCard">
              <label className="field">
                <span>AppID</span>
                <input value={wechatAppId} onChange={(event) => setWechatAppId(event.target.value)} placeholder={wechatConfig?.appIdMasked || "wx..."} />
              </label>
              <label className="field">
                <span>AppSecret</span>
                <input type="password" value={wechatAppSecret} onChange={(event) => setWechatAppSecret(event.target.value)} placeholder={wechatConfig?.appSecretConfigured ? "已配置，留空会保持原值" : "从公众号后台复制"} />
              </label>
              <label className="field">
                <span>服务器 Token</span>
                <div className="inlineFieldAction">
                  <input value={wechatToken} onChange={(event) => setWechatToken(event.target.value)} placeholder={wechatConfig?.tokenConfigured ? "已配置，留空会保持原值" : "点击生成或手动填写"} />
                  <button className="ghostButton" type="button" onClick={generateWechatServerToken}>生成</button>
                </div>
              </label>
              <label className="field">
                <span>EncodingAESKey</span>
                <input value={wechatEncodingAesKey} onChange={(event) => setWechatEncodingAesKey(event.target.value)} placeholder={wechatConfig?.encodingAesKeyConfigured ? "已配置，留空会保持原值" : "微信后台生成"} />
              </label>
              <label className="field">
                <span>回调 URL</span>
                <input value={wechatCallbackUrl} onChange={(event) => setWechatCallbackUrl(event.target.value)} placeholder="https://你的公网域名/api/wechat/callback" />
              </label>
              <label className="field">
                <span>发布模式</span>
                <select value={wechatPublishMode} onChange={(event) => setWechatPublishMode(event.target.value as WechatConfigView["publishMode"])}>
                  <option value="draft_only">仅创建草稿</option>
                  <option value="manual_review">人工审阅后发布</option>
                  <option value="auto_publish">自动发布</option>
                </select>
              </label>
              <div className="settingActions">
                <button className="ghostButton" onClick={checkWechatToken} disabled={isSaving || !wechatConfig?.configured}>
                  <Check size={16} />
                  检测 token
                </button>
                <button className="primaryButton" onClick={saveWechatConfig} disabled={isSaving}>
                  <Check size={16} />
                  保存公众号配置
                </button>
              </div>
            </article>
          </div>
        </section>

        <section className="reviewStrategyGrid">
          <div className="panel" id="review">
            <div className="sectionHeader">
            <div>
              <p className="eyebrow">审阅队列</p>
              <h2>审阅与发布</h2>
            </div>
            <button className="ghostButton" onClick={() => setActivity("已模拟批量创建草稿。真实发布将在 PublisherPort 接入后启用。")}>
              <Send size={16} />
              批量创建草稿
            </button>
          </div>
          <div className="reviewTable">
            <div className="tableHeader">
              <span>文章</span>
              <span>质量</span>
              <span>风险</span>
              <span>预估</span>
              <span>动作</span>
            </div>
            {visibleArticles.length === 0 ? (
              <div className="emptyState tableEmpty">
                <strong>当前没有本地草稿</strong>
                <span>今日计划允许运行时，点击“运行一次”会让 AI 自行选择主题并创建新草稿。</span>
              </div>
            ) : null}
            {visibleArticles.map((article) => (
              <div className="tableRow" key={article.id}>
                <div className="articleCell">
                  <FileText size={18} />
                  <div>
                    <strong>{article.title}</strong>
                    <span>{statusLabel[article.status]}</span>
                  </div>
                </div>
                <span className="mobileMetric" data-label="质量">{article.qualityScore}</span>
                <span className={`mobileMetric ${article.riskScore > 20 ? "riskText" : ""}`} data-label="风险">
                  {article.riskScore}
                </span>
                <span className="mobileMetric" data-label="预估">
                  {currency.format(article.estimatedRevenue - article.estimatedCost)}
                </span>
                <div className="actionGroup">
                  <a className="iconButton" title="打开编辑" href={`/articles/${article.id}`}>
                    <FileText size={16} />
                  </a>
                  <button className="iconButton" title="重写" onClick={() => setActivity(`已模拟重写「${article.title}」。`)}>
                    <RefreshCcw size={16} />
                  </button>
                  <a className="iconButton" title="管理配图" href={`/articles/${article.id}#visuals`}>
                    <Image size={16} />
                  </a>
                  {article.status === "review" ? (
                    <button
                      className="iconButton"
                      title="通过"
                      onClick={() => runArticleAction(article.id, "approve", `已通过「${article.title}」。`)}
                    >
                      <Check size={16} />
                    </button>
                  ) : null}
                  {article.status === "approved" ? (
                    <button
                      className="iconButton"
                      title="创建微信草稿"
                      onClick={() => runArticleAction(article.id, "create_wechat_draft", `已创建「${article.title}」微信草稿。`)}
                    >
                      <Send size={16} />
                    </button>
                  ) : null}
                  {article.status === "publish_submitted" || article.status === "needs_reconcile" ? (
                    <button
                      className="iconButton"
                      title="确认已发布"
                      onClick={() => runArticleAction(article.id, "publish", `已确认「${article.title}」发布成功。`)}
                    >
                      <Check size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          </div>

          <div className="panel sidePanel" id="strategy">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">AI 策略</p>
              <h2>策略建议</h2>
            </div>
            <button className="ghostButton" onClick={generateWeeklyReport}>
              <CircleDollarSign size={16} />
              生成周报
            </button>
          </div>
          <div className="latestBox">
            <div>
              <Layers3 size={18} />
              <span>最新草稿</span>
            </div>
            <strong>{latestArticle?.title ?? "暂无草稿"}</strong>
          </div>
          <div className="suggestionGrid">
            {orderedSuggestions.length === 0 ? (
              <div className="emptyState">
                <strong>暂无新的策略建议</strong>
                <span>导入真实阅读、关注和收益数据后，系统会生成下一轮优化建议。</span>
              </div>
            ) : null}
            {orderedSuggestions.map((suggestion) => (
              <article className="suggestion" key={suggestion.id}>
                <div className="suggestionTop">
                  <span className={`priority ${suggestion.priority}`}>
                    {priorityLabel[suggestion.priority]}
                  </span>
                  {suggestion.requiresApproval ? <ShieldAlert size={16} /> : <Check size={16} />}
                </div>
                <h3>{suggestion.title}</h3>
                <p>{suggestion.evidence}</p>
                <dl>
                  <div>
                    <dt>收益</dt>
                    <dd>{suggestion.expectedBenefit}</dd>
                  </div>
                  <div>
                    <dt>动作</dt>
                    <dd>{suggestion.action}</dd>
                  </div>
                </dl>
                <div className="suggestionActions">
                  <button
                    className="ghostButton"
                    onClick={() => runSuggestionAction(suggestion.id, "accept", `已采纳建议：${suggestion.title}`)}
                  >
                    <Check size={15} />
                    采纳
                  </button>
                  <button
                    className="ghostButton"
                    onClick={() => runSuggestionAction(suggestion.id, "dismiss", `已忽略建议：${suggestion.title}`)}
                  >
                    忽略
                  </button>
                </div>
              </article>
            ))}
          </div>
          </div>
        </section>
      </section>
    </main>
  );
}
