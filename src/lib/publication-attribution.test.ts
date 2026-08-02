import { describe, expect, it } from "vitest";
import type { ArticlePackage } from "./domain";
import { buildPublicationAttribution } from "./publication-attribution";

const article: ArticlePackage = {
  id: "article-1",
  topicId: "topic-1",
  title: "公众号初稿如何越写越准",
  summary: "summary",
  status: "approved",
  contentPath: "",
  coverPath: "E:\\AIArchive\\deliverables\\wechat-content-growth\\covers\\cover.png",
  qualityScore: 88,
  riskScore: 10,
  experimentTag: "workflow-playbook",
  estimatedCost: 20,
  estimatedRevenue: 300,
  createdAt: "2026-06-18T00:00:00.000Z"
};

describe("buildPublicationAttribution", () => {
  it("captures content shape features needed for profit learning", () => {
    const markdown = [
      "# 公众号初稿如何越写越准",
      "",
      "开头第一段，给普通读者一个清晰的场景。",
      "",
      "![cover](E:\\AIArchive\\deliverables\\wechat-content-growth\\inline\\cover.png)",
      "",
      "## 先看真实数据",
      "正文内容继续展开，说明为什么要记录发布时的文章形态。",
      "",
      "![chart](https://mmbiz.qpic.cn/chart.png)",
      "",
      "## 再改下一批",
      "1. 记录字数。",
      "2. 记录图片数量。",
      "3. 记录标题是否改过。"
    ].join("\n");

    const attribution = buildPublicationAttribution({
      article,
      markdown,
      draftTitle: "公众号初稿如何越写越准",
      coverMediaId: "thumb-media-id",
      draftId: "draft-media-id",
      createdAt: "2026-06-19T09:30:00.000Z"
    });

    expect(attribution).toMatchObject({
      titleAtDraft: "公众号初稿如何越写越准",
      originalTitle: article.title,
      titleChanged: false,
      wordCount: expect.any(Number),
      markdownImageCount: 2,
      uploadedInlineImageCount: 1,
      remoteInlineImageCount: 1,
      headingCount: 2,
      coverPath: article.coverPath,
      coverMediaId: "thumb-media-id",
      draftId: "draft-media-id",
      experimentTag: "workflow-playbook",
      qualityScore: 88,
      riskScore: 10,
      estimatedCost: 20,
      estimatedRevenue: 300,
      createdAt: "2026-06-19T09:30:00.000Z"
    });
    expect(attribution.wordCount).toBeGreaterThan(40);
    expect(attribution.imageDensityPerThousandWords).toBeGreaterThan(0);
  });

  it("marks title edits so outcomes can still be attributed after draft changes", () => {
    const attribution = buildPublicationAttribution({
      article,
      markdown: "# 新标题\n\n正文。",
      draftTitle: "新标题",
      createdAt: "2026-06-19T09:30:00.000Z"
    });

    expect(attribution.titleChanged).toBe(true);
    expect(attribution.originalTitle).toBe(article.title);
    expect(attribution.titleAtDraft).toBe("新标题");
  });
});
