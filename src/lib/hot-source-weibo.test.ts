import { describe, expect, it } from "vitest";
import { parseWeiboHotResponse } from "./hot-source-weibo";

const response = {
  ok: 1,
  data: {
    realtime: [
      { note: "AI 手机助手更新", word: "AI 手机助手更新", word_scheme: "#AI手机助手更新#", num: 8_000_000, rank: 0, label_name: "热" },
      { note: "周末家庭收纳清单", word: "周末家庭收纳清单", num: 4_000_000, rank: 1 },
      { note: "AI 手机助手更新", num: 3_000_000, rank: 2 },
      { note: "广告内容", num: 9_000_000, rank: 3, is_ad: 1 },
      { note: "  ", num: 2_000_000, rank: 4 }
    ]
  }
};

describe("parseWeiboHotResponse", () => {
  it("converts structured Weibo hot-search entries into normalized trend signals", () => {
    const signals = parseWeiboHotResponse(response, {
      now: new Date("2026-07-13T10:00:00.000Z"),
      limit: 20
    });

    expect(signals).toHaveLength(2);
    expect(signals[0]).toMatchObject({
      title: "AI 手机助手更新",
      source: "weibo",
      heat: 100,
      growth: 20,
      competition: 32,
      category: "微博热搜",
      observedAt: "2026-07-13T10:00:00.000Z",
      confidence: 78
    });
    expect(signals[0].url).toContain("s.weibo.com/weibo?q=");
    expect(signals[1].heat).toBe(50);
  });

  it("strips markup and control characters and honors the limit", () => {
    const signals = parseWeiboHotResponse({
      data: { realtime: [{ note: "<b>普通人\u0000效率工具</b>", num: 10 }] }
    }, { limit: 1, now: new Date("2026-07-13T10:00:00.000Z") });

    expect(signals).toHaveLength(1);
    expect(signals[0].title).toBe("普通人 效率工具");
  });

  it("returns an empty list for an unexpected response shape", () => {
    expect(parseWeiboHotResponse({ data: { realtime: "invalid" } })).toEqual([]);
  });
});
