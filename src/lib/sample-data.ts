import type {
  ArticleMetrics,
  ArticlePackage,
  CostRecord,
  RevenueRecord,
  StrategySuggestion,
  TrendSignal,
  TopicCandidate,
  WechatAccount
} from "./domain";
import { join } from "node:path";
import { getArticleApprovedDir, getArticleDraftsDir, getArticlePublishedDir, getCoverImagesDir } from "./paths";

export const accounts: WechatAccount[] = [
  {
    id: "account-main",
    name: "内容增长实验室",
    appIdMasked: "wx••••••9F2A",
    positioning: "AI 工具、效率系统、内容自动化",
    audience: "知识工作者 / 独立开发者 / 增长运营者",
    status: "connected",
    publishMode: "manual_review",
    monthlyRevenueTarget: 12000,
    monthlyCostCap: 1800,
    followers: 8420,
    owner: "主账号",
    updatedAt: "2026-06-18T06:30:00.000Z"
  },
  {
    id: "account-test",
    name: "数码决策备选号",
    appIdMasked: "wx••••••31C7",
    positioning: "消费科技、NAS、家庭自动化",
    audience: "数码消费人群 / 家庭存储用户",
    status: "needs_review",
    publishMode: "draft_only",
    monthlyRevenueTarget: 5000,
    monthlyCostCap: 900,
    followers: 2310,
    owner: "测试账号",
    updatedAt: "2026-06-17T21:10:00.000Z"
  }
];

export const trendSignals: TrendSignal[] = [
  {
    id: "trend-ai-agent-office",
    title: "AI Agent 办公自动化",
    source: "mock_hot_source",
    url: "https://example.com/trends/ai-agent-office",
    heat: 91,
    growth: 24,
    competition: 42,
    category: "人工智能",
    keywords: ["AI Agent", "办公自动化", "效率工具"],
    observedAt: "2026-06-18T08:00:00.000Z"
  },
  {
    id: "trend-content-roi",
    title: "内容副业真实利润复盘",
    source: "mock_hot_source",
    url: "https://example.com/trends/content-roi",
    heat: 78,
    growth: 19,
    competition: 35,
    category: "creator economy",
    keywords: ["内容副业", "真实利润", "复盘"],
    observedAt: "2026-06-18T08:10:00.000Z"
  },
  {
    id: "trend-nas-home-lab",
    title: "家庭 NAS 与本地 AI 工作流",
    source: "mock_hot_source",
    url: "https://example.com/trends/nas-home-lab",
    heat: 73,
    growth: 16,
    competition: 48,
    category: "consumer tech",
    keywords: ["NAS", "本地 AI", "家庭自动化"],
    observedAt: "2026-06-18T08:20:00.000Z"
  }
];

export const topics: TopicCandidate[] = [
  {
    id: "topic-hot-1",
    title: "端午后 AI 办公工具更新潮：哪些功能真的能省时间",
    source: "hot",
    category: "AI productivity",
    audience: "知识工作者",
    angle: "实操清单",
    status: "candidate",
    expectedRevenue: 520,
    timeliness: 88,
    accountFit: 92,
    historicalSimilarity: 78,
    risk: 16,
    estimatedCost: 42,
    saturation: 39,
    createdAt: "2026-06-17T07:10:00.000Z"
  },
  {
    id: "topic-hot-2",
    title: "618 后家用 NAS 价格变化：普通用户该不该入手",
    source: "hot",
    category: "consumer tech",
    audience: "数码消费人群",
    angle: "购买决策",
    status: "candidate",
    expectedRevenue: 430,
    timeliness: 82,
    accountFit: 81,
    historicalSimilarity: 71,
    risk: 22,
    estimatedCost: 50,
    saturation: 44,
    createdAt: "2026-06-17T07:30:00.000Z"
  },
  {
    id: "topic-evergreen-1",
    title: "如何建立一个可复用的个人知识库工作流",
    source: "evergreen",
    category: "productivity",
    audience: "长期学习者",
    angle: "教程",
    status: "approved",
    expectedRevenue: 360,
    timeliness: 45,
    accountFit: 94,
    historicalSimilarity: 85,
    risk: 8,
    estimatedCost: 35,
    saturation: 28,
    createdAt: "2026-06-17T08:00:00.000Z"
  },
  {
    id: "topic-evergreen-2",
    title: "副业内容账号如何计算真实利润",
    source: "evergreen",
    category: "creator economy",
    audience: "个人创作者",
    angle: "方法论",
    status: "candidate",
    expectedRevenue: 390,
    timeliness: 52,
    accountFit: 90,
    historicalSimilarity: 73,
    risk: 14,
    estimatedCost: 38,
    saturation: 31,
    createdAt: "2026-06-17T08:15:00.000Z"
  },
  {
    id: "topic-series-1",
    title: "公众号自动化增长系统第 1 篇：从选题到收益闭环",
    source: "series",
    category: "automation",
    audience: "独立开发者",
    angle: "系列栏目",
    status: "approved",
    expectedRevenue: 470,
    timeliness: 64,
    accountFit: 96,
    historicalSimilarity: 82,
    risk: 10,
    estimatedCost: 46,
    saturation: 24,
    createdAt: "2026-06-17T08:30:00.000Z"
  },
  {
    id: "topic-exp-1",
    title: "用 AI 自动做选题投资组合是否可行",
    source: "experimental",
    category: "content strategy",
    audience: "增长运营者",
    angle: "实验复盘",
    status: "candidate",
    expectedRevenue: 280,
    timeliness: 58,
    accountFit: 86,
    historicalSimilarity: 48,
    risk: 20,
    estimatedCost: 55,
    saturation: 26,
    createdAt: "2026-06-17T08:45:00.000Z"
  }
];

