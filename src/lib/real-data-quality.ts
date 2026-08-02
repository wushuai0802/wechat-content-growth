import type { ArticleOutcome, ArticleReward } from "./domain";

const DEMO_RECORDED_AT = "2026-06-18T12:00:00.000Z";

export function isKnownDemoOutcome(outcome: ArticleOutcome): boolean {
  const hasDemoMetricTuple =
    outcome.reads === 1200 &&
    outcome.shares === 30 &&
    outcome.favorites === 45 &&
    outcome.newFollowers === 12 &&
    outcome.unfollows === 1 &&
    outcome.revenue === 330 &&
    outcome.cost === 42 &&
    outcome.riskScore === 8 &&
    outcome.recordedAt === DEMO_RECORDED_AT;

  return hasDemoMetricTuple || outcome.id.includes("20260618120000");
}

export function getReliableOutcomes(outcomes: ArticleOutcome[] = []): ArticleOutcome[] {
  return outcomes.filter((outcome) => !isKnownDemoOutcome(outcome));
}

export function getReliableRewards(rewards: ArticleReward[] = [], outcomes: ArticleOutcome[] = []): ArticleReward[] {
  const demoArticleIds = new Set(outcomes.filter(isKnownDemoOutcome).map((outcome) => outcome.articleId));
  if (demoArticleIds.size === 0) {
    return rewards;
  }
  return rewards.filter((reward) => !demoArticleIds.has(reward.articleId));
}

export function hasReliableOutcomeData(outcomes: ArticleOutcome[] = []): boolean {
  return getReliableOutcomes(outcomes).length > 0;
}
