import { publishWechatDraftFromArticle } from "./wechat-draft-service";
import { workspaceStore, type WorkspaceData, type WorkspaceStore } from "./workspace-store";

export interface PublishExperimentArticleInput {
  articleId: string;
  draftId?: string;
  store?: WorkspaceStore;
  publishWechatDraft?: (articleId: string, draftId: string) => Promise<{ status: "blocked" | "publish_submitted"; publishId?: string }>;
}

export interface PublishExperimentArticleResult {
  status: "blocked" | "publish_submitted";
  articleId: string;
  draftId?: string;
  publishId?: string;
  reason?: string;
  workspace: WorkspaceData;
}

function latestDraftId(workspace: WorkspaceData, articleId: string): string | undefined {
  return [...workspace.publicationAttempts]
    .filter((attempt) => attempt.articleId === articleId && attempt.status === "draft_created" && attempt.draftId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.draftId;
}

export async function publishExperimentArticle(input: PublishExperimentArticleInput): Promise<PublishExperimentArticleResult> {
  const store = input.store ?? workspaceStore;
  const workspace = store.getWorkspace();
  const article = workspace.articles.find((item) => item.id === input.articleId);
  if (!article) {
    return {
      status: "blocked",
      articleId: input.articleId,
      reason: `Article not found: ${input.articleId}`,
      workspace
    };
  }
  if (!workspace.autoLoopConfig.autoPublishEnabled) {
    return {
      status: "blocked",
      articleId: article.id,
      reason: "AutoProfit auto publish is disabled.",
      workspace
    };
  }
  if (article.status !== "wechat_draft") {
    return {
      status: "blocked",
      articleId: article.id,
      reason: `Article is not a WeChat draft: ${article.status}`,
      workspace
    };
  }

  const draftId = input.draftId ?? latestDraftId(workspace, article.id);
  if (!draftId) {
    return {
      status: "blocked",
      articleId: article.id,
      reason: "No WeChat draft id found for article.",
      workspace
    };
  }

  const published = await (input.publishWechatDraft ?? publishWechatDraftFromArticle)(article.id, draftId);
  if (published.status === "blocked") {
    return {
      status: "blocked",
      articleId: article.id,
      draftId,
      reason: "WeChat publish service blocked the request.",
      workspace: store.getWorkspace()
    };
  }

  const updatedWorkspace = store.applyArticleAction(article.id, "submit_publish");
  return {
    status: "publish_submitted",
    articleId: article.id,
    draftId,
    publishId: published.publishId,
    workspace: updatedWorkspace
  };
}
