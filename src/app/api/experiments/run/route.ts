import { NextResponse, type NextRequest } from "next/server";
import { generateArticleVisualAssets } from "@/lib/article-visual-generator";
import { decideDailyArticleLimit } from "@/lib/daily-run-planner";
import { runAutoProfitExperiment } from "@/lib/experiment-orchestrator";
import { generateCpaDraftMarkdown, getLocalCpaConfig } from "@/lib/local-cpa-client";
import { extractAutoLoopConfigPatch, shouldAutoDecideDailyArticleLimit, type RunRequestBody } from "@/lib/run-request";
import { createWechatDraftFromArticle } from "@/lib/wechat-draft-service";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as RunRequestBody;
  const configPatch = extractAutoLoopConfigPatch(body);

  if (Object.keys(configPatch).length > 0) {
    workspaceStore.updateAutoLoopConfig(configPatch);
  }

  if (shouldAutoDecideDailyArticleLimit(body)) {
    const dailyPlan = decideDailyArticleLimit({ workspace: workspaceStore.getWorkspace() });
    workspaceStore.updateAutoLoopConfig({ dailyArticleLimit: dailyPlan.recommendedArticleLimit });
  }

  const result = await runAutoProfitExperiment({
    workspace: workspaceStore.getWorkspace(),
    generateDraft: async (topicId, current) => {
      const topic = current.topics.find((item) => item.id === topicId);
      if (!topic) {
        throw new Error(`Topic not found: ${topicId}`);
      }
      const cpaConfig = getLocalCpaConfig();
      if (!cpaConfig) {
        return workspaceStore.generateDraftFromTopic(topicId);
      }
      const markdown = await generateCpaDraftMarkdown(topic, cpaConfig);
      return workspaceStore.generateDraftFromTopic(topicId, { markdownOverride: markdown });
    },
    createWechatDraft: async (articleId, current) => {
      const approved = current.articles.find((article) => article.id === articleId);
      if (approved?.status !== "approved") {
        throw new Error(`Article was not approved by the experiment gate: ${approved?.status ?? "missing"}`);
      }
      const persisted = workspaceStore.getWorkspace().articles.find((article) => article.id === articleId);
      if (persisted?.status === "review") {
        workspaceStore.applyArticleAction(articleId, "approve");
      }
      const detail = workspaceStore.getArticleDetail(articleId);
      if (detail) {
        const visuals = await generateArticleVisualAssets(detail.article, detail.markdown, {
          cpaConfig: getLocalCpaConfig(),
          imageModel: "gpt-image-2",
          maxInlineImages: 3,
          existingPlan: detail.article.visualPlan
        });
        workspaceStore.updateArticleDetail(articleId, {
          markdown: visuals.markdown,
          visualPlan: visuals.visualPlan
        });
        if (visuals.visualPlan.status !== "ready" && visuals.visualPlan.status !== "approved") {
          throw new Error(`Raster visuals require review: ${visuals.visualPlan.status}`);
        }
      }
      return createWechatDraftFromArticle(articleId);
    }
  });

  workspaceStore.saveExperimentRunResult({ ...result, workspace: workspaceStore.getWorkspace() });
  return NextResponse.json(workspaceStore.getExperimentSummary());
}
