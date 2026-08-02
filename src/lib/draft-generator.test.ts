import { describe, expect, it } from "vitest";
import { topics } from "./sample-data";
import { generateDraftArticle } from "./draft-generator";
import { getArticleDraftsDir } from "./paths";

describe("generateDraftArticle", () => {
  it("creates a review-ready article package and markdown draft", () => {
    const result = generateDraftArticle(topics[0], {
      now: new Date("2026-06-18T00:10:00.000Z"),
      sequence: 7
    });

    expect(result.article.id).toBe("article-topic-hot-1-20260618081000-7");
    expect(result.article.status).toBe("review");
    expect(result.article.contentPath).toContain(getArticleDraftsDir());
    expect(result.markdown).toContain("# 端午后 AI 办公工具更新潮：哪些功能真的能省时间");
    expect(result.markdown).toContain("## 先把问题说清楚");
    expect(result.markdown).toContain("## 今天先做一件小事");
    expect(result.markdown).not.toContain("## 收益假设");
    expect(result.markdown).not.toContain("## 审阅提示");
    expect(result.article.contentBrief).toMatchObject({
      audience: topics[0].audience,
      primaryGoal: "save"
    });
    expect(result.article.factPack).toEqual([]);
    expect(result.article.qualityAssessment).toMatchObject({
      passed: true,
      score: result.article.qualityScore,
      hardBlockReasons: []
    });
  });

  it("uses a Chinese H1 from generated markdown as the article title", () => {
    const result = generateDraftArticle(topics[0], {
      markdownOverride: "# 用 AI 自动整理会议纪要\n\n正文内容"
    });

    expect(result.article.title).toBe("用 AI 自动整理会议纪要");
    expect(result.article.summary).toContain("用 AI 自动整理会议纪要");
  });

  it("uses a Chinese fallback title for safe seeded English topics", () => {
    const result = generateDraftArticle({
      ...topics[0],
      id: "topic-safe-local-ai-content-pipeline",
      title: "Local AI content pipeline: from source archive to draft generation"
    }, {
      markdownOverride: "# Local AI content pipeline: from source archive to draft generation\n\n中文正文"
    });

    expect(result.article.title).toBe("本地 AI 内容流水线：从资料归档到公众号初稿");
    expect(result.markdown).toContain("# 本地 AI 内容流水线：从资料归档到公众号初稿");
  });

  it("preserves a topic fact pack for later generation and quality review", () => {
    const fact = {
      id: "fact-1",
      claim: "示例官方页面公布了当年的招生章程",
      sourceName: "示例高校招生网",
      sourceType: "official" as const,
      verificationStatus: "verified" as const,
      sourceUrl: "https://example.edu/admission",
      publishedAt: "2026-06-01",
      applicableRegion: "安徽"
    };
    const result = generateDraftArticle({ ...topics[0], factPack: [fact] });

    expect(result.article.factPack).toEqual([fact]);
    expect(result.markdown).toContain("示例官方页面公布了当年的招生章程");
    expect(result.markdown).toContain("https://example.edu/admission");
  });
});
