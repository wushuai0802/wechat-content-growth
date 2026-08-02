import { describe, expect, it } from "vitest";
import { parseBaiduHotPage } from "./hot-source-baidu";

const baiduSnippet = String.raw`{"appUrl":"https://www.baidu.com/s?wd=AI%E6%90%9C%E7%B4%A2&sa=fyb_news&rsv_dl=fyb_news","desc":"AI 搜索产品更新带来新的信息获取方式。","hotChange":"rise","hotScore":"7904684","hotTag":"0","index":0,"query":"AI 搜索产品更新","rawUrl":"https://www.baidu.com/s?wd=AI%E6%90%9C%E7%B4%A2","word":"AI 搜索产品更新"},{"appUrl":"https://www.baidu.com/s?wd=%E5%9B%BD%E5%86%85%E6%B2%B9%E4%BB%B7","desc":"新一轮成品油零售调价窗口将开启。","hotChange":"same","hotScore":"7713450","hotTag":"1","index":1,"query":"国内油价将调整","rawUrl":"https://www.baidu.com/s?wd=%E5%9B%BD%E5%86%85%E6%B2%B9%E4%BB%B7","word":"国内油价将调整"}`;

describe("parseBaiduHotPage", () => {
  it("extracts Baidu hot board items into trend signals", () => {
    const signals = parseBaiduHotPage(baiduSnippet, { now: new Date("2026-06-18T04:00:00.000Z"), limit: 2 });

    expect(signals).toHaveLength(2);
    expect(signals[0]).toMatchObject({
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
    });
    expect(signals[1]).toMatchObject({
      id: "trend-baidu-domestic-oil-price-adjustment",
      title: "国内油价将调整",
      heat: 98,
      growth: 6,
      competition: 40
    });
  });

  it("deduplicates repeated words", () => {
    const html = `${baiduSnippet},${baiduSnippet}`;
    const signals = parseBaiduHotPage(html, { now: new Date("2026-06-18T04:00:00.000Z"), limit: 10 });

    expect(signals.map((signal) => signal.title)).toEqual(["AI 搜索产品更新", "国内油价将调整"]);
  });
});
