export type TopicSource = "hot" | "evergreen" | "series" | "experimental";
export type TopicStatus = "candidate" | "approved" | "rejected" | "drafting";
export type ArticleStatus =
  | "drafting"
  | "review"
  | "approved"
  | "wechat_draft"
  | "publish_submitted"
  | "needs_reconcile"
  | "published"
  | "archived";
export type ROIClass = "loss" | "watch" | "promising" | "winner";
export type ExperimentRunStatus = "planned" | "running" | "completed" | "stopped" | "failed";
export type ExperimentMode = "draft_only" | "auto_publish";
export type PublicationAttemptStatus = "draft_created" | "publish_submitted" | "published" | "failed" | "blocked";
export type RiskEventType = "policy_warning" | "publish_failure" | "quality_regression" | "follower_churn" | "low_roi";
export type ContentExperimentTag =
  | "mass-pain-point"
  | "money-saving"
  | "side-income-beginner"
  | "emotional-relief"
  | "technical-tutorial"
  | "buyer-guide"
  | "profit-review"
  | "workflow-playbook";
export type DecisionLogType =
  | "select_topic"
  | "skip_topic"
  | "generate_article"
  | "approve_article"
  | "create_wechat_draft"
  | "publish_article"
  | "stop_loop"
  | "record_metric";

export type ContentPrimaryGoal = "awareness" | "trust" | "save" | "share" | "convert";
export type ArticleContentType = "hot_explainer" | "decision_guide" | "how_to" | "professional_analysis" | "case_story";
export type ContentStrategy = "chase" | "manufacture" | "convert";
export type MonetizationChannel = "traffic_ad" | "affiliate" | "lead" | "follower_ltv";
export type EvidenceReadiness = "ready" | "needs_research";
export type FactSourceType = "official" | "historical_data" | "industry_source" | "editorial_context";
export type FactVerificationStatus = "verified" | "needs_review" | "opinion";
export type ArticleVisualPlanStatus = "planned" | "generating" | "needs_visual_review" | "ready" | "approved";
export type ArticleVisualAssetRole = "cover" | "body";
export type ArticleVisualAssetStatus = "planned" | "generated" | "failed" | "approved";
export type OutcomeDataQuality = "complete" | "partial" | "excluded";
export type OutcomeDataSource = "official_api" | "wechat_export" | "wechat_admin_observation" | "manual";
export type OutcomeMetricName =
  | "reads"
  | "views"
  | "likes"
  | "inLikes"
  | "comments"
  | "adImpressions"
  | "adClicks"
  | "shares"
  | "favorites"
  | "newFollowers"
  | "unfollows"
  | "revenue"
  | "cost"
  | "riskScore";

export interface ArticleFact {
  id: string;
  claim: string;
  sourceName: string;
  sourceType: FactSourceType;
  verificationStatus: FactVerificationStatus;
  sourceUrl?: string;
  publishedAt?: string;
  applicableRegion?: string;
}

export interface ContentBrief {
  primaryGoal: ContentPrimaryGoal;
  articleType: ArticleContentType;
  audience: string;
  readerProblem: string;
  corePromise: string;
  angle: string;
  callToAction: string;
  mustAvoid: string[];
}

export interface ContentQualityDimensions {
  readerFit: number;
  informationDensity: number;
  factualReliability: number;
  structureReadability: number;
  headlineOpening: number;
  uniquePerspective: number;
  ctaNaturalness: number;
}

export interface ArticleQualityAssessment {
  passed: boolean;
  score: number;
  dimensions: ContentQualityDimensions;
  reasons: string[];
  hardBlockReasons: string[];
  evaluatedAt: string;
}

export interface EditorialVoiceMetrics {
  sentenceLengthStdDev: number;
  paragraphLengthStdDev: number;
  shortSentenceCount: number;
  longSentenceCount: number;
  templatePhraseCount: number;
  formulaicEnumerationCount: number;
  explicitStanceCount: number;
  qualificationCount: number;
  sourceAnchorCount: number;
  formulaicEndingCount: number;
  paragraphCount: number;
  sentenceCount: number;
}

export interface EditorialVoiceAssessment {
  passed: boolean;
  score: number;
  metrics: EditorialVoiceMetrics;
  reasons: string[];
  evaluatedAt: string;
}

