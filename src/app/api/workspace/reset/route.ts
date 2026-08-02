import { NextResponse } from "next/server";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

export function POST() {
  return NextResponse.json(workspaceStore.resetWorkspace());
}