export const articles: ArticlePackage[] = [
  {
    id: "article-1",
    topicId: "topic-hot-1",
    title: "这轮 AI 办公工具更新，真正值得普通人用的是这 5 个功能",
    summary: "从节省时间、稳定性和上手成本三个维度拆解近期 AI 办公工具更新。",
    status: "review",
    contentPath: join(getArticleDraftsDir(), "article-1.md"),
    coverPath: join(getCoverImagesDir(), "article-1.png"),
    qualityScore: 84,
    riskScore: 18,
    estimatedCost: 42,
    estimatedRevenue: 520,
    createdAt: "2026-06-17T09:00:00.000Z"
  },
  {
    id: "article-2",
    topicId: "topic-evergreen-1",
    title: "个人知识库别再堆资料了，先搭这 4 层结构",
    summary: "把资料、项目、输出和复盘拆开，建立长期可复用的知识系统。",
    status: "approved",
    contentPath: join(getArticleApprovedDir(), "article-2.md"),
    coverPath: join(getCoverImagesDir(), "article-2.png"),
    qualityScore: 90,
    riskScore: 9,
    estimatedCost: 35,
    estimatedRevenue: 360,
    createdAt: "2026-06-17T09:20:00.000Z"
  },
  {
    id: "article-3",
    topicId: "topic-series-1",
    title: "做内容自动化之前，先把收益闭环画清楚",
    summary: "从选题、生产、审核、发布到 ROI 复盘，拆解内容系统的第一性原理。",
    status: "published",
    contentPath: join(getArticlePublishedDir(), "article-3.md"),
    coverPath: join(getCoverImagesDir(), "article-3.png"),
    qualityScore: 88,
    riskScore: 11,
    estimatedCost: 46,
    estimatedRevenue: 470,
    createdAt: "2026-06-17T09:40:00.000Z"
  },
  {
    id: "article-4",
    topicId: "topic-exp-1",
    title: "把公众号选题当投资组合，会发生什么",
    summary: "用小规模实验验证热点、常青、系列和探索型内容的收益差异。",
    status: "review",
    contentPath: join(getArticleDraftsDir(), "article-4.md"),
    coverPath: join(getCoverImagesDir(), "article-4.png"),
    qualityScore: 79,
    riskScore: 24,
    estimatedCost: 55,
    estimatedRevenue: 280,
    createdAt: "2026-06-17T10:00:00.000Z"
  }
];

