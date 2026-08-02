import type {
  ArticlePackage,
  CostRecord,
  DashboardStats,
  RevenueRecord,
  StrategySuggestion,
  TopicCandidate,
  TopicSource
} from "./domain";
import { calculateNetRevenue } from "./scoring";

type PortfolioMix = Record<TopicSource, number>;

const priorityRank: Record<StrategySuggestion["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2
};

export function buildPortfolioMix(topics: TopicCandidate[]): PortfolioMix {
  return topics.reduce<PortfolioMix>(
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
}

export function summarizeSuggestions(suggestions: StrategySuggestion[]): StrategySuggestion[] {
  return [...suggestions].sort((left, right) => {
    const priority = priorityRank[left.priority] - priorityRank[right.priority];
    if (priority !== 0) {
      return priority;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function getDashboardStats(input: {
  articles: ArticlePackage[];
  revenue: RevenueRecord[];
  costs: CostRecord[];
}): DashboardStats {
  const totalRevenue = input.revenue.reduce((sum, record) => sum + record.amount, 0);
  const totalCost = input.costs.reduce((sum, record) => sum + record.totalCost, 0);

  return {
    totalRevenue,
    totalCost,
    netRevenue: calculateNetRevenue(input.revenue, input.costs),
    pendingReviews: input.articles.filter((article) => article.status === "review").length,
    approvedArticles: input.articles.filter((article) => article.status === "approved").length
  };
}
