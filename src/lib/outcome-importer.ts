import type {
  ArticleOutcome,
  OutcomeDataQuality,
  OutcomeDataSource,
  OutcomeMetricName,
  RiskEvent
} from "./domain";

interface RawOutcome {
  articleId?: string;
  reads?: string | number;
  views?: string | number;
  likes?: string | number;
  inLikes?: string | number;
  comments?: string | number;
  adImpressions?: string | number;
  adClicks?: string | number;
  shares?: string | number;
  favorites?: string | number;
  newFollowers?: string | number;
  unfollows?: string | number;
  revenue?: string | number;
  adRevenue?: string | number;
  affiliateRevenue?: string | number;
  leadRevenue?: string | number;
  followerValueRevenue?: string | number;
  cost?: string | number;
  riskScore?: string | number;
  publishedAt?: string;
  titleAtPublish?: string;
  titleChangedAfterDraft?: string | boolean | number;
  observedMetrics?: string | OutcomeMetricName[];
  dataSource?: string;
  dataQuality?: string;
  excludedRevenue?: string | number;
  exclusionReason?: string;
  recordedAt?: string;
}

const outcomeMetricNames: OutcomeMetricName[] = [
  "reads",
  "views",
  "likes",
  "inLikes",
  "comments",
  "adImpressions",
  "adClicks",
  "shares",
  "favorites",
  "newFollowers",
  "unfollows",
  "revenue",
  "cost",
  "riskScore"
];

const outcomeDataSources: OutcomeDataSource[] = [
  "official_api",
  "wechat_export",
  "wechat_admin_observation",
  "manual"
];

const outcomeDataQualities: OutcomeDataQuality[] = ["complete", "partial", "excluded"];

const requiredHeaders = [
  "articleId",
  "reads",
  "shares",
  "favorites",
  "newFollowers",
  "unfollows",
  "revenue",
  "cost",
  "riskScore",
  "recordedAt"
];

