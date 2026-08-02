import type { AutoLoopConfig, StrategyLearningState, TopicCandidate, TopicRevenueForecast } from "./domain";
import type { ExplorationPolicy } from "./exploration-policy";
import { discountedExpectedNetProfit, resolveTopicRevenueForecast } from "./topic-profit-forecast";
import { isTopicEvidenceReady } from "./topic-evidence";

export const DEFAULT_AUTO_LOOP_CONFIG: AutoLoopConfig = {
  enabled: false,
  autoPublishEnabled: false,
  dailyArticleLimit: 3,
  dailyCostCapCny: 30,
  minQualityScore: 70,
  maxRiskScore: 35,
  exploreRatio: 0.3,
  consecutiveFailureLimit: 3,
  updatedAt: new Date(0).toISOString()
};

export interface TopicProfitScore {
  topic: TopicCandidate;
  score: number;
  projectedNetProfit: number;
  riskPenalty: number;
  saturationPenalty: number;
  forecast: TopicRevenueForecast;
}

export interface TopicRankingOptions {
  policy?: ExplorationPolicy;
  now?: Date;
}

const SAFE_TOPIC_KEYWORDS = [
  "AI",
  "Agent",
  "智能体",
  "自动化",
  "效率",
  "工具",
  "工作流",
  "生产力",
  "内容运营",
  "创作者",
  "SaaS",
  "NAS",
  "数据分析",
  "副业",
  "省钱",
  "记账",
  "职场",
  "普通人",
  "小白",
  "生活效率",
  "大众效率",
  "省钱增效",
  "轻副业实验",
  "情绪价值",
  "productivity",
  "automation",
  "creator economy",
  "consumer tech",
  "content strategy",
  "life",
  "family",
  "household",
  "home",
  "money-saving",
  "consumer",
  "workplace",
  "emotional value",
  "habits",
  "organization",
  "checklist",
  "learning",
  "parenting",
  "relationship",
  "travel",
  "health habit",
  "public-account"
];

const BLOCKED_TOPIC_KEYWORDS = [
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
  "录取",
  "退档",
  "取消资格",
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
  "热搜",
  "百度热搜",
  "公众号运营者该怎么判断机会"
];

function topicText(topic: TopicCandidate): string {
  return `${topic.title} ${topic.category} ${topic.audience} ${topic.angle}`;
}

