import { NextResponse } from "next/server";
import { generateWechatToken } from "@/lib/wechat-config";

export const dynamic = "force-dynamic";

export function POST() {
  return NextResponse.json({ token: generateWechatToken() });
}
