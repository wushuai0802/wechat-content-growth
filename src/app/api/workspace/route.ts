import { NextResponse } from "next/server";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(workspaceStore.getWorkspace());
}
