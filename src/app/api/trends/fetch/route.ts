import { NextResponse } from "next/server";
import { importFetchedHotTrends } from "@/lib/hot-trend-service";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await importFetchedHotTrends(workspaceStore);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch hot trends" },
      { status: 502 }
    );
  }
}
