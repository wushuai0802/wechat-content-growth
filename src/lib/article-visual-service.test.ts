import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArticleDocument } from "./article-document";
import type { ArticlePackage, ArticleVisualPlan } from "./domain";
import type { WorkspaceStore } from "./workspace-store";
import { approveArticleVisuals, generateArticleVisuals } from "./article-visual-service";

const tempDirs: string[] = [];

function visualFixture(status: ArticleVisualPlan["status"] = "planned"): ArticleDocument {
  const dir = mkdtempSync(join(tmpdir(), "visual-service-"));
  tempDirs.push(dir);
  const article: ArticlePackage = {
    id: "article-1",
    topicId: "topic-1",
    title: "文章标题",
    summary: "摘要",
    status: "approved",
    contentPath: join(dir, "article.md"),
    coverPath: join(dir, "cover.png"),
    qualityScore: 90,
    riskScore: 10,
    estimatedCost: 1,
    estimatedRevenue: 2,
    createdAt: "2026-07-13T00:00:00.000Z",
    visualPlan: {
      status,
      model: "gpt-image-2",
      updatedAt: "2026-07-13T00:00:00.000Z",
      assets: [{
        id: "cover-1",
        role: "cover",
        alt: "封面",
        prompt: "prompt",
        localPath: join(dir, "cover.png"),
        source: "gpt-image-2",
        model: "gpt-image-2",
        status: status === "ready" ? "generated" : "planned",
        targetWidth: 1200,
        targetHeight: 510,
        generationSize: "1536x1024"
      }]
    }
  };
  writeFileSync(article.contentPath, "# 文章标题\n\n正文", "utf8");
  return { article, markdown: "# 文章标题\n\n正文" };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("article visual service", () => {
  it("persists generated visual metadata and supports a cover-only scope", async () => {
    const detail = visualFixture();
    const readyPlan = { ...detail.article.visualPlan!, status: "ready" as const };
    const updated = { article: { ...detail.article, visualPlan: readyPlan }, markdown: "# 文章标题\n\n新正文" };
    const updateArticleDetail = vi.fn(() => updated);
    const store = {
      getArticleDetail: vi.fn(() => detail),
      updateArticleDetail
    } as unknown as WorkspaceStore;
    const generate = vi.fn(async () => ({ visualPlan: readyPlan, markdown: updated.markdown }));

    const result = await generateArticleVisuals("article-1", "cover", {
      store,
      getConfig: () => ({ baseUrl: "http://127.0.0.1:8317/v1", apiKey: "secret", model: "gpt-5" }),
      generate
    });

    expect(generate).toHaveBeenCalledWith(detail.article, detail.markdown, expect.objectContaining({ roles: ["cover"] }));
    expect(updateArticleDetail).toHaveBeenCalledWith("article-1", {
      markdown: updated.markdown,
      visualPlan: readyPlan
    });
    expect(result).toBe(updated);
  });

  it("approves only complete raster plans whose files exist", () => {
    const detail = visualFixture("ready");
    writeFileSync(detail.article.coverPath, Buffer.from("png"));
    const updateArticleDetail = vi.fn((_id, patch) => ({ article: { ...detail.article, ...patch }, markdown: detail.markdown }));
    const store = {
      getArticleDetail: vi.fn(() => detail),
      updateArticleDetail
    } as unknown as WorkspaceStore;

    const result = approveArticleVisuals("article-1", {
      store,
      now: new Date("2026-07-13T02:00:00.000Z")
    });

    expect(result.article.visualPlan?.status).toBe("approved");
    expect(result.article.visualPlan?.assets[0]).toMatchObject({
      status: "approved",
      approvedAt: "2026-07-13T02:00:00.000Z"
    });
  });

  it("refuses to approve a visual plan with missing files", () => {
    const detail = visualFixture("ready");
    const store = { getArticleDetail: vi.fn(() => detail) } as unknown as WorkspaceStore;

    expect(() => approveArticleVisuals("article-1", { store })).toThrow("Visual asset file is missing");
  });
});
