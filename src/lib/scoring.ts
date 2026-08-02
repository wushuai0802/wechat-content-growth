import type { CostRecord, RevenueRecord, ROIClass, TopicCandidate } from "./domain";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function calculateNetRevenue(
  revenueRecords: RevenueRecord[],
  costRecords: CostRecord[]
): number {
  const revenue = revenueRecords.reduce((sum, record) => sum + record.amount, 0);
  const costs = costRecords.reduce((sum, record) => sum + record.totalCost, 0);
  return Number((revenue - costs).toFixed(2));
}

export function calculateTopicScore(topic: TopicCandidate): number {
  const revenueScore = clamp(topic.expectedRevenue / 5);
  const positive =
    revenueScore * 0.3 +
    topic.timeliness * 0.2 +
    topic.accountFit * 0.2 +
    topic.historicalSimilarity * 0.15;
  const penalties = topic.risk * 0.08 + topic.estimatedCost * 0.04 + topic.saturation * 0.03;

  return Math.round(clamp(4 + positive - penalties));
}

export function classifyROI(netRevenue: number): ROIClass {
  if (netRevenue < 0) {
    return "loss";
  }

  if (netRevenue < 50) {
    return "watch";
  }

  if (netRevenue < 150) {
    return "promising";
  }

  return "winner";
}
