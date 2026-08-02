import type { TrendSignal } from "./domain";
import { withFetchTimeout } from "./fetch-timeout";
import {
  competitionFromRank,
  finiteHotNumber,
  growthFromRank,
  hotKeywordList,
  hotTitleSlug,
  normalizedHeat,
  normalizeExternalText
} from "./hot-source-utils";

const WEIBO_HOT_URL = "https://weibo.com/ajax/side/hotSearch";

export interface WeiboHotParseOptions {
  now?: Date;
  limit?: number;
}

interface WeiboHotEntry {
  note?: unknown;
  word?: unknown;
  word_scheme?: unknown;
  num?: unknown;
  rank?: unknown;
  label_name?: unknown;
  is_ad?: unknown;
}

function entriesFromResponse(input: unknown): WeiboHotEntry[] {
  if (!input || typeof input !== "object") return [];
  const data = (input as { data?: unknown }).data;
  if (!data || typeof data !== "object") return [];
  const realtime = (data as { realtime?: unknown }).realtime;
  return Array.isArray(realtime) ? realtime as WeiboHotEntry[] : [];
}

export function parseWeiboHotResponse(input: unknown, options?: WeiboHotParseOptions): TrendSignal[] {
  const entries = entriesFromResponse(input).filter((entry) => !entry.is_ad);
  const maxHeat = Math.max(1, ...entries.map((entry) => finiteHotNumber(entry.num)));
  const observedAt = (options?.now ?? new Date()).toISOString();
  const limit = Math.max(0, options?.limit ?? 20);
  const seen = new Set<string>();

  return entries.flatMap((entry, index) => {
    const title = normalizeExternalText(entry.note ?? entry.word);
    const duplicateKey = title.toLowerCase();
    if (!title || seen.has(duplicateKey)) return [];
    seen.add(duplicateKey);
    const query = normalizeExternalText(entry.word_scheme ?? entry.word ?? title, 160) || title;
    const label = normalizeExternalText(entry.label_name, 80);

    return [{
      id: `trend-weibo-${hotTitleSlug(title)}`,
      title,
      source: "weibo",
      url: `https://s.weibo.com/weibo?q=${encodeURIComponent(query)}`,
      heat: normalizedHeat(entry.num, maxHeat),
      growth: growthFromRank(index),
      competition: competitionFromRank(index),
      category: "微博热搜",
      keywords: hotKeywordList(title, label),
      observedAt,
      remainingHalfLifeHours: 18,
      confidence: 78
    } satisfies TrendSignal];
  }).slice(0, limit);
}

export async function fetchWeiboHotTrends(options?: WeiboHotParseOptions): Promise<TrendSignal[]> {
  const response = await fetch(WEIBO_HOT_URL, withFetchTimeout({
    headers: {
      Accept: "application/json",
      Referer: "https://weibo.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    cache: "no-store"
  }, 15_000));

  if (!response.ok) throw new Error(`Weibo hot search request failed: ${response.status}`);
  return parseWeiboHotResponse(await response.json() as unknown, options);
}
