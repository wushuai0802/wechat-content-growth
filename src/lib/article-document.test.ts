import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ArticlePackage } from "./domain";
import { readArticleDocument, updateArticleDocument } from "./article-document";

const tempDirs: string[] = [];

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "wechat-article-doc-"));
  tempDirs.push(dir);
  return dir;
}

function articleAt(path: string): ArticlePackage {
  return {
    id: "article-1",
    topicId: "topic-1",
    title: "旧标题",
    summary: "旧摘要",
    status: "review",
    contentPath: path,
    coverPath: "",
    qualityScore: 80,
    riskScore: 12,
    estimatedCost: 30,
    estimatedRevenue: 120,
    createdAt: "2026-06-18T08:00:00.000Z"
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("article document helpers", () => {
  it("reads Markdown content for an article", () => {
    const dir = tempDir();
    const contentPath = join(dir, "draft.md");
    writeFileSync(contentPath, "# 草稿\n\n正文", "utf8");

    const document = readArticleDocument(articleAt(contentPath));

    expect(document.article.title).toBe("旧标题");
    expect(document.markdown).toBe("# 草稿\n\n正文");
  });

  it("returns empty Markdown when the content file does not exist", () => {
    const document = readArticleDocument(articleAt(join(tempDir(), "missing", "draft.md")));

    expect(document.markdown).toBe("");
  });

  it("updates article metadata and Markdown content", () => {
    const dir = tempDir();
    const contentPath = join(dir, "nested", "draft.md");
    const article = articleAt(contentPath);

    const updated = updateArticleDocument(article, {
      title: "新标题",
      summary: "新摘要",
      markdown: "# 新标题\n\n新正文"
    });

    expect(updated.title).toBe("新标题");
    expect(updated.summary).toBe("新摘要");
    expect(readFileSync(contentPath, "utf8")).toBe("# 新标题\n\n新正文");
  });

  it("preserves existing metadata fields when patch values are omitted", () => {
    const dir = tempDir();
    const contentPath = join(dir, "draft.md");
    writeFileSync(contentPath, "# 旧正文", "utf8");
    const article = articleAt(contentPath);

    const updated = updateArticleDocument(article, { markdown: "# 只改正文" });

    expect(updated.title).toBe("旧标题");
    expect(updated.summary).toBe("旧摘要");
    expect(readFileSync(contentPath, "utf8")).toBe("# 只改正文");
  });

  it("updates the visual plan alongside article content", () => {
    const article = articleAt(join(tempDir(), "draft.md"));
    const visualPlan = {
      status: "needs_visual_review" as const,
      model: "gpt-image-2",
      assets: [],
      updatedAt: "2026-07-13T00:00:00.000Z"
    };

    const updated = updateArticleDocument(article, { visualPlan });

    expect(updated.visualPlan).toEqual(visualPlan);
  });
});
