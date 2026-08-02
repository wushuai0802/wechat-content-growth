import { NextResponse, type NextRequest } from "next/server";
import type { ArticleAction } from "@/lib/workflow";
import { createWechatDraftFromArticle } from "@/lib/wechat-draft-service";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

const articleActions: ArticleAction[] = ["approve", "create_wechat_draft", "publish", "archive"];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ articleId: string }> }
) {
  const body = (await request.json()) as { action?: ArticleAction };
  const { articleId } = await context.params;

  if (!body.action || !articleActions.includes(body.action)) {
    return NextResponse.json({ error: "Invalid article action" }, { status: 400 });
  }

  if (body.action === "create_wechat_draft") {
    try {
      const result = await createWechatDraftFromArticle(articleId);
      return NextResponse.json(result.workspace, { headers: { "x-wechat-draft-id": result.draftId } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create WeChat draft";
      const status = message.includes("not configured") ? 503 : 502;
      return NextResponse.json({ error: message }, { status });
    }
  }

  try {
    return NextResponse.json(workspaceStore.applyArticleAction(articleId, body.action));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Article action failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
