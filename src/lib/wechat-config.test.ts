import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildWechatEnvFile,
  generateWechatToken,
  getLocalWechatConfig,
  getLocalWechatServerConfig,
  getWechatCallbackUrl,
  maskAppId,
  mergeWechatConfig,
  verifyWechatServerSignature
} from "./wechat-config";

const tempDirs: string[] = [];

function useTempWechatConfigFile() {
  const dir = mkdtempSync(join(tmpdir(), "wechat-config-test-"));
  tempDirs.push(dir);
  const configFile = join(dir, "wechat.env");
  process.env.WCG_WECHAT_CONFIG_FILE = configFile;
  delete process.env.WECHAT_APP_ID;
  delete process.env.WECHAT_APP_SECRET;
  delete process.env.WECHAT_TOKEN;
  delete process.env.WECHAT_CALLBACK_URL;
  delete process.env.WECHAT_ENCODING_AES_KEY;
  delete process.env.WECHAT_PUBLISH_MODE;
  return configFile;
}

afterEach(() => {
  delete process.env.WCG_WECHAT_CONFIG_FILE;
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("wechat config helpers", () => {
  it("merges config patches and masks app id", () => {
    const config = mergeWechatConfig(null, {
      appId: "wx1234567890abcdef",
      appSecret: "secret-value",
      token: "token-value",
      encodingAesKey: "aes-key",
      callbackUrl: "https://example.com/api/wechat/callback",
      publishMode: "draft_only"
    });

    expect(config).toEqual({
      appId: "wx1234567890abcdef",
      appSecret: "secret-value",
      token: "token-value",
      encodingAesKey: "aes-key",
      callbackUrl: "https://example.com/api/wechat/callback",
      publishMode: "draft_only"
    });
    expect(maskAppId(config.appId)).toBe("wx12********cdef");
  });

  it("serializes config without comments", () => {
    expect(
      buildWechatEnvFile({
        appId: "wx1234567890abcdef",
        appSecret: "secret-value",
        token: "token-value",
        encodingAesKey: "aes-key",
        callbackUrl: "https://example.com/api/wechat/callback",
        publishMode: "draft_only"
      })
    ).toContain("WECHAT_APP_ID=wx1234567890abcdef\n");
  });

  it("preserves configured secrets when the settings form submits blank fields", () => {
    const current = {
      appId: "wx1234567890abcdef",
      appSecret: "secret-value",
      token: "token-value",
      encodingAesKey: "aes-key",
      callbackUrl: "https://example.com/api/wechat/callback",
      publishMode: "draft_only" as const
    };

    expect(mergeWechatConfig(current, {
      appId: "",
      appSecret: "",
      token: "",
      encodingAesKey: "",
      publishMode: "manual_review"
    })).toEqual({ ...current, publishMode: "manual_review" });
  });

  it("only clears the AES key through an explicit flag", () => {
    const current = mergeWechatConfig(null, {
      appId: "wx1234567890abcdef",
      appSecret: "secret-value",
      token: "token-value",
      encodingAesKey: "aes-key"
    });

    expect(mergeWechatConfig(current, { clearEncodingAesKey: true }).encodingAesKey).toBeUndefined();
  });

  it("builds a local callback URL fallback", () => {
    expect(getWechatCallbackUrl(null)).toBe("http://127.0.0.1:3000/api/wechat/callback");
  });

  it("generates a server token suitable for WeChat callback verification", () => {
    expect(generateWechatToken()).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("reads server callback config before App credentials are configured", () => {
    const configFile = useTempWechatConfigFile();
    writeFileSync(
      configFile,
      "WECHAT_TOKEN=server-token\nWECHAT_CALLBACK_URL=https://example.com/api/wechat/callback\n",
      "utf8"
    );

    expect(getLocalWechatConfig()).toBeNull();
    expect(getLocalWechatServerConfig()).toEqual({
      token: "server-token",
      callbackUrl: "https://example.com/api/wechat/callback"
    });
  });

  it("verifies WeChat server callback signatures", () => {
    const token = "test-token";
    const timestamp = "1718697600";
    const nonce = "nonce-value";
    const signature = "c2c9267688645c56a3d7586858f2f55e0f35e07c";

    expect(verifyWechatServerSignature({ token, timestamp, nonce, signature })).toBe(true);
    expect(verifyWechatServerSignature({ token, timestamp, nonce, signature: "bad" })).toBe(false);
  });
});
