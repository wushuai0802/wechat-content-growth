import { describe, expect, it } from "vitest";
import { extractAutoLoopConfigPatch, shouldAutoDecideDailyArticleLimit } from "./run-request";

describe("run request helpers", () => {
  it("auto-decides article count when dailyArticleLimit is omitted", () => {
    expect(shouldAutoDecideDailyArticleLimit({ enabled: true })).toBe(true);
  });

  it("keeps explicit article count unless auto decision is requested", () => {
    expect(shouldAutoDecideDailyArticleLimit({ dailyArticleLimit: 2 })).toBe(false);
    expect(shouldAutoDecideDailyArticleLimit({ dailyArticleLimit: 2, autoDecideDailyArticleLimit: true })).toBe(true);
  });

  it("extracts only persisted auto-loop config fields", () => {
    expect(extractAutoLoopConfigPatch({
      enabled: true,
      autoPublishEnabled: false,
      dailyArticleLimit: 4,
      autoDecideDailyArticleLimit: true
    })).toEqual({
      enabled: true,
      autoPublishEnabled: false,
      dailyArticleLimit: 4
    });
  });
});
