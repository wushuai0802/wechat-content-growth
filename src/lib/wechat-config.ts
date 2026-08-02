import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getWechatConfigFile } from "./paths";
import { parseEnvFile } from "./local-cpa-client";

export type WechatPublishMode = "draft_only" | "manual_review" | "auto_publish";

export interface WechatConfig {
  appId: string;
  appSecret: string;
  token: string;
  encodingAesKey?: string;
  callbackUrl?: string;
  publishMode: WechatPublishMode;
}

export interface WechatServerConfig {
  token: string;
  callbackUrl?: string;
}

export interface WechatConfigPatch {
  appId?: string;
  appSecret?: string;
  token?: string;
  encodingAesKey?: string;
  callbackUrl?: string;
  publishMode?: WechatPublishMode;
  clearEncodingAesKey?: boolean;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (trimmed && /[\r\n]/.test(trimmed)) {
    throw new Error("WeChat config values must not contain line breaks");
  }
  return trimmed ? trimmed : undefined;
}

function requireValue(value: string | undefined, label: string): string {
  const cleaned = clean(value);
  if (!cleaned) {
    throw new Error(`${label} is required`);
  }
  return cleaned;
}

function normalizePublishMode(value: string | undefined): WechatPublishMode {
  if (value === "manual_review" || value === "auto_publish" || value === "draft_only") {
    return value;
  }
  return "draft_only";
}

export function maskAppId(appId: string): string {
  if (appId.length <= 8) {
    return `${appId.slice(0, 2)}****`;
  }
  return `${appId.slice(0, 4)}********${appId.slice(-4)}`;
}

export function generateWechatToken(): string {
  return randomBytes(24).toString("base64url");
}

export function mergeWechatConfig(current: WechatConfig | null, patch: WechatConfigPatch): WechatConfig {
  return {
    appId: requireValue(clean(patch.appId) ?? current?.appId, "WECHAT_APP_ID"),
    appSecret: requireValue(clean(patch.appSecret) ?? current?.appSecret, "WECHAT_APP_SECRET"),
    token: requireValue(clean(patch.token) ?? current?.token, "WECHAT_TOKEN"),
    encodingAesKey: patch.clearEncodingAesKey ? undefined : clean(patch.encodingAesKey) ?? current?.encodingAesKey,
    callbackUrl: clean(patch.callbackUrl ?? current?.callbackUrl),
    publishMode: normalizePublishMode(patch.publishMode ?? current?.publishMode)
  };
}

export function buildWechatEnvFile(config: WechatConfig): string {
  return [
    `WECHAT_APP_ID=${config.appId}`,
    `WECHAT_APP_SECRET=${config.appSecret}`,
    `WECHAT_TOKEN=${config.token}`,
    `WECHAT_ENCODING_AES_KEY=${config.encodingAesKey ?? ""}`,
    `WECHAT_CALLBACK_URL=${config.callbackUrl ?? ""}`,
    `WECHAT_PUBLISH_MODE=${config.publishMode}`,
    ""
  ].join("\n");
}

export function getLocalWechatConfig(): WechatConfig | null {
  const envFromFile = existsSync(getWechatConfigFile())
    ? parseEnvFile(readFileSync(getWechatConfigFile(), "utf8"))
    : {};

  const appId = process.env.WECHAT_APP_ID ?? envFromFile.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET ?? envFromFile.WECHAT_APP_SECRET;
  const token = process.env.WECHAT_TOKEN ?? envFromFile.WECHAT_TOKEN;

  if (!appId || !appSecret || !token) {
    return null;
  }

  return {
    appId,
    appSecret,
    token,
    encodingAesKey: clean(process.env.WECHAT_ENCODING_AES_KEY ?? envFromFile.WECHAT_ENCODING_AES_KEY),
    callbackUrl: clean(process.env.WECHAT_CALLBACK_URL ?? envFromFile.WECHAT_CALLBACK_URL),
    publishMode: normalizePublishMode(process.env.WECHAT_PUBLISH_MODE ?? envFromFile.WECHAT_PUBLISH_MODE)
  };
}

export function getLocalWechatServerConfig(): WechatServerConfig | null {
  const envFromFile = existsSync(getWechatConfigFile())
    ? parseEnvFile(readFileSync(getWechatConfigFile(), "utf8"))
    : {};
  const token = clean(process.env.WECHAT_TOKEN ?? envFromFile.WECHAT_TOKEN);
  if (!token) {
    return null;
  }

  return {
    token,
    callbackUrl: clean(process.env.WECHAT_CALLBACK_URL ?? envFromFile.WECHAT_CALLBACK_URL)
  };
}

export function updateLocalWechatConfig(patch: WechatConfigPatch): WechatConfig {
  const updated = mergeWechatConfig(getLocalWechatConfig(), patch);
  const configFile = getWechatConfigFile();
  mkdirSync(dirname(configFile), { recursive: true });
  writeFileSync(configFile, buildWechatEnvFile(updated), "utf8");
  return updated;
}

export function getWechatCallbackUrl(config: Pick<WechatConfig, "callbackUrl"> | null): string {
  return config?.callbackUrl ?? "http://127.0.0.1:3000/api/wechat/callback";
}

export function verifyWechatServerSignature(input: {
  token: string;
  timestamp: string;
  nonce: string;
  signature: string;
}): boolean {
  const expected = createHash("sha1")
    .update([input.token, input.timestamp, input.nonce].sort().join(""))
    .digest("hex");
  return expected === input.signature;
}
