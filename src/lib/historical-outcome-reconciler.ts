import type {
  ArticleOutcome,
  ArticlePackage,
  ContentExperimentTag,
  ContentStrategy,
  MonetizationChannel,
  OutcomeDataQuality,
  OutcomeDataSource,
  OutcomeMetricName,
  PublicationAttempt,
  TopicCandidate
} from "./domain";
import type { WorkspaceData } from "./workspace-store";

export interface HistoricalWechatObservation {
  id: string;
  titleAtPublish: string;
  publishedAt: string;
  recordedAt: string;
  reads: number;
  shares?: number;
  favorites?: number;
  newFollowers?: number;
  unfollows?: number;
  revenue: number;
  cost?: number;
  realizedRiskScore?: number;
  excludedRevenue?: number;
  exclusionReason?: string;
  observedMetrics: OutcomeMetricName[];
  dataSource?: OutcomeDataSource;
  dataQuality?: OutcomeDataQuality;
  preferredArticleId?: string;
  contentPath?: string;
  coverPath?: string;
  summary?: string;
  category: string;
  audience: string;
  angle: string;
  contentStrategy: ContentStrategy;
  primaryMonetizationChannel: MonetizationChannel;
  experimentTag?: ContentExperimentTag;
  visibleCounters?: number[];
  remoteUrl?: string;
}

export interface HistoricalOutcomeReconciliation {
  workspace: WorkspaceData;
  outcomes: ArticleOutcome[];
  matchedArticleIds: string[];
  createdArticleIds: string[];
  publicationAttemptIds: string[];
}

function finiteNonNegative(value: number | undefined, field: string, fallback = 0): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved < 0) {
    throw new Error(`Historical observation ${field} must be a non-negative number`);
  }
  return resolved;
}

function requiredText(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`Historical observation ${field} is required`);
  return normalized;
}

function validTimestamp(value: string, field: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`Historical observation ${field} must be a valid timestamp`);
  }
  return value;
}

function safeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function latestExactTitleMatch(articles: ArticlePackage[], title: string, publishedAt: string): ArticlePackage | undefined {
  const publicationTime = Date.parse(publishedAt);
  return articles
    .filter((article) => article.title.trim() === title)
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      const leftEligible = leftTime <= publicationTime;
      const rightEligible = rightTime <= publicationTime;
      if (leftEligible !== rightEligible) return leftEligible ? -1 : 1;
      return rightTime - leftTime;
    })[0];
}

function createHistoricalTopic(record: HistoricalWechatObservation, topicId: string): TopicCandidate {
  return {
    id: topicId,
    title: record.titleAtPublish,
    source: "experimental",
    category: record.category,
    audience: record.audience,
    angle: record.angle,
    experimentTag: record.experimentTag,
    status: "approved",
    expectedRevenue: 0,
    timeliness: 0,
    accountFit: 0,
    profitAudienceFit: 0,
    historicalSimilarity: 0,
    risk: 0,
    estimatedCost: 0,
    saturation: 0,
    createdAt: record.publishedAt,
    contentStrategy: record.contentStrategy,
    primaryMonetizationChannel: record.primaryMonetizationChannel
  };
}

function createHistoricalArticle(
  record: HistoricalWechatObservation,
  articleId: string,
  topicId: string
): ArticlePackage {
  return {
    id: articleId,
    topicId,
    title: record.titleAtPublish,
    summary: record.summary?.trim() || "Imported historical WeChat publication for outcome reconciliation.",
    status: "published",
    contentPath: record.contentPath?.trim() || "",
    coverPath: record.coverPath?.trim() || "",
    qualityScore: 70,
    riskScore: 0,
    experimentTag: record.experimentTag,
    estimatedCost: 0,
    estimatedRevenue: 0,
    createdAt: record.publishedAt
  };
}

