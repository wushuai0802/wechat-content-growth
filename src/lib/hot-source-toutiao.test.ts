import { describe, expect, it } from "vitest";
import { parseToutiaoHotResponse } from "./hot-source-toutiao";

const response = {
  data: [
    {
      Title: "暑期出行省钱攻略",
      QueryWord: "暑期出行",
      HotValue: "9000000",
      Url: "https://www.toutiao.com/trending/123456/",
      Label: "热",
      LabelDesc: "出行消费"
    },
    {
      Title: "新款消费电子怎么选",
      HotValue: "4500000",
      Url: "https://evil.example/redirect"
    },
    { Title: "暑期出行省钱攻略", HotValue: "3000000" },
    { Title: "", HotValue: "2000000" }
  ]
};

describe("parseToutiaoHotResponse", () => {
  it("converts Toutiao hot-board entries and keeps only allowlisted links", () => {
    const signals = parseToutiaoHotResponse(response, {
      now: new Date("2026-07-13T10:00:00.000Z"),
      limit: 20
    });

    expect(signals).toHaveLength(2);
    expect(signals[0]).toMatchObject({
      title: "暑期出行省钱攻略",
      source: "toutiao",
      url: "https://www.toutiao.com/trending/123456/",
      heat: 100,
      growth: 20,
      competition: 32,
      category: "头条热榜",
      observedAt: "2026-07-13T10:00:00.000Z",
      confidence: 76
    });
    expect(signals[1].heat).toBe(50);
    expect(signals[1].url).toContain("https://so.toutiao.com/search?keyword=");
  });

  it("honors the limit and rejects malformed response data", () => {
    expect(parseToutiaoHotResponse(response, { limit: 1 })).toHaveLength(1);
    expect(parseToutiaoHotResponse({ data: {} })).toEqual([]);
  });
});