export interface ArticleVisualAsset {
  id: string;
  role: ArticleVisualAssetRole;
  alt: string;
  prompt: string;
  localPath: string;
  anchorHeading?: string;
  source: "gpt-image-2" | "openverse-cc";
  model: string;
  status: ArticleVisualAssetStatus;
  targetWidth: number;
  targetHeight: number;
  generationSize: string;
  width?: number;
  height?: number;
  mimeType?: "image/png" | "image/jpeg" | "image/webp";
  sha256?: string;
  error?: string;
  generatedAt?: string;
  approvedAt?: string;
}

export interface ArticleVisualPlan {
  status: ArticleVisualPlanStatus;
  model: string;
  assets: ArticleVisualAsset[];
  updatedAt: string;
}

export type MonetizationChannelMix = Record<MonetizationChannel, number>;

export interface TopicOpportunityProfile {
  strategy: ContentStrategy;
  growthRate: number;
  remainingHalfLifeHours: number;
  audienceOverlap: number;
  contentSupplyGap: number;
  monetizationIntent: number;
  sharePotential: number;
  productionLatencyHours: number;
  policyRisk: number;
  confidence: number;
  evidenceReadiness: EvidenceReadiness;
  evidencePlan: string[];
}

export interface RevenueForecastHorizon {
  grossRevenue: number;
  productionCost: number;
  policyRiskCost: number;
  churnCost: number;
  opportunityCost: number;
  netProfit: number;
}

export interface TopicRevenueForecast {
  primaryChannel: MonetizationChannel;
  channelMix: MonetizationChannelMix;
  confidence: number;
  h24: RevenueForecastHorizon;
  d7: RevenueForecastHorizon;
  d30: RevenueForecastHorizon;
  assumptions: string[];
}


export interface TopicCandidate {
  id: string;
  title: string;
  source: TopicSource;
  category: string;
  audience: string;
  angle: string;
  experimentTag?: ContentExperimentTag;
  status: TopicStatus;
  expectedRevenue: number;
  timeliness: number;
  accountFit: number;
  profitAudienceFit?: number;
  historicalSimilarity: number;
  risk: number;
  estimatedCost: number;
  saturation: number;
  createdAt: string;
  accountId?: string;
  contentStrategy?: ContentStrategy;
  primaryMonetizationChannel?: MonetizationChannel;
  opportunityProfile?: TopicOpportunityProfile;
  revenueForecast?: TopicRevenueForecast;
  contentBrief?: ContentBrief;
  factPack?: ArticleFact[];
}

export interface TrendSignal {
  id: string;
  title: string;
  source: "mock_hot_source" | "weibo" | "baidu" | "toutiao" | "zhihu" | "news" | "wechat_public" | "manual";
  url?: string;
  heat: number;
  growth: number;
  competition: number;
  category: string;
  keywords: string[];
  observedAt: string;
  growthRate?: number;
  remainingHalfLifeHours?: number;
  audienceOverlap?: number;
  contentSupplyGap?: number;
  monetizationIntent?: number;
  sharePotential?: number;
  productionLatencyHours?: number;
  policyRisk?: number;
  confidence?: number;
  evidenceReadiness?: EvidenceReadiness;
  evidenceNotes?: string[];
}

export interface ArticlePackage {
  id: string;
  topicId: string;
  title: string;
  summary: string;
  status: ArticleStatus;
  contentPath: string;
  coverPath: string;
  qualityScore: number;
  riskScore: number;
  experimentTag?: ContentExperimentTag;
  estimatedCost: number;
  estimatedRevenue: number;
  createdAt: string;
  contentBrief?: ContentBrief;
  factPack?: ArticleFact[];
  qualityAssessment?: ArticleQualityAssessment;
  editorialVoiceAssessment?: EditorialVoiceAssessment;
  visualPlan?: ArticleVisualPlan;
}

export interface CostRecord {
  id: string;
  articleId: string;
  type:
    | "text_generation"
    | "image_generation"
    | "data_collection"
    | "manual_review"
    | "storage"
    | "other";
  provider: string;
  model?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  createdAt: string;
}

export interface RevenueRecord {
  id: string;
  articleId: string;
  type: "ad" | "affiliate" | "product" | "follower_value" | "manual_adjustment";
  amount: number;
  currency: "CNY" | "USD";
  source: "official_api" | "csv_import" | "manual" | "estimate";
  confidence: number;
  recordedAt: string;
}

export interface ArticleMetrics {
  articleId: string;
  reads: number;
  shares: number;
  favorites: number;
  newFollowers: number;
  unfollows: number;
  collectedAt: string;
}

