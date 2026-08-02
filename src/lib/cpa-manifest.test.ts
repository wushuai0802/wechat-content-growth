import { describe, expect, it } from "vitest";
import { buildCpaManifest, buildCpaHealth } from "./cpa-manifest";
import { deliverablesRoot, getRuntimeDataDir } from "./paths";

describe("buildCpaManifest", () => {
  it("describes local integration actions for external controllers", () => {
    const manifest = buildCpaManifest("http://127.0.0.1:3000");

    expect(manifest.name).toBe("wechat-content-growth");
    expect(manifest.baseUrl).toBe("http://127.0.0.1:3000");
    expect(manifest.actions.map((action) => action.id)).toEqual([
      "workspace.get",
      "workspace.reset",
      "topic.generateDraft",
      "article.applyAction",
      "suggestion.applyAction",
      "report.generateWeekly"
    ]);
  });
});

describe("buildCpaHealth", () => {
  it("reports service health and storage targets", () => {
    const health = buildCpaHealth();

    expect(health.ok).toBe(true);
    expect(health.storage.runtimeData).toBe(getRuntimeDataDir());
    expect(health.storage.deliverables).toBe(deliverablesRoot);
  });
});
