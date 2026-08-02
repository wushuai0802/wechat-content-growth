import type {
  ContentExperimentTag,
  ContentStrategy,
  EvidenceReadiness,
  MonetizationChannel,
  TopicCandidate,
  TopicOpportunityProfile,
  TrendSignal,
  WechatAccount
} from "./domain";
import { buildTopicRevenueForecast, discountedExpectedNetProfit } from "./topic-profit-forecast";

export interface RankedTrendSignal extends TrendSignal {
  opportunityScore: number;
}

export interface GenerateTopicsOptions {
  account: WechatAccount;
  existingTopicTitles: string[];
  now?: Date;
  limit?: number;
}

interface ContentEngine {
  strategy: ContentStrategy;
  experimentTag: ContentExperimentTag;
  category: string;
  audience: string;
  angle: string;
  title: (signal: TrendSignal) => string;
  expectedRevenueLift: number;
  profitFitLift: number;
  riskLift: number;
  primaryChannel: MonetizationChannel;
}

const BLOCKED_TREND_KEYWORDS = [
  "习近平",
  "总书记",
  "新华社",
  "党员",
  "中央",
  "国务院",
  "外交",
  "外交部",
  "政治",
  "军事",
  "战争",
  "刑事",
  "命案",
  "灾难",
  "事故",
  "疫情",
  "暴雨",
  "台风",
  "洪水",
  "防汛",
  "汛情",
  "地震",
  "火灾",
  "泥石流",
  "山体滑坡",
  "积水",
  "施救",
  "救援",
  "被困",
  "失联",
  "遇难",
  "死亡",
  "坠亡",
  "爆炸",
  "坍塌",
  "伤亡",
  "暴力",
  "political",
  "public policy",
  "military",
  "war"
];

export const DEFAULT_TREND_TOPIC_POOL_LIMIT = 30;

const HIGH_STAKES_KEYWORDS = [
  "高考",
  "招生",
  "志愿填报",
  "录取",
  "退档",
  "取消资格",
  "政策",
  "医疗",
  "疾病",
  "法律",
  "股市",
  "股票",
  "投资",
  "指数",
  "大跌",
  "暴跌",
  "涨停",
  "跌停",
  "A股",
  "基金",
  "理财",
  "黄金",
  "汇率",
  "期货",
  "债券",
  "币圈",
  "谣言",
  "被罚",
  "处罚"
];

const COMMERCIAL_INTENT_KEYWORDS = [
  "产品",
  "工具",
  "价格",
  "预算",
  "购买",
  "选购",
  "对比",
  "推荐",
  "课程",
  "服务",
  "AI",
  "Agent",
  "SaaS",
  "NAS",
  "省钱",
  "副业"
];

