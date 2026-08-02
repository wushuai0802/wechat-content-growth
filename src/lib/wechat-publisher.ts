import type { ArticlePackage } from "./domain";
import { withFetchTimeout } from "./fetch-timeout";

export const DEFAULT_WECHAT_AUTHOR = "\u80d6\u4f6c\u778e\u6363\u9f13";

interface WechatDraftArticlePayload {
  title: string;
  author: string;
  digest: string;
  thumb_media_id: string;
  content: string;
  need_open_comment: 0 | 1;
  only_fans_can_comment: 0 | 1;
}

interface WechatDraftResponse {
  media_id?: string;
  errcode?: number;
  errmsg?: string;
}

interface WechatMaterialResponse {
  media_id?: string;
  url?: string;
  errcode?: number;
  errmsg?: string;
}

interface WechatPublishResponse {
  publish_id?: string;
  errcode?: number;
  errmsg?: string;
}

export interface CreateWechatDraftInput {
  article: ArticlePackage;
  markdown: string;
  accessToken: string;
  thumbMediaId: string;
  fetchImpl?: typeof fetch;
}

export interface UpdateWechatDraftInput extends CreateWechatDraftInput {
  draftId: string;
  index?: number;
}

export interface CreateWechatDraftResult {
  draftId: string;
}

export interface UploadWechatImageMaterialInput {
  file: File;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export interface UploadWechatImageMaterialResult {
  mediaId: string;
}

export interface UploadWechatInlineImageInput {
  file: File;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export interface UploadWechatInlineImageResult {
  url: string;
}

export interface PublishWechatDraftInput {
  draftId: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export interface PublishWechatDraftResult {
  publishId: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(value: string): string {
  const tokenPattern = /(\*\*[^*\n]+\*\*|\[[^\]\n]+]\(https?:\/\/[^)\s]+\)|`[^`\n]+`)/g;
  let html = "";
  let cursor = 0;

  for (const match of value.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index ?? cursor;
    html += escapeHtml(value.slice(cursor, index));

    if (token.startsWith("**")) {
      html += `<strong style="font-weight:700;color:#1f2937;">${escapeHtml(token.slice(2, -2))}</strong>`;
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)]\((https?:\/\/[^)\s]+)\)$/.exec(token);
      html += link
        ? `<a href="${escapeHtml(link[2])}" style="color:#2563eb;text-decoration:none;">${escapeHtml(link[1])}</a>`
        : escapeHtml(token);
    } else {
      html += `<code style="font-family:Menlo,Consolas,monospace;font-size:0.92em;background:#f3f4f6;border-radius:4px;padding:1px 4px;">${escapeHtml(token.slice(1, -1))}</code>`;
    }
    cursor = index + token.length;
  }

  return html + escapeHtml(value.slice(cursor));
}

function paragraphStyle(extra = ""): string {
  return `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:1.85;color:#2f2f2f;margin:0 0 16px;${extra}`;
}

function renderParagraph(lines: string[]): string {
  const text = lines.join("\n").trim();
  if (!text) return "";
  return `<p style="${paragraphStyle()}">${renderInlineMarkdown(text).replace(/\n/g, "<br />")}</p>`;
}

function renderList(items: string[], ordered: boolean): string {
  const tag = ordered ? "ol" : "ul";
  const listStyle = ordered ? "decimal" : "disc";
  const renderedItems = items
    .map((item) => `<li style="${paragraphStyle("margin:0 0 8px;")}">${renderInlineMarkdown(item)}</li>`)
    .join("");
  return `<${tag} style="padding-left:22px;margin:0 0 18px;list-style-type:${listStyle};">${renderedItems}</${tag}>`;
}

function renderCodeBlock(lines: string[]): string {
  return `<pre style="white-space:pre-wrap;font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.65;color:#344054;background:#f6f8fa;border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;margin:0 0 18px;">${escapeHtml(lines.join("\n").trim())}</pre>`;
}

function renderHeading(level: 1 | 2 | 3, text: string): string {
  if (level === 1) {
    return `<h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:24px;line-height:1.35;color:#111827;font-weight:700;margin:0 0 20px;">${renderInlineMarkdown(text)}</h1>`;
  }
  if (level === 2) {
    return `<h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:19px;line-height:1.45;color:#111827;font-weight:700;border-left:4px solid #2563eb;padding-left:10px;margin:28px 0 14px;">${renderInlineMarkdown(text)}</h2>`;
  }
  return `<h3 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:17px;line-height:1.5;color:#1f2937;font-weight:700;margin:20px 0 10px;">${renderInlineMarkdown(text)}</h3>`;
}

function renderQuote(text: string): string {
  return `<blockquote style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.75;color:#475467;background:#f8fafc;border-left:4px solid #94a3b8;padding:10px 14px;margin:0 0 18px;">${renderInlineMarkdown(text)}</blockquote>`;
}

function renderImage(alt: string, url: string): string {
  return `<p style="margin:22px 0;text-align:center;"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;border-radius:6px;display:block;margin:0 auto;" /></p>`;
}

function clampUtf16(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

export function normalizeWechatDraftTitle(title: string): string {
  return clampUtf16(title, 64);
}

export function normalizeWechatDraftDigest(digest: string): string {
  return clampUtf16(digest, 120);
}

export function replaceMarkdownImageUrls(markdown: string, imageUrls: Record<string, string>): string {
  return markdown.replace(/!\[([^\]]*)]\(([^)\s]+)\)/g, (match, alt: string, url: string) => {
    const replacement = imageUrls[url];
    return replacement ? `![${alt}](${replacement})` : match;
  });
}

export function extractMarkdownImageUrls(markdown: string): string[] {
  const urls = new Set<string>();
  for (const match of markdown.matchAll(/!\[[^\]]*]\(([^)\s]+)\)/g)) {
    const url = match[1]?.trim();
    if (url) urls.add(url);
  }
  return [...urls];
}