export const costs: CostRecord[] = [
  {
    id: "cost-1",
    articleId: "article-1",
    type: "text_generation",
    provider: "seed",
    quantity: 1,
    unitCost: 28,
    totalCost: 28,
    createdAt: "2026-06-17T09:00:00.000Z"
  },
  {
    id: "cost-2",
    articleId: "article-1",
    type: "image_generation",
    provider: "seed",
    quantity: 2,
    unitCost: 7,
    totalCost: 14,
    createdAt: "2026-06-17T09:03:00.000Z"
  },
  {
    id: "cost-3",
    articleId: "article-2",
    type: "text_generation",
    provider: "seed",
    quantity: 1,
    unitCost: 26,
    totalCost: 26,
    createdAt: "2026-06-17T09:20:00.000Z"
  },
  {
    id: "cost-4",
    articleId: "article-2",
    type: "manual_review",
    provider: "human",
    quantity: 0.25,
    unitCost: 80,
    totalCost: 20,
    createdAt: "2026-06-17T09:35:00.000Z"
  },
  {
    id: "cost-5",
    articleId: "article-3",
    type: "text_generation",
    provider: "seed",
    quantity: 1,
    unitCost: 31,
    totalCost: 31,
    createdAt: "2026-06-17T09:40:00.000Z"
  },
  {
    id: "cost-6",
    articleId: "article-3",
    type: "image_generation",
    provider: "seed",
    quantity: 3,
    unitCost: 9,
    totalCost: 27,
    createdAt: "2026-06-17T09:44:00.000Z"
  },
  {
    id: "cost-7",
    articleId: "article-4",
    type: "text_generation",
    provider: "seed",
    quantity: 1,
    unitCost: 14,
    totalCost: 14,
    createdAt: "2026-06-17T10:00:00.000Z"
  },
  {
    id: "cost-8",
    articleId: "article-4",
    type: "image_generation",
    provider: "seed",
    quantity: 2,
    unitCost: 7,
    totalCost: 14,
    createdAt: "2026-06-17T10:05:00.000Z"
  }
];

export const revenue: RevenueRecord[] = [
  {
    id: "revenue-1",
    articleId: "article-1",
    type: "ad",
    amount: 190,
    currency: "CNY",
    source: "estimate",
    confidence: 0.55,
    recordedAt: "2026-06-17T12:00:00.000Z"
  },
  {
    id: "revenue-2",
    articleId: "article-2",
    type: "follower_value",
    amount: 160,
    currency: "CNY",
    source: "estimate",
    confidence: 0.65,
    recordedAt: "2026-06-17T12:05:00.000Z"
  },
  {
    id: "revenue-3",
    articleId: "article-3",
    type: "ad",
    amount: 310,
    currency: "CNY",
    source: "manual",
    confidence: 0.9,
    recordedAt: "2026-06-17T12:10:00.000Z"
  },
  {
    id: "revenue-4",
    articleId: "article-3",
    type: "affiliate",
    amount: 140,
    currency: "CNY",
    source: "manual",
    confidence: 0.85,
    recordedAt: "2026-06-17T12:12:00.000Z"
  },
  {
    id: "revenue-5",
    articleId: "article-4",
    type: "follower_value",
    amount: 70,
    currency: "CNY",
    source: "estimate",
    confidence: 0.45,
    recordedAt: "2026-06-17T12:20:00.000Z"
  }
];

export const metrics: ArticleMetrics[] = [
  {
    articleId: "article-3",
    reads: 8420,
    shares: 318,
    favorites: 522,
    newFollowers: 146,
    unfollows: 11,
    collectedAt: "2026-06-17T12:30:00.000Z"
  }
];

export const strategySuggestions: StrategySuggestion[] = [
  {
    id: "suggestion-1",
    priority: "high",
    title: "本周加码 AI 实操教程",
    evidence: "同类主题历史相似度和账号匹配度均高，预计 ROI 高于当前均值。",
    expectedBenefit: "提升收藏和转粉，形成可复用系列。",
    risk: "同质化内容较多，需要强调实操截图和成本收益。",
    action: "新增 3 个 AI 工具实操选题进入生产队列。",
    requiresApproval: true,
    createdAt: "2026-06-17T13:00:00.000Z"
  },
  {
    id: "suggestion-2",
    priority: "high",
    title: "限制低置信收益文章的图片预算",
    evidence: "探索型文章预估收益低，图片生成成本占比偏高。",
    expectedBenefit: "降低试错成本，保持实验数量。",
    risk: "封面质量下降可能影响点击。",
    action: "低于 60 分的选题只生成 1 张封面候选。",
    requiresApproval: true,
    createdAt: "2026-06-17T13:05:00.000Z"
  },
  {
    id: "suggestion-3",
    priority: "medium",
    title: "把内容自动化主题拆成系列栏目",
    evidence: "系列主题账号匹配度最高，适合建立长期心智。",
    expectedBenefit: "提高复访率和关注转化。",
    risk: "短期热点流量可能低于突发内容。",
    action: "每周固定 1 篇系统建设复盘。",
    requiresApproval: true,
    createdAt: "2026-06-17T13:10:00.000Z"
  },
  {
    id: "suggestion-4",
    priority: "low",
    title: "测试晚间发布时间",
    evidence: "当前样本不足，晚间可能提升完整阅读。",
    expectedBenefit: "找到更适合知识型内容的阅读窗口。",
    risk: "需要至少 2 周样本验证。",
    action: "选 2 篇常青内容在 21:30 发布。",
    requiresApproval: false,
    createdAt: "2026-06-17T13:15:00.000Z"
  }
];
