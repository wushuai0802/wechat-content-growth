import { join, resolve } from "node:path";

export const projectRoot = resolve(process.env.WCG_PROJECT_ROOT ?? process.cwd());
export const dataRoot = resolve(process.env.WCG_DATA_ROOT ?? join(projectRoot, ".data"));
export const runtimeRoot = resolve(process.env.WCG_RUNTIME_ROOT ?? join(dataRoot, "runtime"));
export const opsRoot = resolve(process.env.WCG_OPS_ROOT ?? join(dataRoot, "ops"));
export const deliverablesRoot = resolve(process.env.WCG_DELIVERABLES_ROOT ?? join(dataRoot, "deliverables"));
export const backupsRoot = resolve(process.env.WCG_BACKUPS_ROOT ?? join(dataRoot, "backups"));

export function getRuntimeDataDir(): string {
  return join(runtimeRoot, "data");
}

export function getRuntimeLogsDir(): string {
  return join(runtimeRoot, "logs");
}

export function getWorkspaceDataFile(): string {
  return join(getRuntimeDataDir(), "workspace.json");
}

export function getArticleDraftsDir(): string {
  return join(deliverablesRoot, "articles", "drafts");
}

export function getArticleApprovedDir(): string {
  return join(deliverablesRoot, "articles", "approved");
}

export function getArticlePublishedDir(): string {
  return join(deliverablesRoot, "articles", "published");
}

export function getCoverImagesDir(): string {
  return join(deliverablesRoot, "images", "covers");
}

export function getArticleInlineImagesDir(): string {
  return join(deliverablesRoot, "images", "inline");
}

export function getReportsDir(): string {
  return join(deliverablesRoot, "reports");
}

export function getCpaConfigFile(): string {
  return join(runtimeRoot, "config", "cpa.env");
}

export function getWechatConfigFile(): string {
  return resolve(process.env.WCG_WECHAT_CONFIG_FILE ?? join(runtimeRoot, "config", "wechat.env"));
}

export function getWechatTokenCacheFile(): string {
  return join(runtimeRoot, "data", "wechat-token-cache.json");
}
