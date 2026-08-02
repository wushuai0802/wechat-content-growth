import { createHash } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";
import type { ArticlePackage, ArticleVisualAsset, ArticleVisualAssetRole, ArticleVisualPlan } from "./domain";
import { generateCpaImageBytes } from "./local-cpa-image-client";
import type { LocalCpaConfig } from "./local-cpa-client";
import { insertArticleVisualMarkdown, planArticleVisualSlots, type ArticleVisualSlot } from "./article-visuals";

interface ImageGenerationRequest {
  model: string;
  size: string;
}

type GenerateImageBytes = (prompt: string, request: ImageGenerationRequest) => Promise<Uint8Array>;

export interface GenerateArticleVisualAssetsOptions {
  cpaConfig?: LocalCpaConfig | null;
  imageModel?: string;
  imageDir?: string;
  maxInlineImages?: number;
  roles?: ArticleVisualAssetRole[];
  existingPlan?: ArticleVisualPlan;
  now?: Date;
  generateImageBytes?: GenerateImageBytes;
}

export interface GenerateArticleVisualAssetsResult {
  visualPlan: ArticleVisualPlan;
  markdown: string;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapCoverTitle(title: string): string[] {
  const compact = title.trim().replace(/\s+/g, " ");
  const chars = [...compact];
  const maxPerLine = chars.length > 28 ? 12 : 14;
  const lines: string[] = [];
  for (let index = 0; index < chars.length && lines.length < 3; index += maxPerLine) {
    lines.push(chars.slice(index, index + maxPerLine).join(""));
  }
  if (chars.length > maxPerLine * 3 && lines.length === 3) {
    lines[2] = `${lines[2].slice(0, Math.max(1, maxPerLine - 1))}…`;
  }
  return lines;
}

function coverTitleOverlay(title: string): Buffer {
  const lines = wrapCoverTitle(title);
  const fontSize = lines.some((line) => [...line].length > 12) ? 46 : 52;
  const lineHeight = Math.round(fontSize * 1.35);
  const firstY = Math.round((510 - lineHeight * lines.length) / 2 + fontSize);
  const text = lines.map((line, index) => (
    `<text x="62" y="${firstY + index * lineHeight}" fill="#ffffff" font-size="${fontSize}" font-weight="700" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif">${escapeXml(line)}</text>`
  )).join("");

  return Buffer.from([
    '<svg width="1200" height="510" xmlns="http://www.w3.org/2000/svg">',
    '<defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#101820" stop-opacity="0.82"/><stop offset="0.42" stop-color="#101820" stop-opacity="0.45"/><stop offset="0.62" stop-color="#101820" stop-opacity="0"/></linearGradient></defs>',
    '<rect width="760" height="510" fill="url(#shade)"/>',
    text,
    '</svg>'
  ].join(""));
}

async function normalizeRaster(slot: ArticleVisualSlot, input: Uint8Array, title: string): Promise<Buffer> {
  const source = Buffer.from(input);
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new Error("Generated image has no decodable raster metadata");
  }
  if (!new Set(["png", "jpeg", "webp"]).has(metadata.format)) {
    throw new Error(`Generated image format is not allowed: ${metadata.format}`);
  }
  if (metadata.width < 512 || metadata.height < 512) {
    throw new Error(`Generated image is too small: ${metadata.width}x${metadata.height}`);
  }

  let pipeline = sharp(source)
    .rotate()
    .resize(slot.targetWidth, slot.targetHeight, { fit: "cover", position: "attention" });
  if (slot.role === "cover") {
    pipeline = pipeline.composite([{ input: coverTitleOverlay(title), left: 0, top: 0 }]);
  }
  return pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

function writeAtomically(path: string, bytes: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tempPath, bytes);
    renameSync(tempPath, path);
  } finally {
    rmSync(tempPath, { force: true });
  }
}

function plannedAsset(slot: ArticleVisualSlot, model: string): ArticleVisualAsset {
  return {
    ...slot,
    source: "gpt-image-2",
    model,
    status: "planned"
  };
}

async function generatedAsset(
  article: ArticlePackage,
  slot: ArticleVisualSlot,
  model: string,
  generatedAt: string,
  generate: GenerateImageBytes
): Promise<ArticleVisualAsset> {
  try {
    const raw = await generate(slot.prompt, { model, size: slot.generationSize });
    const normalized = await normalizeRaster(slot, raw, article.title);
    const metadata = await sharp(normalized).metadata();
    writeAtomically(slot.localPath, normalized);
    return {
      ...plannedAsset(slot, model),
      status: "generated",
      width: metadata.width,
      height: metadata.height,
      mimeType: "image/png",
      sha256: createHash("sha256").update(normalized).digest("hex"),
      generatedAt
    };
  } catch (error) {
    return {
      ...plannedAsset(slot, model),
      status: "failed",
      error: error instanceof Error ? error.message : "Image generation failed."
    };
  }
}

export async function generateArticleVisualAssets(
  article: ArticlePackage,
  markdown: string,
  options?: GenerateArticleVisualAssetsOptions
): Promise<GenerateArticleVisualAssetsResult> {
  const now = options?.now ?? new Date();
  const model = options?.imageModel ?? "gpt-image-2";
  const slots = planArticleVisualSlots(article, markdown, {
    imageDir: options?.imageDir,
    maxInlineImages: options?.maxInlineImages ?? 3,
    model
  });
  const selectedRoles = new Set(options?.roles ?? ["cover", "body"]);
  const existingById = new Map((options?.existingPlan?.assets ?? []).map((asset) => [asset.id, asset]));
  const provider = options?.generateImageBytes ?? (options?.cpaConfig
    ? ((prompt, request) => generateCpaImageBytes(prompt, {
        baseUrl: options.cpaConfig!.baseUrl,
        apiKey: options.cpaConfig!.apiKey,
        model: request.model,
        size: request.size
      }))
    : null);
  const assets: ArticleVisualAsset[] = [];

  for (const slot of slots) {
    if (!selectedRoles.has(slot.role)) {
      assets.push(existingById.get(slot.id) ?? plannedAsset(slot, model));
      continue;
    }
    if (!provider) {
      assets.push({ ...plannedAsset(slot, model), status: "failed", error: "CPA image provider is not configured." });
      continue;
    }
    assets.push(await generatedAsset(article, slot, model, now.toISOString(), provider));
  }

  const allApproved = assets.length > 0 && assets.every((asset) => asset.status === "approved");
  const allGenerated = assets.length > 0 && assets.every((asset) => asset.status === "generated" || asset.status === "approved");
  const visualPlan: ArticleVisualPlan = {
    status: allApproved ? "approved" : allGenerated ? "ready" : "needs_visual_review",
    model,
    assets,
    updatedAt: now.toISOString()
  };
  const successfulSlots: ArticleVisualSlot[] = assets
    .filter((asset) => asset.status === "generated" || asset.status === "approved")
    .map((asset) => ({
      id: asset.id,
      role: asset.role,
      alt: asset.alt,
      prompt: asset.prompt,
      anchorHeading: asset.anchorHeading,
      localPath: asset.localPath,
      targetWidth: asset.targetWidth,
      targetHeight: asset.targetHeight,
      generationSize: asset.generationSize
    }));

  return {
    visualPlan,
    markdown: insertArticleVisualMarkdown(markdown, successfulSlots)
  };
}
