import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ArticlePackage, ArticleVisualPlan } from "./domain";

export interface ArticleDocument {
  article: ArticlePackage;
  markdown: string;
}

export interface ArticleDocumentPatch {
  title?: string;
  summary?: string;
  markdown?: string;
  visualPlan?: ArticleVisualPlan;
}

export function readArticleDocument(article: ArticlePackage): ArticleDocument {
  return {
    article,
    markdown: article.contentPath && existsSync(article.contentPath) ? readFileSync(article.contentPath, "utf8") : ""
  };
}

export function updateArticleDocument(article: ArticlePackage, patch: ArticleDocumentPatch): ArticlePackage {
  const updated = {
    ...article,
    title: patch.title ?? article.title,
    summary: patch.summary ?? article.summary,
    visualPlan: patch.visualPlan ?? article.visualPlan
  };

  if (patch.markdown !== undefined && article.contentPath) {
    mkdirSync(dirname(article.contentPath), { recursive: true });
    writeFileSync(article.contentPath, patch.markdown, "utf8");
  }

  return updated;
}