export interface StrategySuggestion {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  evidence: string;
  expectedBenefit: string;
  risk: string;
  action: string;
  requiresApproval: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalCost: number;
  netRevenue: number;
  pendingReviews: number;
  approvedArticles: number;
}

export interface WechatAccount {
  id: string;
  name: string;
  appIdMasked: string;
  positioning: string;
  audience: string;
  status: "connected" | "needs_review" | "disabled";
  publishMode: "manual_review" | "draft_only" | "auto_publish";
  monthlyRevenueTarget: number;
  monthlyCostCap: number;
  followers: number;
  owner: string;
  updatedAt: string;
}

export interface AutoLoopConfig {
  enabled: boolean;
  autoPublishEnabled: boolean;
  dailyArticleLimit: number;
  dailyCostCapCny: number;
  minQualityScore: number;
  maxRiskScore: number;
  exploreRatio: number;
  consecutiveFailureLimit: number;
  updatedAt: string;
}

export interface ExperimentRun {
  id: string;
  status: ExperimentRunStatus;
  mode: ExperimentMode;
  startedAt: string;
  completedAt?: string;
  selectedTopicIds: string[];
  generatedArticleIds: string[];
  wechatDraftArticleIds: string[];
  publishedArticleIds: string[];
  estimatedCost: number;
  projectedRevenue: number;
  projectedNetProfit: number;
  failureCount: number;
  summary: string;
}

export interface DecisionLog {
  id: string;
  runId: string;
  type: DecisionLogType;
  targetId: string;
  reason: string;
  score: number;
  createdAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface StrategySnapshot {
  id: string;
  runId: string;
  objective: "maximize_net_profit";
  topicWeights: Record<TopicSource, number>;
  riskPolicy: string;
  budgetPolicy: string;
  createdAt: string;
}

export interface PublicationAttribution {
  titleAtDraft: string;
  originalTitle: string;
  titleChanged: boolean;
  wordCount: number;
  markdownImageCount: number;
  uploadedInlineImageCount: number;
  remoteInlineImageCount: number;
  imageDensityPerThousandWords: number;
  headingCount: number;
  coverPath?: string;
  coverMediaId?: string;
  draftId?: string;
  publishId?: string;
  experimentTag?: ContentExperimentTag;
  qualityScore: number;
  riskScore: number;
  estimatedCost: number;
  estimatedRevenue: number;
  createdAt: string;
}

export interface PublicationAttempt {
  id: string;
  articleId: string;
  status: PublicationAttemptStatus;
  channel: "wechat";
  draftId?: string;
  publishId?: string;
  attribution?: PublicationAttribution;
  error?: string;
  createdAt: string;
}

 export interface ArticleOutcome {
  id: string;
  articleId: string;
  reads: number;
  views?: number;
  likes?: number;
  inLikes?: number;
  comments?: number;
  adImpressions?: number;
  adClicks?: number;
  shares: number;
  favorites: number;
  newFollowers: number;
  unfollows: number;
  revenue: number;
  adRevenue?: number;
  affiliateRevenue?: number;
  leadRevenue?: number;
  followerValueRevenue?: number;
  cost: number;
  riskScore: number;
  publishedAt?: string;
  titleAtPublish?: string;
  titleChangedAfterDraft?: boolean;
  observedMetrics?: OutcomeMetricName[];
  dataSource?: OutcomeDataSource;
  dataQuality?: OutcomeDataQuality;
  excludedRevenue?: number;
  exclusionReason?: string;
  recordedAt: string;
}

export interface RiskEvent {
  id: string;
  articleId: string;
  type: RiskEventType;
  severity: number;
  note: string;
  createdAt: string;
}

 export interface ArticleReward {
  articleId: string;
  experimentTag?: ContentExperimentTag;
  reward: number;
  netProfit: number;
  trafficValue: number;
  engagementValue: number;
  followerValue: number;
  modeledGrossValue: number;
  riskPenalty: number;
  followerPenalty: number;
}

export interface StrategyLearningState {
  sourceWeights: Record<TopicSource, number>;
  categoryWeights: Record<string, number>;
  experimentTagWeights: Record<string, number>;
  contentStrategyWeights?: Record<ContentStrategy, number>;
  monetizationChannelWeights?: Record<MonetizationChannel, number>;
  articleRewards: ArticleReward[];
  updatedAt: string;
}
