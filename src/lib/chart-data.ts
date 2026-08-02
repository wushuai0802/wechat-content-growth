import type { ArticleMetrics, CostRecord, RevenueRecord, TopicCandidate, TopicSource } from "./domain";

export interface FinancialPoint {
  date: string;
  revenue: number;
  cost: number;
  net: number;
}

export interface ContentMixBar {
  source: TopicSource;
  label: string;
  count: number;
  percent: number;
}

export interface ReadTrendPoint {
  date: string;
  reads: number;
  followers: number;
}

const sourceLabels: Record<TopicSource, string> = {
  hot: "热点",
  evergreen: "常青",
  series: "系列",
  experimental: "实验"
};

const orderedSources: TopicSource[] = ["hot", "evergreen", "series", "experimental"];

function formatMonthDay(value: string): string {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function addToMap(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export function buildDailyFinancialSeries(revenue: RevenueRecord[], costs: CostRecord[]): FinancialPoint[] {
  const revenueByDate = new Map<string, number>();
  const costByDate = new Map<string, number>();

  for (const record of revenue) {
    addToMap(revenueByDate, formatMonthDay(record.recordedAt), record.amount);
  }

  for (const record of costs) {
    addToMap(costByDate, formatMonthDay(record.createdAt), record.totalCost);
  }

  return [...new Set([...revenueByDate.keys(), ...costByDate.keys()])]
    .sort()
    .map((date) => {
      const dayRevenue = revenueByDate.get(date) ?? 0;
      const dayCost = costByDate.get(date) ?? 0;
      return {
        date,
        revenue: dayRevenue,
        cost: dayCost,
        net: dayRevenue - dayCost
      };
    });
}

export function buildContentMixBars(topics: TopicCandidate[]): ContentMixBar[] {
  const total = topics.length || 1;
  const counts = topics.reduce<Record<TopicSource, number>>(
    (mix, topic) => {
      mix[topic.source] += 1;
      return mix;
    },
    {
      hot: 0,
      evergreen: 0,
      series: 0,
      experimental: 0
    }
  );

  return orderedSources.map((source) => ({
    source,
    label: sourceLabels[source],
    count: counts[source],
    percent: Math.round((counts[source] / total) * 100)
  }));
}

export function buildReadTrendSeries(metrics: ArticleMetrics[]): ReadTrendPoint[] {
  return [...metrics]
    .sort((left, right) => left.collectedAt.localeCompare(right.collectedAt))
    .map((metric) => ({
      date: formatMonthDay(metric.collectedAt),
      reads: metric.reads,
      followers: metric.newFollowers
    }));
}
