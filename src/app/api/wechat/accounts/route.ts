import { NextResponse } from "next/server";
import {
  getLocalWechatConfig,
  getLocalWechatServerConfig,
  getWechatCallbackUrl,
  maskAppId,
  updateLocalWechatConfig
} from "@/lib/wechat-config";

export const dynamic = "force-dynamic";

function toSafeWechatConfig(config: ReturnType<typeof getLocalWechatConfig>) {
  const serverConfig = getLocalWechatServerConfig();
  return {
    configured: Boolean(config),
    appIdMasked: config ? maskAppId(config.appId) : "",
    appSecretConfigured: Boolean(config?.appSecret),
    tokenConfigured: Boolean(config?.token ?? serverConfig?.token),
    encodingAesKeyConfigured: Boolean(config?.encodingAesKey),
    callbackUrl: getWechatCallbackUrl(config ?? serverConfig),
    publishMode: config?.publishMode ?? "draft_only"
  };
}

export async function GET() {
  return NextResponse.json(toSafeWechatConfig(getLocalWechatConfig()));
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    appId?: string;
    appSecret?: string;
    token?: string;
    encodingAesKey?: string;
    callbackUrl?: string;
    publishMode?: "draft_only" | "manual_review" | "auto_publish";
    clearEncodingAesKey?: boolean;
  };

  try {
    const updated = updateLocalWechatConfig(body);
    return NextResponse.json(toSafeWechatConfig(updated));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save WeChat config" },
      { status: 400 }
    );
  }
}
