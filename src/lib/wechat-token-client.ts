import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getWechatTokenCacheFile } from "./paths";
import type { WechatConfig } from "./wechat-config";
import { withFetchTimeout } from "./fetch-timeout";

interface WechatTokenCache {
  accessToken: string;
  expiresAt: number;
}

interface WechatTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

export interface WechatTokenOptions {
  cacheFile?: string;
  fetchImpl?: typeof fetch;
  now?: number;
}

function readTokenCache(cacheFile: string, now: number): string | null {
  if (!existsSync(cacheFile)) {
    return null;
  }

  try {
    const cache = JSON.parse(readFileSync(cacheFile, "utf8").replace(/^\uFEFF/, "")) as Partial<WechatTokenCache>;
    if (cache.accessToken && typeof cache.expiresAt === "number" && cache.expiresAt > now) {
      return cache.accessToken;
    }
  } catch {
    return null;
  }

  return null;
}

function writeTokenCache(cacheFile: string, cache: WechatTokenCache): void {
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

export async function getWechatAccessToken(config: WechatConfig, options?: WechatTokenOptions): Promise<string> {
  const cacheFile = options?.cacheFile ?? getWechatTokenCacheFile();
  const now = options?.now ?? Date.now();
  const cached = readTokenCache(cacheFile, now);
  if (cached) {
    return cached;
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(config.appId)}&secret=${encodeURIComponent(config.appSecret)}`;
  const response = await fetchImpl(url, withFetchTimeout({ method: "GET" }, 30_000));

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`WeChat token HTTP request failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as WechatTokenResponse;
  if (data.errcode || !data.access_token) {
    throw new Error(`WeChat token request failed: ${data.errcode ?? "unknown"} ${data.errmsg ?? "empty access_token"}`);
  }

  const expiresInSeconds = data.expires_in ?? 7200;
  writeTokenCache(cacheFile, {
    accessToken: data.access_token,
    expiresAt: now + Math.max(60, expiresInSeconds - 120) * 1000
  });

  return data.access_token;
}
