import { NextResponse } from "next/server";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await context.params;
  const detail = workspaceStore.getArticleDetail(articleId);

  if (!detail) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await context.params;
  const patch = (await request.json()) as {
    title?: string;
    summary?: string;
    markdown?: string;
  };
  const detail = workspaceStore.updateArticleDetail(articleId, patch);

  if (!detail) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