function numberValue(value: string | number | undefined, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric outcome field: ${field}`);
  }
  return parsed;
}

function optionalNumberValue(value: string | number | undefined, field: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  return numberValue(value, field);
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function optionalBoolean(value: string | boolean | number | undefined, field: string): boolean | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["true", "1", "yes", "y", "是"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "否"].includes(normalized)) return false;
  throw new Error(`Invalid boolean outcome field: ${field}`);
}

function optionalEnum<T extends string>(value: string | undefined, allowed: T[], field: string): T | undefined {
  const normalized = optionalText(value);
  if (!normalized) return undefined;
  if (!allowed.includes(normalized as T)) {
    throw new Error(`Invalid ${field}: ${normalized}`);
  }
  return normalized as T;
}

function optionalMetricList(value: string | OutcomeMetricName[] | undefined): OutcomeMetricName[] | undefined {
  if (value === undefined || value === "") return undefined;
  const metrics = Array.isArray(value)
    ? value
    : value.split(/[|;]/).map((item) => item.trim()).filter(Boolean) as OutcomeMetricName[];
  const invalid = metrics.find((metric) => !outcomeMetricNames.includes(metric));
  if (invalid) {
    throw new Error(`Invalid observed outcome metric: ${invalid}`);
  }
  return [...new Set(metrics)];
}

function normalizeOutcome(raw: RawOutcome, index: number): ArticleOutcome {
  const articleId = raw.articleId?.trim();
  if (!articleId) {
    throw new Error("Outcome articleId is required");
  }
  const recordedAt = raw.recordedAt?.trim() || new Date().toISOString();
  return {
    id: `outcome-${articleId}-${recordedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${index}`,
    articleId,
    reads: numberValue(raw.reads, "reads"),
    views: optionalNumberValue(raw.views, "views"),
    likes: optionalNumberValue(raw.likes, "likes"),
    inLikes: optionalNumberValue(raw.inLikes, "inLikes"),
    comments: optionalNumberValue(raw.comments, "comments"),
    adImpressions: optionalNumberValue(raw.adImpressions, "adImpressions"),
    adClicks: optionalNumberValue(raw.adClicks, "adClicks"),
    shares: numberValue(raw.shares, "shares"),
    favorites: numberValue(raw.favorites, "favorites"),
    newFollowers: numberValue(raw.newFollowers, "newFollowers"),
    unfollows: numberValue(raw.unfollows, "unfollows"),
    revenue: numberValue(raw.revenue, "revenue"),
    adRevenue: optionalNumberValue(raw.adRevenue, "adRevenue"),
    affiliateRevenue: optionalNumberValue(raw.affiliateRevenue, "affiliateRevenue"),
    leadRevenue: optionalNumberValue(raw.leadRevenue, "leadRevenue"),
    followerValueRevenue: optionalNumberValue(raw.followerValueRevenue, "followerValueRevenue"),
    cost: numberValue(raw.cost, "cost"),
    riskScore: numberValue(raw.riskScore, "riskScore"),
    publishedAt: optionalText(raw.publishedAt),
    titleAtPublish: optionalText(raw.titleAtPublish),
    titleChangedAfterDraft: optionalBoolean(raw.titleChangedAfterDraft, "titleChangedAfterDraft"),
    observedMetrics: optionalMetricList(raw.observedMetrics),
    dataSource: optionalEnum(raw.dataSource, outcomeDataSources, "outcome data source"),
    dataQuality: optionalEnum(raw.dataQuality, outcomeDataQualities, "outcome data quality"),
    excludedRevenue: optionalNumberValue(raw.excludedRevenue, "excludedRevenue"),
    exclusionReason: optionalText(raw.exclusionReason),
    recordedAt
  };
}

function parseCsv(content: string): RawOutcome[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const headers = lines[0].split(",").map((header) => header.trim());
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`Missing outcome CSV header: ${header}`);
    }
  }
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  }) as RawOutcome[];
}

export function parseOutcomeImport(content: string): ArticleOutcome[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }
  const raw = trimmed.startsWith("[")
    ? JSON.parse(trimmed) as RawOutcome[]
    : parseCsv(trimmed);
  if (!Array.isArray(raw)) {
    throw new Error("Outcome import must be a JSON array or CSV table");
  }
  return raw.map(normalizeOutcome);
}

export function deriveRiskEventsFromOutcomes(outcomes: ArticleOutcome[], now: Date = new Date()): RiskEvent[] {
  const createdAt = now.toISOString();
  return outcomes.flatMap((outcome) => {
    const events: RiskEvent[] = [];
    if (outcome.riskScore >= 50) {
      events.push({
        id: `risk-${outcome.id}-policy-warning`,
        articleId: outcome.articleId,
        type: "policy_warning",
        severity: Math.min(100, Math.max(1, outcome.riskScore)),
        note: `Imported outcome risk score is ${outcome.riskScore}.`,
        createdAt
      });
    }
    if (outcome.unfollows > Math.max(5, outcome.newFollowers * 1.5)) {
      events.push({
        id: `risk-${outcome.id}-follower-churn`,
        articleId: outcome.articleId,
        type: "follower_churn",
        severity: Math.min(100, Math.round((outcome.unfollows / Math.max(1, outcome.newFollowers + outcome.unfollows)) * 100)),
        note: `Imported outcome shows ${outcome.unfollows} unfollows versus ${outcome.newFollowers} new followers.`,
        createdAt
      });
    }
    if (outcome.revenue - outcome.cost < 0) {
      events.push({
        id: `risk-${outcome.id}-low-roi`,
        articleId: outcome.articleId,
        type: "low_roi",
        severity: Math.min(100, Math.round(((outcome.cost - outcome.revenue) / Math.max(1, outcome.cost)) * 100)),
        note: "Imported outcome produced negative net profit.",
        createdAt
      });
    }
    return events;
  });
}
