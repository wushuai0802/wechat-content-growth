import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArticlePackage } from "./domain";
import { generateArticleVisualAssets } from "./article-visual-generator";

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "wechat-raster-visual-"));
  tempDirs.push(dir);
  return dir;
}

function articleAt(dir: string): ArticlePackage {
  return {
    id: "article-raster",
    topicId: "topic-raster",
    title: "安徽考生选择热门专业前，先看清这三个差异",
    summary: "面向考生和家长的专业选择方法。",
    status: "approved",
    contentPath: join(dir, "article.md"),
    coverPath: join(dir, "cover.png"),
    qualityScore: 90,
    riskScore: 10,
    estimatedCost: 20,
    estimatedRevenue: 100,
    createdAt: "2026-07-13T00:00:00.000Z",
    contentBrief: {
      primaryGoal: "save",
      articleType: "professional_analysis",
      audience: "安徽考生和家长",
      readerProblem: "不知道热门专业之间的实际差异",
      corePromise: "用课程、能力和现实边界做比较",
      angle: "专业比较",
      callToAction: "先列三个不能妥协的条件",
      mustAvoid: ["承诺就业"]
    }
  };
}

function markdown(): string {
  return [
    "# 安徽考生选择热门专业前，先看清这三个差异",
    "",
    "开头正文。",
    "",
    "## 课程到底学什么",
    "",
    "课程内容。".repeat(500),
    "",
    "## 哪些能力更重要",
    "",
    "能力内容。".repeat(500)
  ].join("\n");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("generateArticleVisualAssets", () => {
  it("writes normalized PNG cover and body bitmaps with inspectable metadata", async () => {
    const dir = tempDir();
    const article = articleAt(dir);
    const source = await sharp({
      create: { width: 1536, height: 1024, channels: 3, background: { r: 42, g: 98, b: 120 } }
    }).png().toBuffer();
    const generateImageBytes = vi.fn(async () => new Uint8Array(source));

    const result = await generateArticleVisualAssets(article, markdown(), {
      imageDir: join(dir, "body"),
      imageModel: "gpt-image-2",
      maxInlineImages: 2,
      generateImageBytes,
      now: new Date("2026-07-13T01:00:00.000Z")
    });

    expect(result.visualPlan.status).toBe("ready");
    expect(result.visualPlan.assets).toHaveLength(3);
    expect(result.visualPlan.assets.every((asset) => asset.status === "generated")).toBe(true);
    expect(result.visualPlan.assets[0]).toMatchObject({ width: 1200, height: 510, mimeType: "image/png" });
    expect(result.visualPlan.assets[1]).toMatchObject({ width: 1200, height: 800, mimeType: "image/png" });
    expect(result.visualPlan.assets.every((asset) => typeof asset.sha256 === "string" && asset.sha256.length === 64)).toBe(true);
    expect(readFileSync(article.coverPath).subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(result.markdown).toContain("<!-- visual:article-raster-inline-1-");
    expect(generateImageBytes).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ size: "1536x1024" }));
  }, 20_000);

  it("marks failures for visual review without writing placeholder files", async () => {
    const dir = tempDir();
    const article = articleAt(dir);

    const result = await generateArticleVisualAssets(article, markdown(), {
      imageDir: join(dir, "body"),
      maxInlineImages: 1,
      generateImageBytes: vi.fn(async () => {
        throw new Error("image provider unavailable");
      }),
      now: new Date("2026-07-13T01:00:00.000Z")
    });

    expect(result.visualPlan.status).toBe("needs_visual_review");
    expect(result.visualPlan.assets.every((asset) => asset.status === "failed")).toBe(true);
    expect(result.visualPlan.assets.every((asset) => asset.error?.includes("image provider unavailable"))).toBe(true);
    expect(existsSync(article.coverPath)).toBe(false);
    expect(result.markdown).not.toContain("<!-- visual:");
  });

  it("rejects undecodable provider output instead of accepting a fake image", async () => {
    const dir = tempDir();
    const article = articleAt(dir);

    const result = await generateArticleVisualAssets(article, markdown(), {
      imageDir: join(dir, "body"),
      maxInlineImages: 0,
      generateImageBytes: vi.fn(async () => new Uint8Array(Buffer.from("not-an-image")))
    });

    expect(result.visualPlan.status).toBe("needs_visual_review");
    expect(result.visualPlan.assets[0].status).toBe("failed");
    expect(result.visualPlan.assets[0].error).toContain("Input buffer");
    expect(existsSync(article.coverPath)).toBe(false);
  });
});