const CONTENT_ENGINES: Record<ContentStrategy, ContentEngine> = {
  chase: {
    strategy: "chase",
    experimentTag: "mass-pain-point",
    category: "热点价值翻译",
    audience: "关心热点如何影响钱、工作和选择的普通读者",
    angle: "事件发生了什么 -> 影响谁 -> 决策窗口 -> 今天能做什么",
    title: (signal) => `${signal.title}正在升温：与你的钱、工作和选择有什么关系`,
    expectedRevenueLift: 1.08,
    profitFitLift: 3,
    riskLift: 0,
    primaryChannel: "traffic_ad"
  },
  manufacture: {
    strategy: "manufacture",
    experimentTag: "profit-review",
    category: "原创实测与排名",
    audience: "不满足于转述、愿意看实测和数据的读者",
    angle: "原创采样/实测/排名 -> 公开方法 -> 反直觉发现 -> 可复核结论",
    title: (signal) => `不跟风评价${signal.title}：我们准备按 5 个指标做一次实测`,
    expectedRevenueLift: 1.16,
    profitFitLift: 0,
    riskLift: 2,
    primaryChannel: "follower_ltv"
  },
  convert: {
    strategy: "convert",
    experimentTag: "buyer-guide",
    category: "高意向选择指南",
    audience: "已经准备行动、需要比较成本与替代方案的读者",
    angle: "使用场景 -> 预算分档 -> 选项对比 -> 避坑 -> 低压力转化",
    title: (signal) => `${signal.title}之后怎么选：预算、门槛与替代方案对照表`,
    expectedRevenueLift: 1.22,
    profitFitLift: -1,
    riskLift: 1,
    primaryChannel: "affiliate"
  }
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function signalText(signal: TrendSignal): string {
  return `${signal.title} ${signal.category} ${signal.keywords.join(" ")}`;
}

function includesKeyword(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function isSafeTrendSignal(signal: TrendSignal): boolean {
  return !includesKeyword(signalText(signal), BLOCKED_TREND_KEYWORDS);
}

function isHighStakes(signal: TrendSignal): boolean {
  return includesKeyword(signalText(signal), HIGH_STAKES_KEYWORDS);
}

function estimateProfitAudienceFit(signal: TrendSignal): number {
  if (signal.audienceOverlap !== undefined) return clampScore(signal.audienceOverlap);
  const monetizationIntent = signal.monetizationIntent ?? defaultMonetizationIntent(signal);
  const contentSupplyGap = signal.contentSupplyGap ?? 100 - signal.competition;
  const policyRisk = signal.policyRisk ?? (isHighStakes(signal) ? 55 : 10);
  return clampScore(
    50
    + signal.heat * 0.2
    + monetizationIntent * 0.2
    + contentSupplyGap * 0.15
    - policyRisk * 0.2
  );
}

function defaultHalfLife(signal: TrendSignal): number {
  if (signal.source === "baidu" || signal.source === "weibo" || signal.source === "toutiao") return 30;
  if (signal.source === "zhihu" || signal.source === "news") return 72;
  if (signal.source === "wechat_public") return 120;
  return 72;
}

function defaultConfidence(signal: TrendSignal): number {
  if (signal.source === "baidu" || signal.source === "weibo" || signal.source === "toutiao" || signal.source === "zhihu") return 72;
  if (signal.source === "wechat_public" || signal.source === "news") return 65;
  return 55;
}

function defaultMonetizationIntent(signal: TrendSignal): number {
  const commercialMatches = COMMERCIAL_INTENT_KEYWORDS.filter((keyword) => signalText(signal).toLowerCase().includes(keyword.toLowerCase())).length;
  return clampScore(28 + commercialMatches * 14);
}

function evidenceReadiness(signal: TrendSignal, strategy: ContentStrategy): EvidenceReadiness {
  if (signal.evidenceReadiness) return signal.evidenceReadiness;
  if (strategy === "manufacture" || isHighStakes(signal)) return "needs_research";
  return "ready";
}

function evidencePlan(signal: TrendSignal, strategy: ContentStrategy): string[] {
  if (signal.evidenceNotes?.length) return signal.evidenceNotes;
  if (strategy === "manufacture") return ["完成原创实测或数据采集", "保存样本、时间和方法", "让结论可被复核"];
  if (strategy === "convert") return ["核对价格、功能和适用条件", "披露返佣或商业关系"];
  return ["核对热点原始来源和发生时间", "确认受影响人群与行动窗口"];
}

function productionLatency(signal: TrendSignal, strategy: ContentStrategy): number {
  if (signal.productionLatencyHours && signal.productionLatencyHours > 0) return signal.productionLatencyHours;
  if (strategy === "manufacture") return 18;
  if (strategy === "convert") return 6;
  return 3;
}

function opportunityFor(
  signal: TrendSignal,
  strategy: ContentStrategy,
  profitAudienceFit: number
): TopicOpportunityProfile {
  return {
    strategy,
    growthRate: clampScore(signal.growthRate ?? signal.growth),
    remainingHalfLifeHours: Math.max(1, signal.remainingHalfLifeHours ?? defaultHalfLife(signal)),
    audienceOverlap: clampScore(signal.audienceOverlap ?? profitAudienceFit),
    contentSupplyGap: clampScore(signal.contentSupplyGap ?? 100 - signal.competition),
    monetizationIntent: clampScore(signal.monetizationIntent ?? defaultMonetizationIntent(signal)),
    sharePotential: clampScore(signal.sharePotential ?? signal.heat * 0.65 + signal.growth * 0.35),
    productionLatencyHours: productionLatency(signal, strategy),
    policyRisk: clampScore(signal.policyRisk ?? (isHighStakes(signal) ? 55 : 8 + signal.competition * 0.08)),
    confidence: clampScore(signal.confidence ?? defaultConfidence(signal)),
    evidenceReadiness: evidenceReadiness(signal, strategy),
    evidencePlan: evidencePlan(signal, strategy)
  };
}

function trendFreshnessScore(signal: TrendSignal, now: Date): number {
  const observedAt = Date.parse(signal.observedAt);
  if (!Number.isFinite(observedAt)) return 0;
  const ageHours = Math.max(0, (now.getTime() - observedAt) / 3_600_000);
  if (ageHours <= 6) return 100;
  if (ageHours <= 24) return 80;
  if (ageHours <= 72) return 45;
  if (ageHours <= 168) return 15;
  return 0;
}

function signalOpportunityScore(signal: TrendSignal, now: Date): number {
  const audienceOverlap = signal.audienceOverlap ?? 50;
  const supplyGap = signal.contentSupplyGap ?? 100 - signal.competition;
  const monetizationIntent = signal.monetizationIntent ?? defaultMonetizationIntent(signal);
  const sharePotential = signal.sharePotential ?? signal.heat * 0.65 + signal.growth * 0.35;
  const policyRisk = signal.policyRisk ?? (isHighStakes(signal) ? 55 : 10);
  const confidence = signal.confidence ?? defaultConfidence(signal);
  const halfLife = signal.remainingHalfLifeHours ?? defaultHalfLife(signal);
  const latency = signal.productionLatencyHours ?? 3;
  const latencyPenalty = clampScore((latency / Math.max(1, halfLife)) * 100);
  const freshness = trendFreshnessScore(signal, now);
  return clampScore(
    signal.heat * 0.18
    + (signal.growthRate ?? signal.growth) * 0.16
    + audienceOverlap * 0.17
    + supplyGap * 0.16
    + monetizationIntent * 0.12
    + sharePotential * 0.11
    + confidence * 0.1
    + freshness * 0.15
    - policyRisk * 0.16
    - latencyPenalty * 0.08
  );
}

export function rankTrendSignals(signals: TrendSignal[], now = new Date()): RankedTrendSignal[] {
  return signals
    .map((signal) => ({ ...signal, opportunityScore: signalOpportunityScore(signal, now) }))
    .sort((left, right) => right.opportunityScore - left.opportunityScore);
}

function buildCandidate(
  signal: RankedTrendSignal,
  engine: ContentEngine,
  account: WechatAccount,
  createdAt: string
): TopicCandidate {
  const profitAudienceFit = estimateProfitAudienceFit(signal);
  const opportunity = opportunityFor(signal, engine.strategy, profitAudienceFit);
  const estimatedCost = clampScore(24 + signal.competition * 0.18 + opportunity.productionLatencyHours * 0.7);
  const expectedThirtyDayGross = Math.max(120, Math.round((
    signal.opportunityScore * 4.2
    + opportunity.monetizationIntent * 1.8
    + opportunity.audienceOverlap * 1.4
    + opportunity.contentSupplyGap
  ) * engine.expectedRevenueLift));
  const revenueForecast = buildTopicRevenueForecast({
    expectedThirtyDayGross,
    estimatedCost,
    opportunity,
    primaryChannel: engine.primaryChannel,
    assumptions: ["trend_opportunity_model", `signal_source:${signal.source}`]
  });

  return {
    id: `topic-${signal.id.replace(/^trend-/, "trend-")}-${engine.strategy}`,
    title: engine.title(signal),
    source: engine.strategy === "manufacture" ? "experimental" : "hot",
    category: engine.category,
    audience: engine.audience,
    angle: engine.angle,
    experimentTag: engine.experimentTag,
    status: "candidate",
    expectedRevenue: revenueForecast.d30.grossRevenue,
    timeliness: clampScore(signal.heat * 0.65 + opportunity.growthRate * 0.35),
    estimatedCost,
    accountFit: clampScore(profitAudienceFit + engine.profitFitLift),
    profitAudienceFit: clampScore(profitAudienceFit + engine.profitFitLift),
    historicalSimilarity: clampScore(35 + profitAudienceFit * 0.25 + signal.opportunityScore * 0.2),
    risk: clampScore(opportunity.policyRisk + engine.riskLift),
    saturation: clampScore(100 - opportunity.contentSupplyGap),
    createdAt,
    accountId: account.id,
    contentStrategy: engine.strategy,
    primaryMonetizationChannel: engine.primaryChannel,
    opportunityProfile: opportunity,
    revenueForecast
  };
}

export function generateTopicsFromSignals(signals: TrendSignal[], options: GenerateTopicsOptions): TopicCandidate[] {
  const existingTitles = new Set(options.existingTopicTitles.map(normalizeTitle));
  const now = options.now ?? new Date();
  const createdAt = now.toISOString();
  const limit = Math.max(0, options.limit ?? DEFAULT_TREND_TOPIC_POOL_LIMIT);
  const rankedSignals = rankTrendSignals(signals, now)
    .filter(isSafeTrendSignal);

  const candidatesBySignal = rankedSignals
    .map((signal) => (Object.values(CONTENT_ENGINES) as ContentEngine[])
      .filter((engine) => !existingTitles.has(normalizeTitle(engine.title(signal))))
      .map((engine) => buildCandidate(signal, engine, options.account, createdAt)));
  const breadthCandidates = candidatesBySignal
    .map((candidates) => candidates[0])
    .filter((candidate): candidate is TopicCandidate => Boolean(candidate));
  const strategyVariants = candidatesBySignal
    .flatMap((candidates) => candidates.slice(1))
    .sort((left, right) => {
      const profitDifference = discountedExpectedNetProfit(right.revenueForecast!)
        - discountedExpectedNetProfit(left.revenueForecast!);
      return profitDifference || right.timeliness - left.timeliness;
    });

  return [...breadthCandidates, ...strategyVariants].slice(0, limit);
}
