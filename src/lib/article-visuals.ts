import { join } from "node:path";
import type { ArticlePackage, ArticleVisualPlan, ArticleVisualAssetRole } from "./domain";
import { getInitialContentShapePrior } from "./content-experiment-policy";
import { getArticleInlineImagesDir } from "./paths";

export interface ArticleVisualSlot {
  id: string;
  role: ArticleVisualAssetRole;
  alt: string;
  prompt: string;
  anchorHeading?: string;
  localPath: string;
  targetWidth: number;
  targetHeight: number;
  generationSize: string;
}

export interface ArticleVisualPlanOptions {
  imageDir?: string;
  maxInlineImages?: number;
  minCharsPerInlineImage?: number;
  model?: string;
}

export interface ArticleVisualDensityPlan {
  estimatedChars: number;
  inlineImageCount: number;
  selectedHeadings: string[];
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "visual";
}

function extractHeadings(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => /^##\s+(.+)$/.exec(line.trim())?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading));
}

function extractSectionContexts(markdown: string): Map<string, string> {
  const contexts = new Map<string, string>();
  let heading: string | undefined;
  let lines: string[] = [];

  const saveSection = () => {
    if (!heading) return;
    const context = lines
      .join(" ")
      .replace(/<!--[^>]*-->/g, " ")
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/[*_`>#-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 420);
    if (context) contexts.set(heading, context);
  };

  for (const line of markdown.split(/\r?\n/)) {
    const match = /^##\s+(.+)$/.exec(line.trim());
    if (match) {
      saveSection();
      heading = match[1].trim();
      lines = [];
      continue;
    }
    if (heading) lines.push(line);
  }
  saveSection();

  return contexts;
}

export function estimateReadableChars(markdown: string): number {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\s+/g, "")
    .length;
}

export function planInlineVisualDensity(markdown: string, options?: ArticleVisualPlanOptions): ArticleVisualDensityPlan {
  const headings = extractHeadings(markdown);
  const estimatedChars = estimateReadableChars(markdown);
  const prior = getInitialContentShapePrior();
  const minCharsPerImage = options?.minCharsPerInlineImage ?? prior.inlineImages.initialCharsPerImage;
  const maxInlineImages = Math.max(0, options?.maxInlineImages ?? 3);
  const lengthBasedCount = estimatedChars < 850 ? 0 : Math.max(1, Math.floor(estimatedChars / minCharsPerImage));
  const inlineImageCount = Math.min(maxInlineImages, headings.length, lengthBasedCount);
  const selectedHeadings = chooseVisualHeadings(headings, inlineImageCount);

  return { estimatedChars, inlineImageCount, selectedHeadings };
}

function chooseVisualHeadings(headings: string[], count: number): string[] {
  if (count <= 0) return [];
  if (count >= headings.length) return headings;
  if (count === 1) return [headings[0]];
  const step = (headings.length - 1) / (count - 1);
  const indexes = new Set<number>();
  for (let i = 0; i < count; i++) indexes.add(Math.round(i * step));
  return [...indexes]
    .slice(0, count)
    .map((index) => headings[index])
    .filter((heading): heading is string => Boolean(heading));
}

function imagePromptFor(
  article: ArticlePackage,
  heading: string | undefined,
  role: ArticleVisualAssetRole,
  index: number,
  sectionContext?: string
): string {
  const subject = heading ? `${article.title} - ${heading}` : article.title;
  const audience = article.contentBrief?.audience ?? "Chinese WeChat readers";
  const purpose = article.contentBrief?.corePromise ?? article.summary;
  const composition = role === "cover"
    ? "Landscape cover. Place the main subject in the right 62% of the frame and keep the left 38% calm, clean, and readable for a later Chinese title overlay. Preserve important faces and objects after a wide 2.35:1 crop."
    : "Landscape body image with one clear focal scene, natural depth, and enough environmental context to explain this exact section after a 3:2 crop.";

  return [
    `Asset role: WeChat article ${role === "cover" ? "cover background" : "body image"}`,
    `Article subject: ${subject}`,
    `Audience: ${audience}`,
    `Editorial purpose: ${purpose}`,
    sectionContext ? `Section scene cues: ${sectionContext}` : null,
    "Visual direction: photorealistic editorial photography or a richly textured cinematic digital painting, grounded in a believable contemporary Chinese everyday setting; specific objects and actions, human warmth, natural detail, not stock-like.",
    `Composition: ${composition}`,
    "Lighting and color: clean natural light, believable skin and materials, varied restrained palette, strong separation between subject and background, no dark muddy filter.",
    "Text: no text, no letters, no numbers, no captions, no signs, no interface labels.",
    `Section specificity: visual ${index} must depict the concrete idea of this section rather than a generic technology or education concept.`,
    role === "body" ? "Differentiate this asset: emphasize the objects and actions unique to this section; do not repeat the cover scene or another body image." : null,
    "Constraints: not flat vector, not icon art, not infographic, not dashboard UI, not abstract gradient, no logos, no watermark, no brand marks, no distorted faces or hands."
  ].filter((line): line is string => Boolean(line)).join("\n");
}

export function planArticleVisualSlots(article: ArticlePackage, markdown: string, options?: ArticleVisualPlanOptions): ArticleVisualSlot[] {
  const headings = planInlineVisualDensity(markdown, options).selectedHeadings;
  const sectionContexts = extractSectionContexts(markdown);
  const imageDir = join(options?.imageDir ?? getArticleInlineImagesDir(), article.id);
  const slots: ArticleVisualSlot[] = [
    {
      id: `${article.id}-cover-visual`,
      role: "cover",
      alt: `${article.title}封面图`,
      prompt: imagePromptFor(article, undefined, "cover", 0),
      localPath: article.coverPath,
      targetWidth: 1200,
      targetHeight: 510,
      generationSize: "1536x1024"
    }
  ];

  for (const [index, heading] of headings.entries()) {
    slots.push({
      id: `${article.id}-inline-${index + 1}-${slugify(heading)}`,
      role: "body",
      alt: `${heading}正文配图`,
      prompt: imagePromptFor(article, heading, "body", index + 1, sectionContexts.get(heading)),
      anchorHeading: heading,
      localPath: join(imageDir, `${String(index + 1).padStart(2, "0")}-${slugify(heading)}.png`),
      targetWidth: 1200,
      targetHeight: 800,
      generationSize: "1536x1024"
    });
  }

  return slots;
}

export function createArticleVisualPlan(
  article: ArticlePackage,
  markdown: string,
  now: Date = new Date(),
  options?: ArticleVisualPlanOptions
): ArticleVisualPlan {
  const model = options?.model ?? "gpt-image-2";
  return {
    status: "planned",
    model,
    assets: planArticleVisualSlots(article, markdown, options).map((slot) => ({
      ...slot,
      source: "gpt-image-2",
      model,
      status: "planned"
    })),
    updatedAt: now.toISOString()
  };
}

export function insertArticleVisualMarkdown(markdown: string, slots: ArticleVisualSlot[]): string {
  const inlineSlots = slots.filter((slot) => slot.anchorHeading);
  let nextMarkdown = markdown.replace(/\n*<!-- visual:[\s\S]*?-->\n*!\[[^\]]*]\([^)]*\)\n*/g, "\n\n");

  for (const slot of inlineSlots) {
    const marker = `<!-- visual:${slot.id} -->\n![${slot.alt}](${slot.localPath})`;
    const headingPattern = new RegExp(`(^##\\s+${escapeRegExp(slot.anchorHeading ?? "")}\\s*$)`, "m");
    if (headingPattern.test(nextMarkdown)) {
      nextMarkdown = nextMarkdown.replace(headingPattern, `$1\n\n${marker}`);
    } else {
      nextMarkdown += `\n\n${marker}`;
    }
  }

  return `${nextMarkdown.trim()}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
