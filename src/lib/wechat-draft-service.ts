import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, isAbsolute } from "node:path";
import type { ArticleVisualAsset, PublicationAttribution } from "./domain";
import type { WorkspaceData, WorkspaceStore } from "./workspace-store";
import { workspaceStore } from "./workspace-store";
import { getLocalWechatConfig, type WechatConfig } from "./wechat-config";
import { getWechatAccessToken } from "./wechat-token-client";
import { buildPublicationAttribution } from "./publication-attribution";
import {
  createWechatDraft,
  extractMarkdownImageUrls,
  publishWechatDraft,
  replaceMarkdownImageUrls,
  uploadWechatInlineImage,
  uploadWechatImageMaterial,
  type CreateWechatDraftInput,
  type UploadWechatInlineImageInput,
  type UploadWechatImageMaterialInput
} from "./wechat-publisher";

interface CreateWechatDraftFromArticleDeps {
  store?: WorkspaceStore;
  getConfig?: () => WechatConfig | null;
  getAccessToken?: (config: WechatConfig) => Promise<string>;
  uploadImageMaterial?: (input: UploadWechatImageMaterialInput) => Promise<{ mediaId: string }>;
  uploadInlineImage?: (input: UploadWechatInlineImageInput) => Promise<{ url: string }>;
  createDraft?: (input: CreateWechatDraftInput) => Promise<{ draftId: string }>;
}

interface PublishWechatDraftFromArticleDeps {
  store?: WorkspaceStore;
  getConfig?: () => WechatConfig | null;
  getAccessToken?: (config: WechatConfig) => Promise<string>;
  publishDraft?: (input: { draftId: string; accessToken: string }) => Promise<{ publishId: string }>;
}

export interface CreateWechatDraftFromArticleResult {
  workspace: WorkspaceData;
  draftId: string;
}

function attemptId(prefix: string, articleId: string): string {
  return `${prefix}-${articleId}-${Date.now()}`;
}

function imageFileFromPath(path: string): File {
  const bytes = readFileSync(path);
  return new File([bytes], basename(path), { type: "image/png" });
}

function isLocalImagePath(value: string): boolean {
  return isAbsolute(value) && existsSync(value);
}

function rasterAssetIsValid(asset: ArticleVisualAsset): boolean {
  if ((asset.status !== "generated" && asset.status !== "approved") || !existsSync(asset.localPath)) return false;
  if (asset.mimeType !== "image/png" || asset.width !== asset.targetWidth || asset.height !== asset.targetHeight || !asset.sha256) return false;
  return createHash("sha256").update(readFileSync(asset.localPath)).digest("hex") === asset.sha256;
}

function latestDraftAttribution(workspace: WorkspaceData, articleId: string, draftId: string): PublicationAttribution | undefined {
  return [...workspace.publicationAttempts]
    .filter((attempt) => attempt.articleId === articleId && attempt.status === "draft_created" && attempt.draftId === draftId && attempt.attribution)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.attribution;
}

async function uploadMarkdownImages(
  markdown: string,
  accessToken: string,
  uploadInlineImage: (input: UploadWechatInlineImageInput) => Promise<{ url: string }>
): Promise<string> {
  const replacements: Record<string, string> = {};
  for (const imagePath of extractMarkdownImageUrls(markdown).filter(isLocalImagePath)) {
    const uploaded = await uploadInlineImage({ file: imageFileFromPath(imagePath), accessToken });
    replacements[imagePath] = uploaded.url;
  }
  return replaceMarkdownImageUrls(markdown, replacements);
}

