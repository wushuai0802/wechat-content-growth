import type {
  ArticleMetrics,
  ArticlePackage,
  RevenueRecord,
  StrategySuggestion,
  TopicCandidate
} from "./domain";

export interface HotSourcePort {
  readonly id: string;
  readonly name: string;
  collect(): Promise<TopicCandidate[]>;
}

export interface ContentGeneratorPort {
  readonly id: string;
  generateArticle(topic: TopicCandidate): Promise<ArticlePackage>;
  rewriteArticle(article: ArticlePackage, instruction: string): Promise<ArticlePackage>;
}

export interface ImageGeneratorPort {
  readonly id: string;
  generateCover(article: ArticlePackage): Promise<{ path: string; prompt: string }>;
  generateInlineImages(article: ArticlePackage): Promise<Array<{ path: string; prompt: string }>>;
}

export interface PublisherPort {
  readonly id: string;
  createDraft(article: ArticlePackage): Promise<{ draftId: string; previewUrl?: string }>;
  publishDraft(draftId: string): Promise<{ publishId: string; publishedAt: string }>;
}

export interface MetricsCollectorPort {
  readonly id: string;
  collectArticleMetrics(articleId: string): Promise<ArticleMetrics>;
  collectRevenue(articleId: string): Promise<RevenueRecord[]>;
}

export interface AssetStoragePort {
  readonly id: string;
  writeText(path: string, content: string): Promise<string>;
  writeBinary(path: string, content: Uint8Array): Promise<string>;
  readText(path: string): Promise<string>;
}

export interface StrategyAdvisorPort {
  readonly id: string;
  proposeSuggestions(context: {
    topics: TopicCandidate[];
    articles: ArticlePackage[];
    metrics: ArticleMetrics[];
    revenue: RevenueRecord[];
  }): Promise<StrategySuggestion[]>;
}
