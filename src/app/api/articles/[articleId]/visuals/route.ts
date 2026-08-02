import { existsSync, readFileSync } from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import {
  approveArticleVisuals,
  generateArticleVisuals,
  type ArticleVisualGenerationScope
} from "@/lib/article-visual-service";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

const scopes = new Set<ArticleVisualGenerationScope>(["all", "cover", "body"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await context.params;
  const assetId = request.nextUrl.searchParams.get("assetId");
  const detail = workspaceStore.getArticleDetail(articleId);
  const asset = detail?.article.visualPlan?.assets.find((item) => item.id === assetId);

  if (!detail || !asset || !["generated", "approved"].includes(asset.status) || !existsSync(asset.localPath)) {
    return NextResponse.json({ error: "Visual asset not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(readFileSync(asset.localPath)), {
    headers: {
      "Content-Type": asset.mimeType ?? "image/png",
      "Cache-Control": "private, no-store"
    }
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "generate" | "approve";
    scope?: ArticleVisualGenerationScope;
  };

  try {
    if (body.action === "generate") {
      const scope = body.scope ?? "all";
      if (!scopes.has(scope)) {
        return NextResponse.json({ error: "Invalid visual generation scope" }, { status: 400 });
      }
      return NextResponse.json(await generateArticleVisuals(articleId, scope));
    }
    if (body.action === "approve") {
      return NextResponse.json(approveArticleVisuals(articleId));
    }
    return NextResponse.json({ error: "Invalid visual action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Visual action failed";
    const status = message.startsWith("Article not found") ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
