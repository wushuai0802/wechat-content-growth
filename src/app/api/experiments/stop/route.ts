import { NextResponse } from "next/server";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

export async function POST() {
  workspaceStore.stopAutoLoop();
  return NextResponse.json(workspaceStore.getExperimentSummary());
}