function omitLeadingArticleTitle(markdown: string, articleTitle?: string): string {
  if (!articleTitle?.trim()) return markdown;
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentIndex < 0) return markdown;
  const heading = /^#\s+(.+)$/.exec(lines[firstContentIndex].trim());
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  if (!heading || normalize(heading[1]) !== normalize(articleTitle)) return markdown;
  lines.splice(firstContentIndex, 1);
  return lines.join("\n");
}

function omitHtmlComments(markdown: string): string {
  let inCodeBlock = false;
  let inComment = false;

  return markdown.replace(/\r\n/g, "\n").split("\n").map((rawLine) => {
    if (!inComment && rawLine.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      return rawLine;
    }
    if (inCodeBlock) return rawLine;

    let remaining = rawLine;
    let visible = "";
    while (remaining.length > 0) {
      if (inComment) {
        const commentEnd = remaining.indexOf("-->");
        if (commentEnd < 0) return visible;
        remaining = remaining.slice(commentEnd + 3);
        inComment = false;
        continue;
      }

      const commentStart = remaining.indexOf("<!--");
      if (commentStart < 0) {
        visible += remaining;
        break;
      }

      visible += remaining.slice(0, commentStart);
      remaining = remaining.slice(commentStart + 4);
      inComment = true;
    }
    return visible;
  }).join("\n");
}

export function markdownToWechatHtml(markdown: string, articleTitle?: string): string {
  const lines = omitLeadingArticleTitle(omitHtmlComments(markdown), articleTitle).split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let orderedList = false;
  let codeLines: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    const rendered = renderParagraph(paragraph);
    if (rendered) html.push(rendered);
    paragraph = [];
  };
  const flushList = () => {
    if (listItems.length > 0) html.push(renderList(listItems, orderedList));
    listItems = [];
    orderedList = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) {
        html.push(renderCodeBlock(codeLines));
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed === "---") {
      flushParagraph();
      flushList();
      html.push('<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />');
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      html.push(renderHeading(heading[1].length as 1 | 2 | 3, heading[2].trim()));
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      html.push(renderQuote(trimmed.slice(2).trim()));
      continue;
    }

    const image = /^!\[([^\]]*)]\(([^)\s]+)\)$/.exec(trimmed);
    if (image) {
      flushParagraph();
      flushList();
      html.push(renderImage(image[1].trim(), image[2].trim()));
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
    const ordered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (listItems.length > 0 && orderedList !== isOrdered) flushList();
      orderedList = isOrdered;
      listItems.push((ordered ?? unordered)?.[1].trim() ?? trimmed);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  if (inCode && codeLines.length > 0) html.push(renderCodeBlock(codeLines));
  flushParagraph();
  flushList();

  return html.join("\n");
}

