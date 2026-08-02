import { NextResponse, type NextRequest } from "next/server";
import { buildCpaManifest } from "@/lib/cpa-manifest";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const url = new URL(request.url);
  return NextResponse.json(buildCpaManifest(url.origin));
}
