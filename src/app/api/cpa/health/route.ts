import { NextResponse } from "next/server";
import { buildCpaHealth } from "@/lib/cpa-manifest";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(buildCpaHealth());
}
