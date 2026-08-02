import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ArticleDocument } from "@/lib/article-document";
import { ArticleEditorClient } from "./article-editor-client";

describe("ArticleEditorClient visual review", () => {
  it("renders raster status, previews, regeneration scopes, and approval", () => {
    const detail: ArticleDocument = {
      article: {
        id: "article-visual-ui",
        topicId: "topic-1",
        title: "文章标题",
        summary: "摘要",
        status: "approved",
        contentPath: "D:/article.md",
        coverPath: "D:/cover.png",
        qualityScore: 90,
        riskScore: 10,
        estimatedCost: 10,
        estimatedRevenue: 100,
        createdAt: "2026-07-13T00:00:00.000Z",
        visualPlan: {
          status: "ready",
          model: "gpt-image-2",
          updatedAt: "2026-07-13T01:00:00.000Z",
          assets: [{
            id: "asset-cover",
            role: "cover",
            alt: "文章封面",
            prompt: "prompt",
            localPath: "D:/cover.png",
            source: "gpt-image-2",
            model: "gpt-image-2",
            status: "generated",
            targetWidth: 1200,
            targetHeight: 510,
            generationSize: "1536x1024",
            width: 1200,
            height: 510,
            mimeType: "image/png",
            sha256: "a".repeat(64),
            generatedAt: "2026-07-13T01:00:00.000Z"
          }]
        }
      },
      markdown: "# 文章标题\n\n正文"
    };

    const html = renderToStaticMarkup(<ArticleEditorClient initialDetail={detail} />);

    expect(html).toContain("位图已就绪");
    expect(html).toContain("gpt-image-2");
    expect(html).toContain('title="重新生成全部配图"');
    expect(html).toContain('title="重新生成封面"');
    expect(html).toContain('title="重新生成正文图"');
    expect(html).toContain('title="确认配图"');
    expect(html).toContain("/api/articles/article-visual-ui/visuals?assetId=asset-cover");
  });
});
