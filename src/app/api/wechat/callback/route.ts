import { NextResponse } from "next/server";
import { getLocalWechatServerConfig, verifyWechatServerSignature } from "@/lib/wechat-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getLocalWechatServerConfig();
  if (!config) {
    return NextResponse.json({ error: "WeChat server token missing" }, { status: 503 });
  }

  const url = new URL(request.url);
  const signature = url.searchParams.get("signature") ?? "";
  const timestamp = url.searchParams.get("timestamp") ?? "";
  const nonce = url.searchParams.get("nonce") ?? "";
  const echostr = url.searchParams.get("echostr") ?? "";

  const valid = verifyWechatServerSignature({
    token: config.token,
    timestamp,
    nonce,
    signature
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid WeChat signature" }, { status: 403 });
  }

  return new Response(echostr, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

export async function POST() {
  return NextResponse.json({ ok: true, message: "WeChat callback endpoint is ready" });
}
