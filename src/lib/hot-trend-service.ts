import type { TrendSignal } from "./domain";
import { fetchBaiduHotTrends } from "./hot-source-baidu";
import { fetchToutiaoHotTrends } from "./hot-source-toutiao";
import { normalizeExternalText } from "./hot-source-utils";
import { fetchWeiboHotTrends } from "./hot-source-weibo";
import type { WorkspaceData, WorkspaceStore } from "./workspace-store";

export type RealtimeTrendSource = "baidu" | "weibo" | "toutiao";

export interface HotTrendSourceStatus {
  source: RealtimeTrendSource;
  status: "ok" | "empty" | "failed";
  fetchedCount: number;
  error?: string;
}

export interface HotTrendFetchResult {
  workspace: WorkspaceData;
  source: string;
  sources: HotTrendSourceStatus[];
  fetchedCount: number;
  importedCount: number;
  generatedTopicCount: number;
}

export type HotTrendFetcher = () => Promise<TrendSignal[]>;
export interface HotTrendSourceAdapter {
  source: RealtimeTrendSource;
  fetch: HotTrendFetcher;
}

const DEFAULT_SOURCE_ADAPTERS: HotTrendSourceAdapter[] = [
  { source: "baidu", fetch: () => fetchBaiduHotTrends({ limit: 20 }) },
  { source: "weibo", fetch: () => fetchWeiboHotTrends({ limit: 20 }) },
  { source: "toutiao", fetch: () => fetchToutiaoHotTrends({ limit: 20 }) }
];

function sourceAdapters(input?: HotTrendFetcher | HotTrendSourceAdapter[]): HotTrendSourceAdapter[] {
  if (!input) return DEFAULT_SOURCE_ADAPTERS;
  if (typeof input === "function") return [{ source: "baidu", fetch: input }];
  return input;
}

function signalKey(signal: TrendSignal): string {
  return normalizeExternalText(signal.title)
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function deduplicateTrendSignals(signals: TrendSignal[]): TrendSignal[] {
  const merged = new Map<string, TrendSignal>();
  for (const signal of signals) {
    const key = signalKey(signal);
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...signal, keywords: [...signal.keywords] });
      continue;
    }

    const crossSource = existing.source !== signal.source;
    const baseConfidence = Math.max(existing.confidence ?? 0, signal.confidence ?? 0);
    merged.set(key, {
      ...existing,
      heat: Math.max(existing.heat, signal.heat),
      growth: Math.max(existing.growth, signal.growth),
      competition: Math.round((existing.competition + signal.competition) / 2),
      confidence: baseConfidence > 0 ? Math.min(95, baseConfidence + (crossSource ? 8 : 0)) : undefined,
      keywords: Array.from(new Set([...existing.keywords, ...signal.keywords])).slice(0, 8),
      observedAt: existing.observedAt > signal.observedAt ? existing.observedAt : signal.observedAt
    });
  }
  return [...merged.values()];
}

export async function importFetchedHotTrends(
  store: WorkspaceStore,
  fetchers?: HotTrendFetcher | HotTrendSourceAdapter[],
  options?: { now?: Date }
): Promise<HotTrendFetchResult> {
  const adapters = sourceAdapters(fetchers);
  const settled = await Promise.allSettled(adapters.map((adapter) => adapter.fetch()));
  const statuses: HotTrendSourceStatus[] = settled.map((result, index) => {
    const source = adapters[index].source;
    if (result.status === "rejected") {
      return {
        source,
        status: "failed",
        fetchedCount: 0,
        error: normalizeExternalText(result.reason instanceof Error ? result.reason.message : "Unknown source error", 180)
      };
    }
    return {
      source,
      status: result.value.length > 0 ? "ok" : "empty",
      fetchedCount: result.value.length
    };
  });
  const fetchedSignals = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const signals = deduplicateTrendSignals(fetchedSignals);
  if (signals.length === 0) {
    const failureSummary = statuses
      .filter((status) => status.status === "failed")
      .map((status) => `${status.source}: ${status.error}`)
      .join("; ");
    throw new Error(failureSummary ? `No hot trends were fetched (${failureSummary})` : "No hot trends were fetched");
  }

  const beforeTopicCount = store.getWorkspace().topics.length;
  const workspace = store.refreshTrendSignals(signals, { now: options?.now });
  const successfulSources = statuses.filter((status) => status.status === "ok").map((status) => status.source);

  return {
    workspace,
    source: successfulSources.join(" + "),
    sources: statuses,
    fetchedCount: fetchedSignals.length,
    importedCount: signals.length,
    generatedTopicCount: Math.max(0, workspace.topics.length - beforeTopicCount)
  };
}
