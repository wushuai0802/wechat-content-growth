import { describe, expect, it, vi } from "vitest";
import type { ArticlePackage } from "./domain";
import {
  createWechatDraft,
  DEFAULT_WECHAT_AUTHOR,
  extractMarkdownImageUrls,
  markdownToWechatHtml,
  normalizeWechatDraftTitle,
  replaceMarkdownImageUrls,
  updateWechatDraft,
  uploadWechatImageMaterial,
  uploadWechatInlineImage
} from "./wechat-publisher";

const article: ArticlePackage = {
  id: "article-1",
  topicId: "topic-1",
  title: "AI search product update",
  summary: "A short summary for testing",
  status: "approved",
  contentPath: "",
  coverPath: "",
  qualityScore: 82,
  riskScore: 12,
  estimatedCost: 20,
  estimatedRevenue: 300,
  createdAt: "2026-06-18T00:00:00.000Z"
};

describe("createWechatDraft", () => {
  it("clamps long titles to the WeChat draft limit", () => {
    const title = "Local AI content pipeline: from source archive to draft generation with a reusable team workflow";

    expect(normalizeWechatDraftTitle(title)).toHaveLength(64);
    expect(normalizeWechatDraftTitle(title)).toBe(title.slice(0, 64));
  });

  it("renders readable WeChat HTML for lists, code blocks, section headings, and images", () => {
    const html = markdownToWechatHtml([
      "# Practical AI checklist",
      "",
      "A short opening paragraph.",
      "",
      "## Steps",
      "",
      "1. Prepare a simple template.",
      "2. Review the result.",
      "",
      "- Avoid private data.",
      "- Keep source notes.",
      "",
      "![workflow](https://mmbiz.qpic.cn/example.png)",
      "",
      "```text",
      "/source-archive",
      "  /notes",
      "```"
    ].join("\n"));

    expect(html).toContain("Practical AI checklist");
    expect(html).toContain("Steps");
    expect(html).toContain("Prepare a simple template");
    expect(html).toContain("<img");
    expect(html).toContain("https://mmbiz.qpic.cn/example.png");
    expect(html).toContain("font-family");
    expect(html).toContain("white-space:pre-wrap");
    expect(html).not.toContain("```text");
  });

  it("omits a leading H1 that duplicates the WeChat draft title", () => {
    const html = markdownToWechatHtml("# Article title\n\nOpening paragraph.\n\n## Section\n\nBody.", "Article title");

    expect(html).not.toContain("Article title");
    expect(html).toContain("Opening paragraph");
    expect(html).toContain("Section");
  });

  it("renders inline emphasis, source links, and code without exposing markdown markers", () => {
    const html = markdownToWechatHtml("Read **the rule** from [the official source](https://example.com/rule) and check `status`.");

    expect(html).toContain("<strong");
    expect(html).toContain("the rule</strong>");
    expect(html).toContain('href="https://example.com/rule"');
    expect(html).toContain(">the official source</a>");
    expect(html).toContain("<code");
    expect(html).not.toContain("**the rule**");
    expect(html).not.toContain("](https://example.com/rule)");
    expect(html).not.toContain("`status`");
  });

  it("omits internal HTML comments without exposing visual markers", () => {
    const html = markdownToWechatHtml([
      "# Article title",
      "",
      "Opening paragraph.",
      "",
      "<!-- visual:article-1-inline-1 -->",
      "![body](https://mmbiz.qpic.cn/body.png)",
      "",
      "<!--",
      "internal editorial metadata",
      "-->",
      "Body paragraph.",
      "",
      "```html",
      "<!-- literal code example -->",
      "```"
    ].join("\n"), "Article title");

    expect(html).not.toContain("visual:article-1-inline-1");
    expect(html).not.toContain("internal editorial metadata");
    expect(html).toContain("Opening paragraph");
    expect(html).toContain("Body paragraph");
    expect(html).toContain("https://mmbiz.qpic.cn/body.png");
    expect(html).toContain("literal code example");
  });

  it("extracts and replaces local markdown image URLs with uploaded WeChat CDN URLs", () => {
    const markdown = "# Title\n\n![body](D:\\AIWorkspace\\inline.png)\n\n![remote](https://example.com/remote.png)";
    expect(extractMarkdownImageUrls(markdown)).toEqual([
      "D:\\AIWorkspace\\inline.png",
      "https://example.com/remote.png"
    ]);

    const replaced = replaceMarkdownImageUrls(markdown, {
      "D:\\AIWorkspace\\inline.png": "https://mmbiz.qpic.cn/inline.png"
    });

    expect(replaced).toContain("https://mmbiz.qpic.cn/inline.png");
    expect(replaced).toContain("https://example.com/remote.png");
    expect(replaced).not.toContain("D:\\AIWorkspace\\inline.png");
  });

  it("sends the draft payload as explicit UTF-8 JSON bytes", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ media_id: "draft-media-id" })
    })) as unknown as typeof fetch;

    await createWechatDraft({
      article: { ...article, title: "AI meeting notes", summary: "Chinese capable summary" },
      markdown: "# AI meeting notes\n\nBody with ![image](https://mmbiz.qpic.cn/body.png)",
      accessToken: "access-token",
      thumbMediaId: "thumb-media-id",
      fetchImpl: fetchMock
    });

    const init = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(init.headers).toEqual({ "Content-Type": "application/json; charset=utf-8" });
    expect(Buffer.isBuffer(init.body)).toBe(true);
    const bodyText = init.body.toString("utf8");
    expect(bodyText).toContain("AI meeting notes");
    expect(bodyText).toContain("https://mmbiz.qpic.cn/body.png");
    const payload = JSON.parse(bodyText) as { articles: Array<{ title: string; content: string }> };
    expect(payload.articles[0].title).toBe("AI meeting notes");
    expect(payload.articles[0].content).not.toContain("AI meeting notes");
  });

  it("creates a WeChat draft from an article and markdown", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ media_id: "draft-media-id" })
    })) as unknown as typeof fetch;

    await expect(
      createWechatDraft({
        article,
        markdown: "# AI search product update\n\nBody paragraph\n\n## Section\n\nSecond paragraph",
        accessToken: "access-token",
        thumbMediaId: "thumb-media-id",
        fetchImpl: fetchMock
      })
    ).resolves.toEqual({ draftId: "draft-media-id" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.weixin.qq.com/cgi-bin/draft/add?access_token=access-token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" }
      })
    );
    const sentBody = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body;
    const body = JSON.parse(sentBody.toString("utf8"));
    expect(body.articles[0]).toMatchObject({
      title: article.title,
      author: DEFAULT_WECHAT_AUTHOR,
      digest: article.summary,
      thumb_media_id: "thumb-media-id",
      need_open_comment: 0,
      only_fans_can_comment: 0
    });
    expect(body.articles[0].content).not.toContain("AI search product update");
    expect(body.articles[0].content).toContain("Section");
  });

  it("updates an existing WeChat draft with a replacement cover and content", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ errcode: 0, errmsg: "ok" })
    })) as unknown as typeof fetch;

    await expect(updateWechatDraft({
      draftId: "draft-media-id",
      article,
      markdown: "# AI search product update\n\nUpdated body",
      accessToken: "access-token",
      thumbMediaId: "new-thumb-media-id",
      fetchImpl: fetchMock
    })).resolves.toEqual({ draftId: "draft-media-id" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.weixin.qq.com/cgi-bin/draft/update?access_token=access-token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" }
      })
    );
    const sentBody = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body;
    const body = JSON.parse(sentBody.toString("utf8"));
    expect(body).toMatchObject({ media_id: "draft-media-id", index: 0 });
    expect(body.articles).toMatchObject({
      title: article.title,
      author: DEFAULT_WECHAT_AUTHOR,
      thumb_media_id: "new-thumb-media-id"
    });
  });

  it("surfaces WeChat draft API errors", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ errcode: 45009, errmsg: "api freq out of limit" })
    })) as unknown as typeof fetch;

    await expect(
      createWechatDraft({
        article,
        markdown: "Body",
        accessToken: "access-token",
        thumbMediaId: "thumb-media-id",
        fetchImpl: fetchMock
      })
    ).rejects.toThrow("WeChat draft create failed: 45009 api freq out of limit");
  });
});

describe("uploadWechatImageMaterial", () => {
  it("uploads an image material and returns its media id", async () => {
    const file = new File([Buffer.from("png")], "cover.png", { type: "image/png" });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ media_id: "thumb-media-id" })
    })) as unknown as typeof fetch;

    await expect(uploadWechatImageMaterial({ file, accessToken: "access-token", fetchImpl: fetchMock }))
      .resolves.toEqual({ mediaId: "thumb-media-id" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=access-token&type=image",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("uploadWechatInlineImage", () => {
  it("uploads an inline image and returns its WeChat CDN URL", async () => {
    const file = new File([Buffer.from("png")], "body.png", { type: "image/png" });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: "https://mmbiz.qpic.cn/body.png" })
    })) as unknown as typeof fetch;

    await expect(uploadWechatInlineImage({ file, accessToken: "access-token", fetchImpl: fetchMock }))
      .resolves.toEqual({ url: "https://mmbiz.qpic.cn/body.png" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=access-token",
      expect.objectContaining({ method: "POST" })
    );
  });
});
