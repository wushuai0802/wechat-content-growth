import { NextResponse, type NextRequest } from "next/server";
import { isAllowedLocalRequest } from "@/lib/local-request-guard";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/wechat/callback") {
    return NextResponse.next();
  }

  if (!isAllowedLocalRequest({
    requestHostname: request.nextUrl.hostname,
    hostHeader: request.headers.get("host"),
    originHeader: request.headers.get("origin")
  })) {
    return NextResponse.json({ error: "Local API access only" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"]
};
