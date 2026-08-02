import { describe, expect, it, vi } from "vitest";
import {
  buildCpaEnvFile,
  generateCpaDraftMarkdown,
  listCpaModels,
  mergeCpaConfig,
  parseEnvFile
} from "./local-cpa-client";
import { topics } from "./sample-data";

describe("parseEnvFile", () => {
  it("parses simple env content without exposing comments", () => {
    expect(parseEnvFile("CPA_BASE_URL=http://127.0.0.1:8317/v1\nCPA_MODEL=gpt\n# ignored\n")).toEqual({
      CPA_BASE_URL: "http://127.0.0.1:8317/v1",
      CPA_MODEL: "gpt"
    });
  });
});

describe("CPA config helpers", () => {
  it("merges model changes while preserving the existing key", () => {
    expect(
      mergeCpaConfig(
        {
          baseUrl: "http://127.0.0.1:8317/v1",
          apiKey: "secret-key",
          model: "gpt-old"
        },
        {
          model: "gpt-new"
        }
      )
    ).toEqual({
      baseUrl: "http://127.0.0.1:8317/v1",
      apiKey: "secret-key",
      model: "gpt-new"
    });
  });

  it("serializes the provider config as cpa.env content", () => {
    expect(
      buildCpaEnvFile({
        baseUrl: "http://127.0.0.1:8317/v1",
        apiKey: "secret-key",
        model: "gpt-new"
      })
    ).toBe("CPA_BASE_URL=http://127.0.0.1:8317/v1\nCPA_MODEL=gpt-new\nCPA_API_KEY=secret-key\n");
  });

  it("rejects non-loopback CPA endpoints before preserving or sending the key", () => {
    expect(() => mergeCpaConfig(
      {
        baseUrl: "http://127.0.0.1:8317/v1",
        apiKey: "secret-key",
        model: "gpt-old"
      },
      { baseUrl: "https://attacker.example/v1" }
    )).toThrow("CPA baseURL must use http(s) on localhost or a loopback address");
  });
});

describe("generateCpaDraftMarkdown", () => {
  it("uses an OpenAI-compatible chat completion response", async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "# CPA 生成草稿\n\n## 选题角度\n\n真实生成内容"
              }
            }
          ]
        })
      } as Response;
    });

    const markdown = await generateCpaDraftMarkdown(topics[0], {
      baseUrl: "http://127.0.0.1:8317/v1",
      apiKey: "secret",
      model: "gpt-test",
      fetchImpl: fetchMock
    });

    expect(markdown).toContain("# CPA 生成草稿");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8317/v1/chat/completions",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("sends the content brief and only verified facts to the writer", async () => {
    let requestBody = "";
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = String(init?.body ?? "");
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "# 草稿\n\n## 正文\n\n内容" } }] })
      } as Response;
    });
    const topic = {
      ...topics[0],
      factPack: [
        {
          id: "verified",
          claim: "官方章程要求考生核对选考科目",
          sourceName: "示例招生考试院",
          sourceType: "official" as const,
          verificationStatus: "verified" as const,
          sourceUrl: "https://example.gov.cn/rule"
        },
        {
          id: "unverified",
          claim: "未经核验的就业率是百分之九十九",
          sourceName: "匿名帖子",
          sourceType: "editorial_context" as const,
          verificationStatus: "needs_review" as const
        }
      ]
    };

    await generateCpaDraftMarkdown(topic, {
      baseUrl: "http://127.0.0.1:8317/v1",
      apiKey: "secret",
      model: "gpt-test",
      fetchImpl: fetchMock
    });

    const parsed = JSON.parse(requestBody) as { messages: Array<{ content: string }> };
    const prompt = parsed.messages.map((message) => message.content).join("\n");
    expect(prompt).toContain("核心承诺");
    expect(prompt).toContain("官方章程要求考生核对选考科目");
    expect(prompt).toContain("https://example.gov.cn/rule");
    expect(prompt).not.toContain("未经核验的就业率");
    expect(prompt).toContain("在内部比较 3 种提纲");
    expect(prompt).toContain("本篇声音配置");
    expect(prompt).toContain("至少写出一处明确作者判断");
    expect(prompt).toContain("不回顾全文");
  });

  it("passes bounded realtime context without treating a hot-list title as verified fact", async () => {
    let requestBody = "";
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = String(init?.body ?? "");
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "# 草稿\n\n## 正文\n\n内容" } }] })
      } as Response;
    });

    await generateCpaDraftMarkdown(topics[0], {
      baseUrl: "http://127.0.0.1:8317/v1",
      apiKey: "secret",
      model: "gpt-test",
      fetchImpl: fetchMock,
      trendContext: {
        id: "trend-test",
        title: "某个未经核验的热榜说法",
        source: "weibo",
        heat: 90,
        growth: 20,
        competition: 30,
        category: "test",
        keywords: ["test"],
        observedAt: "2026-07-15T08:00:00.000Z"
      }
    });

    const prompt = JSON.parse(requestBody).messages.map((message: { content: string }) => message.content).join("\n");
    expect(prompt).toContain("某个未经核验的热榜说法");
    expect(prompt).toContain("只证明该话题进入采集到的热榜");
  });
});

describe("listCpaModels", () => {
  it("reads model ids from an OpenAI-compatible models response", async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          data: [{ id: "gpt-a" }, { id: "gpt-b" }]
        })
      } as Response;
    });

    await expect(
      listCpaModels({
        baseUrl: "http://127.0.0.1:8317/v1",
        apiKey: "secret",
        model: "gpt-a",
        fetchImpl: fetchMock
      })
    ).resolves.toEqual(["gpt-a", "gpt-b"]);
  });
});