export async function createWechatDraftFromArticle(
  articleId: string,
  deps?: CreateWechatDraftFromArticleDeps
): Promise<CreateWechatDraftFromArticleResult> {
  const store = deps?.store ?? workspaceStore;
  const config = (deps?.getConfig ?? getLocalWechatConfig)();
  if (!config) {
    throw new Error("WeChat config is not configured");
  }

  const detail = store.getArticleDetail(articleId);
  if (!detail) {
    throw new Error(`Article not found: ${articleId}`);
  }

  const workspaceBefore = store.getWorkspace();
  const storedArticle = workspaceBefore.articles.find((article) => article.id === articleId);
  if (!storedArticle || storedArticle.status !== "approved") {
    throw new Error(`Article must be approved before creating a WeChat draft: ${storedArticle?.status ?? "missing"}`);
  }
  if (storedArticle.qualityScore < workspaceBefore.autoLoopConfig.minQualityScore) {
    throw new Error(`Article quality score ${storedArticle.qualityScore} is below the draft threshold`);
  }
  if (storedArticle.riskScore > workspaceBefore.autoLoopConfig.maxRiskScore) {
    throw new Error(`Article risk score ${storedArticle.riskScore} exceeds the draft threshold`);
  }
  if (storedArticle.qualityAssessment?.hardBlockReasons.length) {
    throw new Error(`Article quality assessment has hard blocks: ${storedArticle.qualityAssessment.hardBlockReasons.join("; ")}`);
  }
  if (storedArticle.qualityAssessment && !storedArticle.qualityAssessment.passed) {
    throw new Error(`Article quality assessment did not pass: ${storedArticle.qualityAssessment.score}`);
  }
  if (storedArticle.editorialVoiceAssessment && !storedArticle.editorialVoiceAssessment.passed) {
    throw new Error(`Article editorial voice assessment did not pass: ${storedArticle.editorialVoiceAssessment.score}`);
  }
  if (!storedArticle.visualPlan) {
    throw new Error("Article raster visual plan is missing");
  }
  if (!["ready", "approved"].includes(storedArticle.visualPlan.status)) {
    throw new Error(`Article raster visuals are not ready: ${storedArticle.visualPlan.status}`);
  }
  const incompleteAsset = storedArticle.visualPlan.assets.find((asset) => !rasterAssetIsValid(asset));
  if (incompleteAsset) {
    throw new Error(`Article raster visual asset is incomplete: ${incompleteAsset.id}`);
  }
  if (!detail.markdown.trim()) {
    throw new Error("Article markdown is empty");
  }
  const plannedBodyPaths = new Set(storedArticle.visualPlan.assets.filter((asset) => asset.role === "body").map((asset) => asset.localPath));
  const untrackedBodyImage = extractMarkdownImageUrls(detail.markdown).filter(isLocalImagePath).find((path) => !plannedBodyPaths.has(path));
  if (untrackedBodyImage) {
    throw new Error(`Article markdown references an untracked raster visual: ${untrackedBodyImage}`);
  }
  if (!detail.article.coverPath || !existsSync(detail.article.coverPath)) {
    throw new Error(`Article cover is missing: ${detail.article.coverPath || "empty path"}`);
  }
  const existingDraft = workspaceBefore.publicationAttempts.some((attempt) =>
    attempt.articleId === articleId && attempt.status === "draft_created" && Boolean(attempt.draftId)
  );
  if (existingDraft) {
    throw new Error("Article already has a recorded WeChat draft");
  }

  const accessToken = await (deps?.getAccessToken ?? getWechatAccessToken)(config);
  const thumb = await (deps?.uploadImageMaterial ?? uploadWechatImageMaterial)({
    file: imageFileFromPath(detail.article.coverPath),
    accessToken
  });
  const markdown = await uploadMarkdownImages(
    detail.markdown,
    accessToken,
    deps?.uploadInlineImage ?? uploadWechatInlineImage
  );
  const draft = await (deps?.createDraft ?? createWechatDraft)({
    article: detail.article,
    markdown,
    accessToken,
    thumbMediaId: thumb.mediaId
  });
  const createdAt = new Date().toISOString();
  const attribution = buildPublicationAttribution({
    article: detail.article,
    markdown,
    sourceMarkdown: detail.markdown,
    draftTitle: detail.article.title,
    coverMediaId: thumb.mediaId,
    draftId: draft.draftId,
    createdAt
  });

  const transitioned = store.applyArticleAction(articleId, "create_wechat_draft");
  if (transitioned.articles.find((article) => article.id === articleId)?.status !== "wechat_draft") {
    store.recordPublicationAttempt({
      id: attemptId("pub-reconcile", articleId),
      articleId,
      status: "failed",
      channel: "wechat",
      draftId: draft.draftId,
      attribution,
      error: "Remote draft was created but local state transition failed; reconciliation is required.",
      createdAt
    });
    throw new Error("Remote WeChat draft was created but local state requires reconciliation");
  }
  const workspace = store.recordPublicationAttempt({
    id: attemptId("pub-draft", articleId),
    articleId,
    status: "draft_created",
    channel: "wechat",
    draftId: draft.draftId,
    attribution,
    createdAt
  });

  return { workspace, draftId: draft.draftId };
}

export async function publishWechatDraftFromArticle(
  articleId: string,
  draftId: string,
  deps?: PublishWechatDraftFromArticleDeps
): Promise<{ status: "blocked" | "publish_submitted"; publishId?: string }> {
  const store = deps?.store ?? workspaceStore;
  const config = (deps?.getConfig ?? getLocalWechatConfig)();
  if (!config || config.publishMode !== "auto_publish") {
    store.recordPublicationAttempt({
      id: attemptId("pub-blocked", articleId),
      articleId,
      status: "blocked",
      channel: "wechat",
      draftId,
      error: "Auto publish is not enabled.",
      createdAt: new Date().toISOString()
    });
    return { status: "blocked" };
  }

  const accessToken = await (deps?.getAccessToken ?? getWechatAccessToken)(config);
  const published = await (deps?.publishDraft ?? publishWechatDraft)({ draftId, accessToken });
  const workspace = store.getWorkspace();
  const attribution = latestDraftAttribution(workspace, articleId, draftId);
  store.recordPublicationAttempt({
    id: attemptId("pub-submit", articleId),
    articleId,
    status: "publish_submitted",
    channel: "wechat",
    draftId,
    publishId: published.publishId,
    attribution: attribution ? { ...attribution, publishId: published.publishId } : undefined,
    createdAt: new Date().toISOString()
  });

  return { status: "publish_submitted", publishId: published.publishId };
}
