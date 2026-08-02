import type { ArticlePackage, PublicationAttribution } from "./domain";
import { estimateReadableChars } from "./article-visuals";
import { extractMarkdownImageUrls, normalizeWechatDraftTitle } from "./wechat-publisher";

export interface BuildPublicationAttributionInput {
  article: ArticlePackage;
  markdown: string;
  sourceMarkdown?: string;
  draftTitle?: string;
  coverMediaId?: string;
  draftId?: string;
  publishId?: string;
  createdAt?: string;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function countHeadings(markdown: string): number {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^##\s+\S/.test(line.trim()))
    .length;
}

function isRemoteImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function buildPublicationAttribution(input: BuildPublicationAttributionInput): PublicationAttribution {
  const imageUrls = extractMarkdownImageUrls(input.markdown);
  const sourceImageUrls = extractMarkdownImageUrls(input.sourceMarkdown ?? input.markdown);
  const remoteInlineImageCount = sourceImageUrls.filter(isRemoteImageUrl).length;
  const uploadedInlineImageCount = sourceImageUrls.length - remoteInlineImageCount;
  const wordCount = estimateReadableChars(input.markdown);
  const markdownImageCount = imageUrls.length;
  const titleAtDraft = normalizeWechatDraftTitle(input.draftTitle ?? input.article.title);
  const originalTitle = input.article.title;

  return {
    titleAtDraft,
    originalTitle,
    titleChanged: titleAtDraft !== normalizeWechatDraftTitle(originalTitle),
    wordCount,
    markdownImageCount,
    uploadedInlineImageCount,
    remoteInlineImageCount,
    imageDensityPerThousandWords: wordCount > 0 ? round((markdownImageCount / wordCount) * 1000) : 0,
    headingCount: countHeadings(input.markdown),
    coverPath: input.article.coverPath,
    coverMediaId: input.coverMediaId,
    draftId: input.draftId,
    publishId: input.publishId,
    experimentTag: input.article.experimentTag,
    qualityScore: input.article.qualityScore,
    riskScore: input.article.riskScore,
    estimatedCost: input.article.estimatedCost,
    estimatedRevenue: input.article.estimatedRevenue,
    createdAt: input.createdAt ?? new Date().toISOString()
  };
}
