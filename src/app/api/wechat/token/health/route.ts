import { NextResponse } from "next/server";
import { getLocalWechatConfig, maskAppId } from "@/lib/wechat-config";
import { getWechatAccessToken } from "@/lib/wechat-token-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getLocalWechatConfig();
  if (!config) {
    return NextResponse.json({ ok: false, error: "WeChat config missing" }, { status: 503 });
  }

  try {
    const token = await getWechatAccessToken(config);
    return NextResponse.json({
      ok: true,
      appIdMasked: maskAppId(config.appId),
      accessTokenPreview: `${token.slice(0, 6)}...${token.slice(-4)}`
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "WeChat token check failed" },
      { status: 502 }
    );
  }
}
