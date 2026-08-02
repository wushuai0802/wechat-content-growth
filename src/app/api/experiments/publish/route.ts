import { NextResponse, type NextRequest } from "next/server";
import { publishExperimentArticle } from "@/lib/experiment-publisher";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

type PublishRequestBody = {
  articleId?: string;
  draftId?: string;
};

function latestWechatDraftArticleId(): string | undefined {
  const workspace = workspaceStore.getWorkspace();
  return [...workspace.articles]
    .filter((article) => article.status === "wechat_draft")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.id;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as PublishRequestBody;
    const articleId = body.articleId ?? latestWechatDraftArticleId();
    if (!articleId) {
      return NextResponse.json({ error: "No WeChat draft article is ready to publish." }, { status: 400 });
    }

    const result = await publishExperimentArticle({ articleId, draftId: body.draftId });
    const status = result.status === "blocked" ? 409 : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish experiment article" },
      { status: 502 }
    );
  }
}