export function reconcileHistoricalWechatObservations(
  workspace: WorkspaceData,
  observations: HistoricalWechatObservation[]
): HistoricalOutcomeReconciliation {
  if (!Array.isArray(observations) || observations.length === 0) {
    throw new Error("Historical observations must be a non-empty array");
  }

  const topics = workspace.topics.map((topic) => ({ ...topic }));
  const articles = workspace.articles.map((article) => ({ ...article }));
  const publicationAttempts = workspace.publicationAttempts.map((attempt) => ({ ...attempt }));
  const outcomes: ArticleOutcome[] = [];
  const matchedArticleIds: string[] = [];
  const createdArticleIds: string[] = [];
  const publicationAttemptIds: string[] = [];
  const seenObservationIds = new Set<string>();

  for (const rawRecord of observations) {
    const record = {
      ...rawRecord,
      id: requiredText(rawRecord.id, "id"),
      titleAtPublish: requiredText(rawRecord.titleAtPublish, "titleAtPublish"),
      publishedAt: validTimestamp(requiredText(rawRecord.publishedAt, "publishedAt"), "publishedAt"),
      recordedAt: validTimestamp(requiredText(rawRecord.recordedAt, "recordedAt"), "recordedAt")
    };
    if (seenObservationIds.has(record.id)) {
      throw new Error(`Duplicate historical observation id: ${record.id}`);
    }
    seenObservationIds.add(record.id);

    const normalizedId = safeId(record.id);
    if (!normalizedId) throw new Error(`Historical observation id is invalid: ${record.id}`);
    finiteNonNegative(record.reads, "reads");
    finiteNonNegative(record.revenue, "revenue");
    finiteNonNegative(record.excludedRevenue, "excludedRevenue");

    let article = record.preferredArticleId
      ? articles.find((candidate) => candidate.id === record.preferredArticleId)
      : latestExactTitleMatch(articles, record.titleAtPublish, record.publishedAt);

    if (record.preferredArticleId && !article) {
      throw new Error(`Preferred historical article was not found: ${record.preferredArticleId}`);
    }

    if (article) {
      matchedArticleIds.push(article.id);
      const articleIndex = articles.findIndex((candidate) => candidate.id === article?.id);
      article = { ...article, status: "published" };
      articles[articleIndex] = article;

      const topicIndex = topics.findIndex((topic) => topic.id === article?.topicId);
      if (topicIndex >= 0) {
        topics[topicIndex] = {
          ...topics[topicIndex],
          status: "approved",
          contentStrategy: topics[topicIndex].contentStrategy ?? record.contentStrategy,
          primaryMonetizationChannel:
            topics[topicIndex].primaryMonetizationChannel ?? record.primaryMonetizationChannel
        };
      }
    } else {
      const topicId = `topic-history-${normalizedId}`;
      const articleId = `article-history-${normalizedId}`;
      const topic = createHistoricalTopic(record, topicId);
      article = createHistoricalArticle(record, articleId, topicId);
      topics.push(topic);
      articles.push(article);
      createdArticleIds.push(article.id);
    }

    const publicationAttempt: PublicationAttempt = {
      id: `pub-history-${normalizedId}`,
      articleId: article.id,
      status: "published",
      channel: "wechat",
      createdAt: record.publishedAt
    };
    const previousAttemptIndex = publicationAttempts.findIndex((attempt) => attempt.id === publicationAttempt.id);
    if (previousAttemptIndex >= 0) publicationAttempts[previousAttemptIndex] = publicationAttempt;
    else publicationAttempts.push(publicationAttempt);
    publicationAttemptIds.push(publicationAttempt.id);

    outcomes.push({
      id: `outcome-history-${normalizedId}`,
      articleId: article.id,
      reads: finiteNonNegative(record.reads, "reads"),
      shares: finiteNonNegative(record.shares, "shares"),
      favorites: finiteNonNegative(record.favorites, "favorites"),
      newFollowers: finiteNonNegative(record.newFollowers, "newFollowers"),
      unfollows: finiteNonNegative(record.unfollows, "unfollows"),
      revenue: finiteNonNegative(record.revenue, "revenue"),
      cost: finiteNonNegative(record.cost, "cost"),
      riskScore: finiteNonNegative(record.realizedRiskScore, "realizedRiskScore"),
      publishedAt: record.publishedAt,
      titleAtPublish: record.titleAtPublish,
      titleChangedAfterDraft: article.title.trim() !== record.titleAtPublish,
      observedMetrics: record.observedMetrics,
      dataSource: record.dataSource ?? "wechat_admin_observation",
      dataQuality: record.dataQuality ?? "partial",
      excludedRevenue: record.excludedRevenue,
      exclusionReason: record.exclusionReason?.trim() || undefined,
      recordedAt: record.recordedAt
    });
  }

  return {
    workspace: {
      ...workspace,
      topics,
      articles,
      publicationAttempts
    },
    outcomes,
    matchedArticleIds,
    createdArticleIds,
    publicationAttemptIds
  };
}
