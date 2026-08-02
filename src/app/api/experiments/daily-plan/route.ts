import { NextResponse } from "next/server";
import { decideDailyArticleLimit } from "@/lib/daily-run-planner";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(decideDailyArticleLimit({ workspace: workspaceStore.getWorkspace() }));
}