export async function createWechatDraft(input: CreateWechatDraftInput): Promise<CreateWechatDraftResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${encodeURIComponent(input.accessToken)}`;
  const draftArticle: WechatDraftArticlePayload = {
    title: normalizeWechatDraftTitle(input.article.title),
    author: DEFAULT_WECHAT_AUTHOR,
    digest: normalizeWechatDraftDigest(input.article.summary),
    thumb_media_id: input.thumbMediaId,
    content: markdownToWechatHtml(input.markdown, input.article.title),
    need_open_comment: 0,
    only_fans_can_comment: 0
  };

  const response = await fetchImpl(url, withFetchTimeout({
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: Buffer.from(JSON.stringify({ articles: [draftArticle] }), "utf8")
  }, 30_000));

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`WeChat draft HTTP request failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as WechatDraftResponse;
  if (data.errcode) {
    throw new Error(`WeChat draft create failed: ${data.errcode} ${data.errmsg ?? "unknown error"}`);
  }
  if (!data.media_id) {
    throw new Error("WeChat draft create failed: missing media_id");
  }

  return { draftId: data.media_id };
}

export async function updateWechatDraft(input: UpdateWechatDraftInput): Promise<CreateWechatDraftResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `https://api.weixin.qq.com/cgi-bin/draft/update?access_token=${encodeURIComponent(input.accessToken)}`;
  const draftArticle: WechatDraftArticlePayload = {
    title: normalizeWechatDraftTitle(input.article.title),
    author: DEFAULT_WECHAT_AUTHOR,
    digest: normalizeWechatDraftDigest(input.article.summary),
    thumb_media_id: input.thumbMediaId,
    content: markdownToWechatHtml(input.markdown, input.article.title),
    need_open_comment: 0,
    only_fans_can_comment: 0
  };

  const response = await fetchImpl(url, withFetchTimeout({
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: Buffer.from(JSON.stringify({ media_id: input.draftId, index: input.index ?? 0, articles: draftArticle }), "utf8")
  }, 30_000));

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`WeChat draft update HTTP request failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as WechatDraftResponse;
  if (data.errcode) {
    throw new Error(`WeChat draft update failed: ${data.errcode} ${data.errmsg ?? "unknown error"}`);
  }

  return { draftId: input.draftId };
}

export async function uploadWechatImageMaterial(input: UploadWechatImageMaterialInput): Promise<UploadWechatImageMaterialResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${encodeURIComponent(input.accessToken)}&type=image`;
  const formData = new FormData();
  formData.append("media", input.file);

  const response = await fetchImpl(url, withFetchTimeout({ method: "POST", body: formData }, 60_000));
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`WeChat image material HTTP request failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as WechatMaterialResponse;
  if (data.errcode) {
    throw new Error(`WeChat image material upload failed: ${data.errcode} ${data.errmsg ?? "unknown error"}`);
  }
  if (!data.media_id) {
    throw new Error("WeChat image material upload failed: missing media_id");
  }

  return { mediaId: data.media_id };
}

export async function uploadWechatInlineImage(input: UploadWechatInlineImageInput): Promise<UploadWechatInlineImageResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${encodeURIComponent(input.accessToken)}`;
  const formData = new FormData();
  formData.append("media", input.file);

  const response = await fetchImpl(url, withFetchTimeout({ method: "POST", body: formData }, 60_000));
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`WeChat inline image HTTP request failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as WechatMaterialResponse;
  if (data.errcode) {
    throw new Error(`WeChat inline image upload failed: ${data.errcode} ${data.errmsg ?? "unknown error"}`);
  }
  if (!data.url) {
    throw new Error("WeChat inline image upload failed: missing url");
  }

  return { url: data.url };
}

export async function publishWechatDraft(input: PublishWechatDraftInput): Promise<PublishWechatDraftResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${encodeURIComponent(input.accessToken)}`;
  const response = await fetchImpl(url, withFetchTimeout({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_id: input.draftId })
  }, 30_000));

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`WeChat publish HTTP request failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as WechatPublishResponse;
  if (data.errcode) {
    throw new Error(`WeChat publish submit failed: ${data.errcode} ${data.errmsg ?? "unknown error"}`);
  }
  if (!data.publish_id) {
    throw new Error("WeChat publish submit failed: missing publish_id");
  }

  return { publishId: data.publish_id };
}
