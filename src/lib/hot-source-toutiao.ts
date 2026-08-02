import type { TrendSignal } from "./domain";
import { withFetchTimeout } from "./fetch-timeout";
import {
  allowlistedHttpsUrl,
  competitionFromRank,
  finiteHotNumber,
  growthFromRank,
  hotKeywordList,
  hotTitleSlug,
  normalizedHeat,
  normalizeExternalText
} from "./hot-source-utils";

const TOUTIAO_HOT_URL = "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc";

export interface ToutiaoHotParseOptions {
  now?: Date;
  limit?: number;
}

interface ToutiaoHotEntry {
  Title?: unknown;
  QueryWord?: unknown;
  HotValue?: unknown;
  Url?: unknown;
  Label?: unknown;
  LabelDesc?: unknown;
}

function entriesFromResponse(input: unknown): ToutiaoHotEntry[] {
  if (!input || typeof input !== "object") return [];
  const data = (input as { data?: unknown }).data;
  return Array.isArray(data) ? data as ToutiaoHotEntry[] : [];
}

export function parseToutiaoHotResponse(input: unknown, options?: ToutiaoHotParseOptions): TrendSignal[] {
  const entries = entriesFromResponse(input);
  const maxHeat = Math.max(1, ...entries.map((entry) => finiteHotNumber(entry.HotValue)));
  const observedAt = (options?.now ?? new Date()).toISOString();
  const limit = Math.max(0, options?.limit ?? 20);
  const seen = new Set<string>();

  return entries.flatMap((entry, index) => {
    const title = normalizeExternalText(entry.Title ?? entry.QueryWord);
    const duplicateKey = title.toLowerCase();
    if (!title || seen.has(duplicateKey)) return [];
    seen.add(duplicateKey);
    const description = `${normalizeExternalText(entry.Label, 60)} ${normalizeExternalText(entry.LabelDesc, 120)}`.trim();
    const fallbackUrl = `https://so.toutiao.com/search?keyword=${encodeURIComponent(title)}`;

    return [{
      id: `trend-toutiao-${hotTitleSlug(title)}`,
      title,
      source: "toutiao",
      url: allowlistedHttpsUrl(entry.Url, ["toutiao.com"], fallbackUrl),
      heat: normalizedHeat(entry.HotValue, maxHeat),
      growth: growthFromRank(index),
      competition: competitionFromRank(index),
      category: "头条热榜",
      keywords: hotKeywordList(title, description),
      observedAt,
      remainingHalfLifeHours: 24,
      confidence: 76
    } satisfies TrendSignal];
  }).slice(0, limit);
}

export async function fetchToutiaoHotTrends(options?: ToutiaoHotParseOptions): Promise<TrendSignal[]> {
  const response = await fetch(TOUTIAO_HOT_URL, withFetchTimeout({
    headers: {
      Accept: "application/json",
      Referer: "https://www.toutiao.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    cache: "no-store"
  }, 15_000));

  if (!response.ok) throw new Error(`Toutiao hot board request failed: ${response.status}`);
  return parseToutiaoHotResponse(await response.json() as unknown, options);
}
