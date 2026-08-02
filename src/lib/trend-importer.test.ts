import { describe, expect, it } from "vitest";
import { parseTrendImport } from "./trend-importer";

describe("parseTrendImport", () => {
  it("accepts WeChat public article hot-topic signals as an external source", () => {
    const signals = parseTrendImport(JSON.stringify([{
      title: "普通人开始用 AI 做副业复盘",
      source: "wechat_public",
      heat: 88,
      growth: 22,
      competition: 45,
      category: "公众号热门文章",
      keywords: ["AI", "副业", "普通人", "复盘"],
      url: "https://mp.weixin.qq.com/s/example"
    }]));

    expect(signals[0]).toMatchObject({
      source: "wechat_public",
      category: "公众号热门文章",
      title: "普通人开始用 AI 做副业复盘"
    });
  });

  it("parses JSON trend arrays", () => {
    const signals = parseTrendImport(
      JSON.stringify([
        {
          title: "AI 搜索产品更新",
          source: "manual",
          heat: 82,
          growth: 18,
          competition: 44,
          category: "人工智能",
          keywords: ["AI 搜索", "效率工具"],
          url: "https://example.com/a"
        }
      ])
    );

    expect(signals[0]).toMatchObject({
      title: "AI 搜索产品更新",
      source: "manual",
      heat: 82,
      growth: 18,
      competition: 44,
      category: "人工智能",
      keywords: ["AI 搜索", "效率工具"]
    });
    expect(signals[0].id).toMatch(/^trend-ai-[a-z0-9]+$/);
    expect(signals[0].observedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("parses CSV trend rows", () => {
    const signals = parseTrendImport([
      "title,source,heat,growth,competition,category,keywords,url",
      "AI 写作工具价格变化,manual,76,12,38,人工智能,AI写作|价格|效率,https://example.com/b"
    ].join("\n"));

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      title: "AI 写作工具价格变化",
      source: "manual",
      heat: 76,
      growth: 12,
      competition: 38,
      category: "人工智能",
      keywords: ["AI写作", "价格", "效率"]
    });
    expect(signals[0].id).toMatch(/^trend-ai-[a-z0-9]+$/);
  });

  it("parses enriched opportunity and evidence fields", () => {
    const [signal] = parseTrendImport(JSON.stringify([{
      title: "AI 办公工具集中更新",
      source: "wechat_public",
      heat: 84,
      growth: 28,
      competition: 36,
      category: "效率工具",
      keywords: ["AI", "办公", "工具"],
      growthRate: 76,
      remainingHalfLifeHours: 96,
      audienceOverlap: 88,
      contentSupplyGap: 72,
      monetizationIntent: 91,
      sharePotential: 68,
      productionLatencyHours: 4,
      policyRisk: 7,
      confidence: 85,
      evidenceReadiness: "ready",
      evidenceNotes: ["已保存 5 篇样本", "价格信息已核对"]
    }]));

    expect(signal).toMatchObject({
      growthRate: 76,
      remainingHalfLifeHours: 96,
      audienceOverlap: 88,
      contentSupplyGap: 72,
      monetizationIntent: 91,
      sharePotential: 68,
      productionLatencyHours: 4,
      policyRisk: 7,
      confidence: 85,
      evidenceReadiness: "ready",
      evidenceNotes: ["已保存 5 篇样本", "价格信息已核对"]
    });
  });

  it("rejects rows without required title", () => {
    expect(() => parseTrendImport("source,heat,growth,competition,category\nmanual,80,10,30,AI")).toThrow(
      "第 1 行缺少 title"
    );
  });
});
