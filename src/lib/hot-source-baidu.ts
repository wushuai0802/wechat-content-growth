import type { TrendSignal } from "./domain";
import { withFetchTimeout } from "./fetch-timeout";
import { allowlistedHttpsUrl, hotKeywordList, hotTitleSlug, normalizeExternalText, normalizedHeat } from "./hot-source-utils";

const BAIDU_HOT_URL = "https://top.baidu.com/board?tab=realtime";

interface BaiduHotParseOptions {
  now?: Date;
  limit?: number;
}

interface BaiduHotEntry {
  word?: string;
  query?: string;
  rawUrl?: string;
  url?: string;
  hotScore?: string;
  hotChange?: string;
  desc?: string;
}

function decodeEscapedJson(value: string): string {
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_match, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function growthScore(change: string | undefined): number {
  if (change === "rise") {
    return 18;
  }
  if (change === "fall") {
    return 2;
  }
  return 6;
}

function competitionScore(index: number): number {
  return Math.max(28, Math.min(74, 35 + index * 5));
}

function extractEntries(html: string): BaiduHotEntry[] {
  const decoded = decodeEscapedJson(decodeHtmlEntities(html));
  const pattern = /\{[^{}]*"(?:word|query)":"[^"]+"[^{}]*\}/gs;
  const entries: BaiduHotEntry[] = [];

  for (const match of decoded.matchAll(pattern)) {
    const text = match[0];
    const title = (/"word":"([^"]+)"/.exec(text)?.[1] ?? /"query":"([^"]+)"/.exec(text)?.[1])?.trim();
    if (!title) {
      continue;
    }

    entries.push({
      word: title,
      query: /"query":"([^"]+)"/.exec(text)?.[1] ?? title,
      rawUrl: /"rawUrl":"([^"]+)"/.exec(text)?.[1],
      url: /"url":"([^"]+)"/.exec(text)?.[1],
      hotScore: /"hotScore":"([^"]+)"/.exec(text)?.[1],
      hotChange: /"hotChange":"([^"]+)"/.exec(text)?.[1],
      desc: /"desc":"([^"]*)"/.exec(text)?.[1]
    });
  }

  return entries;
}

export function parseBaiduHotPage(html: string, options?: BaiduHotParseOptions): TrendSignal[] {
  const entries = extractEntries(html);
  const seen = new Set<string>();
  const limit = options?.limit ?? 20;
  const now = (options?.now ?? new Date()).toISOString();
  const scores = entries.map((entry) => Number(entry.hotScore ?? 0)).filter((score) => Number.isFinite(score));
  const maxScore = Math.max(1, ...scores);

  return entries
    .filter((entry) => {
    const title = normalizeExternalText(entry.word ?? entry.query);
      if (!title || seen.has(title)) {
        return false;
      }
      seen.add(title);
      return true;
    })
    .slice(0, limit)
    .map((entry, index) => {
      const title = normalizeExternalText(entry.word ?? entry.query);
      const score = Number(entry.hotScore ?? 0);
      const desc = entry.desc ?? "";
      return {
        id: `trend-baidu-${hotTitleSlug(title)}`,
        title,
        source: "baidu",
        url: allowlistedHttpsUrl(entry.rawUrl || entry.url, ["baidu.com"], `${BAIDU_HOT_URL}&q=${encodeURIComponent(title)}`),
        heat: Math.max(1, normalizedHeat(score, maxScore)),
        growth: growthScore(entry.hotChange),
        competition: competitionScore(index),
        category: "百度热搜",
        keywords: hotKeywordList(title, desc),
        observedAt: now
      } satisfies TrendSignal;
    });
}

export async function fetchBaiduHotTrends(options?: BaiduHotParseOptions): Promise<TrendSignal[]> {
  const response = await fetch(BAIDU_HOT_URL, withFetchTimeout({
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    cache: "no-store"
  }, 15_000));

  if (!response.ok) {
    throw new Error(`Baidu hot board request failed: ${response.status}`);
  }

  return parseBaiduHotPage(await response.text(), options);
}
