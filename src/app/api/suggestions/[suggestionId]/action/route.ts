import { NextResponse, type NextRequest } from "next/server";
import type { SuggestionAction } from "@/lib/workflow";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

const suggestionActions: SuggestionAction[] = ["accept", "dismiss"];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ suggestionId: string }> }
) {
  const body = (await request.json()) as { action?: SuggestionAction };
  const { suggestionId } = await context.params;

  if (!body.action || !suggestionActions.includes(body.action)) {
    return NextResponse.json({ error: "Invalid suggestion action" }, { status: 400 });
  }

  return NextResponse.json(workspaceStore.applySuggestionAction(suggestionId, body.action));
}
