import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getWechatAccessToken } from "./wechat-token-client";

const tempDirs: string[] = [];

function tempCacheFile() {
  const dir = mkdtempSync(join(tmpdir(), "wechat-token-cache-"));
  tempDirs.push(dir);
  return join(dir, "nested", "token.json");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("getWechatAccessToken", () => {
  it("returns a valid cached token without calling WeChat", async () => {
    const cacheFile = tempCacheFile();
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify({ accessToken: "cached-token", expiresAt: Date.now() + 600_000 }), "utf8");
    const fetchMock = vi.fn();

    await expect(
      getWechatAccessToken(
        { appId: "wx123", appSecret: "secret", token: "token", publishMode: "draft_only" },
        { cacheFile, fetchImpl: fetchMock as unknown as typeof fetch }
      )
    ).resolves.toBe("cached-token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches and caches a new token when cache is missing", async () => {
    const cacheFile = tempCacheFile();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: "fresh-token", expires_in: 7200 })
    })) as unknown as typeof fetch;

    await expect(
      getWechatAccessToken(
        { appId: "wx123", appSecret: "secret", token: "token", publishMode: "draft_only" },
        { cacheFile, fetchImpl: fetchMock, now: 1_000 }
      )
    ).resolves.toBe("fresh-token");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=wx123&secret=secret",
      expect.objectContaining({ method: "GET" })
    );
    expect(JSON.parse(readFileSync(cacheFile, "utf8"))).toMatchObject({
      accessToken: "fresh-token",
      expiresAt: 1_000 + 7_080_000
    });
  });

  it("surfaces WeChat API errors", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ errcode: 40013, errmsg: "invalid appid" })
    })) as unknown as typeof fetch;

    await expect(
      getWechatAccessToken(
        { appId: "bad", appSecret: "secret", token: "token", publishMode: "draft_only" },
        { cacheFile: tempCacheFile(), fetchImpl: fetchMock }
      )
    ).rejects.toThrow("WeChat token request failed: 40013 invalid appid");
  });
});
