import { describe, expect, it, vi } from "vitest";
import type { WorkspaceStore } from "./workspace-store";
import { createSeedWorkspace } from "./workspace-store";
import { publishExperimentArticle } from "./experiment-publisher";

function createStore(overrides?: Partial<WorkspaceStore>): WorkspaceStore {
  const workspace = createSeedWorkspace();
  return {
    getWorkspace: vi.fn(() => ({
      ...workspace,
      autoLoopConfig: { ...workspace.autoLoopConfig, autoPublishEnabled: true },
      articles: [{ ...workspace.articles[0], id: "article-1", status: "wechat_draft" as const }],
      publicationAttempts: [{
        id: "pub-draft-1",
        articleId: "article-1",
        status: "draft_created" as const,
        channel: "wechat" as const,
        draftId: "draft-media-id",
        createdAt: "2026-06-18T12:00:00.000Z"
      }]
    })),
    getArticleDetail: vi.fn(),
    updateArticleDetail: vi.fn(),
    applyArticleAction: vi.fn((articleId, action) => ({
      ...workspace,
      articles: [{ ...workspace.articles[0], id: articleId, status: action === "submit_publish" ? "publish_submitted" as const : "wechat_draft" as const }]
    })),
    applySuggestionAction: vi.fn(),
    generateDraftFromTopic: vi.fn(),
    generateWeeklyReport: vi.fn(),
    refreshTrendSignals: vi.fn(),
    getExperimentSummary: vi.fn(),
    updateAutoLoopConfig: vi.fn(),
    saveExperimentRunResult: vi.fn(),
    stopAutoLoop: vi.fn(),
    recordArticleOutcomes: vi.fn(),
    recordPublicationAttempt: vi.fn(),
    resetWorkspace: vi.fn(),
    ...overrides
  } as unknown as WorkspaceStore;
}

describe("publishExperimentArticle", () => {
  it("blocks publishing when AutoProfit auto publish is off", async () => {
    const store = createStore({
      getWorkspace: vi.fn(() => ({
        ...createSeedWorkspace(),
        autoLoopConfig: { ...createSeedWorkspace().autoLoopConfig, autoPublishEnabled: false },
        articles: [{ ...createSeedWorkspace().articles[0], id: "article-1", status: "wechat_draft" as const }],
        publicationAttempts: []
      }))
    });
    const publishWechatDraft = vi.fn();

    const result = await publishExperimentArticle({ articleId: "article-1", store, publishWechatDraft });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("AutoProfit auto publish is disabled.");
    expect(publishWechatDraft).not.toHaveBeenCalled();
  });

  it("submits the latest WeChat draft without claiming publication succeeded", async () => {
    const store = createStore();
    const publishWechatDraft = vi.fn(async () => ({ status: "publish_submitted" as const, publishId: "publish-id" }));

    const result = await publishExperimentArticle({ articleId: "article-1", store, publishWechatDraft });

    expect(publishWechatDraft).toHaveBeenCalledWith("article-1", "draft-media-id");
    expect(store.applyArticleAction).toHaveBeenCalledWith("article-1", "submit_publish");
    expect(result).toMatchObject({ status: "publish_submitted", publishId: "publish-id" });
    expect(result.workspace.articles[0].status).toBe("publish_submitted");
  });
});
