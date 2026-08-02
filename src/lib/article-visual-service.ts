import { existsSync } from "node:fs";
import type { ArticleDocument } from "./article-document";
import { generateArticleVisualAssets } from "./article-visual-generator";
import type { ArticleVisualAssetRole } from "./domain";
import { getLocalCpaConfig, type LocalCpaConfig } from "./local-cpa-client";
import { workspaceStore, type WorkspaceStore } from "./workspace-store";

export type ArticleVisualGenerationScope = "all" | ArticleVisualAssetRole;

interface GenerateArticleVisualsDeps {
  store?: WorkspaceStore;
  getConfig?: () => LocalCpaConfig | null;
  generate?: typeof generateArticleVisualAssets;
}

interface ApproveArticleVisualsDeps {
  store?: WorkspaceStore;
  now?: Date;
}

function requireDetail(store: WorkspaceStore, articleId: string): ArticleDocument {
  const detail = store.getArticleDetail(articleId);
  if (!detail) throw new Error(`Article not found: ${articleId}`);
  return detail;
}

export async function generateArticleVisuals(
  articleId: string,
  scope: ArticleVisualGenerationScope = "all",
  deps?: GenerateArticleVisualsDeps
): Promise<ArticleDocument> {
  const store = deps?.store ?? workspaceStore;
  const detail = requireDetail(store, articleId);
  const roles = scope === "all" ? undefined : [scope];
  const result = await (deps?.generate ?? generateArticleVisualAssets)(detail.article, detail.markdown, {
    cpaConfig: (deps?.getConfig ?? getLocalCpaConfig)(),
    imageModel: "gpt-image-2",
    maxInlineImages: 3,
    roles,
    existingPlan: detail.article.visualPlan
  });
  const updated = store.updateArticleDetail(articleId, {
    markdown: result.markdown,
    visualPlan: result.visualPlan
  });
  if (!updated) throw new Error(`Article disappeared while saving visuals: ${articleId}`);
  return updated;
}

export function approveArticleVisuals(articleId: string, deps?: ApproveArticleVisualsDeps): ArticleDocument {
  const store = deps?.store ?? workspaceStore;
  const detail = requireDetail(store, articleId);
  const plan = detail.article.visualPlan;
  if (!plan || (plan.status !== "ready" && plan.status !== "approved")) {
    throw new Error(`Article raster visuals cannot be approved: ${plan?.status ?? "missing"}`);
  }
  for (const asset of plan.assets) {
    if ((asset.status !== "generated" && asset.status !== "approved") || !existsSync(asset.localPath)) {
      throw new Error(`Visual asset file is missing or incomplete: ${asset.id}`);
    }
  }

  const approvedAt = (deps?.now ?? new Date()).toISOString();
  const updated = store.updateArticleDetail(articleId, {
    visualPlan: {
      ...plan,
      status: "approved",
      assets: plan.assets.map((asset) => ({ ...asset, status: "approved", approvedAt })),
      updatedAt: approvedAt
    }
  });
  if (!updated) throw new Error(`Article disappeared while approving visuals: ${articleId}`);
  return updated;
}
