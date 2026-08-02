import Link from "next/link";
import { notFound } from "next/navigation";
import { workspaceStore } from "@/lib/workspace-store";
import { ArticleEditorClient } from "./article-editor-client";

export const dynamic = "force-dynamic";

export default async function ArticleDetailPage({
  params
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;
  const detail = workspaceStore.getArticleDetail(articleId);

  if (!detail) {
    notFound();
  }

  return (
    <main className="articleEditorShell">
      <header className="articleEditorTopbar">
        <div>
          <p className="eyebrow">审阅编辑</p>
          <h1>{detail.article.title}</h1>
        </div>
        <Link className="ghostButton" href="/">
          返回后台
        </Link>
      </header>
      <ArticleEditorClient initialDetail={detail} />
    </main>
  );
}