function includesKeyword(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

export function isSafeProfitTopic(topic: TopicCandidate): boolean {
  const text = topicText(topic);
  if (includesKeyword(text, BLOCKED_TOPIC_KEYWORDS)) return false;
  if (topic.opportunityProfile) return true;
  return includesKeyword(text, SAFE_TOPIC_KEYWORDS);
}

function blendLearnedWeight(weight: number, historyWeight: number): number {
  return 1 + (weight - 1) * historyWeight;
}

function freshnessScore(createdAt: string, now: Date): number {
  const ageHours = Math.max(0, (now.getTime() - Date.parse(createdAt)) / 3_600_000);
  if (!Number.isFinite(ageHours)) return 0;
  if (ageHours <= 24) return 100;
  if (ageHours <= 72) return 65;
  if (ageHours <= 168) return 30;
  return -20;
}

function trendFamilyKey(topic: TopicCandidate): string {
  return topic.id.replace(/-(chase|convert|manufacture)$/, "");
}

export function scoreTopicForProfit(
  topic: TopicCandidate,
  learning?: StrategyLearningState,
  options?: TopicRankingOptions
): TopicProfitScore {
  const forecast = resolveTopicRevenueForecast(topic);
  const riskPenalty = topic.risk * 2;
  const saturationPenalty = topic.saturation * 0.5;
  const projectedNetProfit = discountedExpectedNetProfit(forecast) - riskPenalty - saturationPenalty;
  const sourceWeight = learning?.sourceWeights[topic.source] ?? 1;
  const categoryWeight = learning?.categoryWeights[topic.category] ?? 1;
  const experimentTagWeight = topic.experimentTag ? learning?.experimentTagWeights[topic.experimentTag] ?? 1 : 1;
  const strategy = topic.contentStrategy ?? topic.opportunityProfile?.strategy;
  const strategyWeight = strategy ? learning?.contentStrategyWeights?.[strategy] ?? 1 : 1;
  const channelWeight = learning?.monetizationChannelWeights?.[topic.primaryMonetizationChannel ?? forecast.primaryChannel] ?? 1;
  const historyWeight = options?.policy?.historyWeight ?? 1;
  const editorialMultiplier = Math.cbrt(
    blendLearnedWeight(sourceWeight, historyWeight)
    * blendLearnedWeight(categoryWeight, historyWeight)
    * blendLearnedWeight(experimentTagWeight, historyWeight)
  );
  const profitPathMultiplier = Math.sqrt(
    blendLearnedWeight(strategyWeight, historyWeight)
    * blendLearnedWeight(channelWeight, historyWeight)
  );
  const learnedMultiplier = Math.max(0.35, Math.min(2.5, editorialMultiplier * profitPathMultiplier));
  const opportunityLift = topic.opportunityProfile
    ? topic.opportunityProfile.contentSupplyGap * 0.25 + topic.opportunityProfile.monetizationIntent * 0.2
    : 0;
  const realtimeWeight = options?.policy?.realtimeWeight ?? 0;
  const realtimeLift = topic.opportunityProfile
    ? (
        topic.timeliness * 0.35
        + topic.opportunityProfile.growthRate * 0.3
        + topic.opportunityProfile.sharePotential * 0.2
        + topic.opportunityProfile.confidence * 0.15
      ) * realtimeWeight
    : topic.timeliness * 0.45 * realtimeWeight;
  const freshnessLift = freshnessScore(topic.createdAt, options?.now ?? new Date()) * realtimeWeight * 0.45;
  const forecastWeight = options?.policy?.forecastWeight ?? 1;
  const score = (
    projectedNetProfit * forecastWeight
    + topic.timeliness * 0.35
    + (topic.profitAudienceFit ?? topic.accountFit) * 0.4
    + topic.historicalSimilarity * 0.2 * historyWeight
    + opportunityLift
    + realtimeLift
    + freshnessLift
  ) * learnedMultiplier;

  return {
    topic,
    score: Math.round(score * 100) / 100,
    projectedNetProfit: Math.round(projectedNetProfit * 100) / 100,
    riskPenalty,
    saturationPenalty,
    forecast
  };
}

export function rankTopicsForProfit(
  topics: TopicCandidate[],
  config: AutoLoopConfig,
  learning?: StrategyLearningState,
  options?: TopicRankingOptions
): TopicProfitScore[] {
  let runningCost = 0;
  const ranked = topics
    .filter((topic) => topic.status === "candidate")
    .filter(isSafeProfitTopic)
    .filter(isTopicEvidenceReady)
    .filter((topic) => topic.risk <= config.maxRiskScore)
    .map((topic) => scoreTopicForProfit(topic, learning, options))
    .sort((a, b) => b.score - a.score);

  const selected: TopicProfitScore[] = [];
  const exploreRatio = Math.max(config.exploreRatio, options?.policy?.exploreRatio ?? config.exploreRatio);
  const exploitLimit = Math.max(0, Math.ceil(config.dailyArticleLimit * (1 - exploreRatio)));
  const experimentalRanked = [...ranked]
    .filter((item) => item.topic.source === "experimental" || item.topic.historicalSimilarity < 65)
    .sort((a, b) => options?.policy ? b.score - a.score : b.projectedNetProfit - a.projectedNetProfit);
  const selectedTrendCounts = new Map<string, number>();

  const trySelect = (item: TopicProfitScore): boolean => {
    if (selected.some((selectedItem) => selectedItem.topic.id === item.topic.id)) {
      return false;
    }
    if (selected.length >= config.dailyArticleLimit) {
      return false;
    }
    if (runningCost + item.topic.estimatedCost > config.dailyCostCapCny) {
      return false;
    }
    const familyKey = trendFamilyKey(item.topic);
    if (options?.policy && (selectedTrendCounts.get(familyKey) ?? 0) >= options.policy.maxTopicsPerTrend) {
      return false;
    }
    selected.push(item);
    runningCost += item.topic.estimatedCost;
    selectedTrendCounts.set(familyKey, (selectedTrendCounts.get(familyKey) ?? 0) + 1);
    return true;
  };
  for (const item of ranked) {
    if (selected.length >= exploitLimit) {
      break;
    }
    trySelect(item);
  }

  for (const item of experimentalRanked) {
    if (selected.length >= config.dailyArticleLimit) {
      break;
    }
    trySelect(item);
  }

  for (const item of ranked) {
    if (selected.length >= config.dailyArticleLimit) {
      break;
    }
    trySelect(item);
  }

  return selected;
}
