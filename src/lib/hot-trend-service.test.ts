import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { TrendSignal } from "./domain";
import { deduplicateTrendSignals, importFetchedHotTrends, type HotTrendSourceAdapter } from "./hot-trend-service";
import { createWorkspaceStore } from "./workspace-store";

const tempDirs: string[] = [];

function tempDataFile() {
  const dir = mkdtempSync(join(tmpdir(), "wechat-hot-trend-service-"));
  tempDirs.push(dir);
  return join(dir, "workspace.json");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("importFetchedHotTrends", () => {
  it("fetches real-source signals, persists them, and reports generated topics", async () => {
    const store = createWorkspaceStore({ dataFile: tempDataFile() });
    const fetchedSignals: TrendSignal[] = [
      {
        id: "trend-baidu-ai-search-product-update",
        title: "AI 搜索产品更新",
        source: "baidu",
        url: "https://www.baidu.com/s?wd=AI%E6%90%9C%E7%B4%A2",
        heat: 100,
        growth: 18,
        competition: 35,
        category: "百度热搜",
        keywords: ["AI", "搜索", "产品", "更新"],
        observedAt: "2026-06-18T04:00:00.000Z"
      }
    ];

    const result = await importFetchedHotTrends(store, async () => fetchedSignals, {
      now: new Date("2026-06-18T04:10:00.000Z")
    });

    expect(result.source).toBe("baidu");
    expect(result.sources).toEqual([{ source: "baidu", status: "ok", fetchedCount: 1 }]);
    expect(result.fetchedCount).toBe(1);
    expect(result.importedCount).toBe(1);
    expect(result.generatedTopicCount).toBe(3);
    expect(result.workspace.trendSignals[0]?.title).toBe("AI 搜索产品更新");
    expect(result.workspace.topics.some((topic) => topic.id === "topic-trend-baidu-ai-search-product-update-chase")).toBe(true);
  });

  it("rejects an empty real-source response", async () => {
    const store = createWorkspaceStore({ dataFile: tempDataFile() });

    await expect(importFetchedHotTrends(store, async () => [])).rejects.toThrow("No hot trends were fetched");
  });

  it("keeps successful sources when another source fails", async () => {
    const store = createWorkspaceStore({ dataFile: tempDataFile() });
    const adapters: HotTrendSourceAdapter[] = [
      {
        source: "weibo",
        fetch: async () => [{
          id: "trend-weibo-safe",
          title: "普通人效率工具更新",
          source: "weibo",
          heat: 90,
          growth: 20,
          competition: 35,
          category: "微博热搜",
          keywords: ["效率", "工具"],
          observedAt: "2026-07-13T10:00:00.000Z"
        }]
      },
      { source: "toutiao", fetch: async () => { throw new Error("HTTP 503"); } }
    ];

    const result = await importFetchedHotTrends(store, adapters, { now: new Date("2026-07-13T10:05:00.000Z") });

    expect(result.source).toBe("weibo");
    expect(result.importedCount).toBe(1);
    expect(result.sources).toEqual([
      { source: "weibo", status: "ok", fetchedCount: 1 },
      { source: "toutiao", status: "failed", fetchedCount: 0, error: "HTTP 503" }
    ]);
  });

  it("deduplicates the same title across sources and raises confidence", () => {
    const signals = deduplicateTrendSignals([
      {
        id: "trend-baidu-shared",
        title: "AI 办公工具更新",
        source: "baidu",
        heat: 90,
        growth: 18,
        competition: 40,
        category: "百度热搜",
        keywords: ["AI", "办公"],
        observedAt: "2026-07-13T10:00:00.000Z",
        confidence: 72
      },
      {
        id: "trend-weibo-shared",
        title: "AI办公工具更新",
        source: "weibo",
        heat: 100,
        growth: 20,
        competition: 32,
        category: "微博热搜",
        keywords: ["AI", "工具"],
        observedAt: "2026-07-13T10:02:00.000Z",
        confidence: 78
      }
    ]);

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ heat: 100, growth: 20, competition: 36, confidence: 86 });
    expect(signals[0].keywords).toEqual(["AI", "办公", "工具"]);
    expect(signals[0].observedAt).toBe("2026-07-13T10:02:00.000Z");
  });

  it("reports every source when all source requests fail", async () => {
    const store = createWorkspaceStore({ dataFile: tempDataFile() });
    const adapters: HotTrendSourceAdapter[] = [
      { source: "baidu", fetch: async () => { throw new Error("timeout"); } },
      { source: "weibo", fetch: async () => { throw new Error("HTTP 403"); } }
    ];

    await expect(importFetchedHotTrends(store, adapters)).rejects.toThrow("baidu: timeout; weibo: HTTP 403");
  });
});
