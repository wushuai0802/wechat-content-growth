import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { importTrendSignals } from "./trend-import-service";
import { createWorkspaceStore } from "./workspace-store";

const tempDirs: string[] = [];

function tempDataFile() {
  const dir = mkdtempSync(join(tmpdir(), "wechat-content-growth-import-"));
  tempDirs.push(dir);
  return join(dir, "workspace.json");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("importTrendSignals", () => {
  it("rejects empty import content", () => {
    const store = createWorkspaceStore({ dataFile: tempDataFile() });

    expect(() => importTrendSignals(store, "   ")).toThrow("Import content is required");
  });

  it("imports real trend content and reports generated topics", () => {
    const store = createWorkspaceStore({ dataFile: tempDataFile() });
    const before = store.getWorkspace().topics.length;

    const result = importTrendSignals(
      store,
      [
        "title,source,heat,growth,competition,category,keywords,url",
        "WeChat AI writing workflow,manual,84,19,41,AI,WeChat|AI writing|workflow,https://example.com/hot"
      ].join("\n"),
      { now: new Date("2026-06-18T10:00:00.000Z") }
    );

    expect(result.importedCount).toBe(1);
    expect(result.generatedTopicCount).toBe(result.workspace.topics.length - before);
    expect(result.workspace.trendSignals[0]).toMatchObject({
      title: "WeChat AI writing workflow",
      source: "manual",
      heat: 84,
      growth: 19,
      competition: 41,
      category: "AI",
      keywords: ["WeChat", "AI writing", "workflow"]
    });
    expect(result.workspace.topics.some((topic) => topic.id.startsWith("topic-trend-wechat-ai-writing-workflow-"))).toBe(true);
  });
});
