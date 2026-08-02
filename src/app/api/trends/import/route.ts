import { NextResponse } from "next/server";
import { importTrendSignals } from "@/lib/trend-import-service";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

interface ImportTrendRequestBody {
  content?: unknown;
}

export async function POST(request: Request) {
  let body: ImportTrendRequestBody;
  try {
    body = (await request.json()) as ImportTrendRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content must be a string" }, { status: 400 });
  }

  try {
    const result = importTrendSignals(workspaceStore, body.content);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import trend signals" },
      { status: 400 }
    );
  }
}
