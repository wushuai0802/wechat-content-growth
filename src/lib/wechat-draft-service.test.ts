import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArticlePackage } from "./domain";
import type { WechatConfig } from "./wechat-config";
import { createSeedWorkspace, type WorkspaceStore } from "./workspace-store";
import { createWechatDraftFromArticle, publishWechatDraftFromArticle } from "./wechat-draft-service";

const article: ArticlePackage = {
  id: "article-1",
  topicId: "topic-1",
  title: "Article title",
  summary: "Article summary",
  status: "approved",
  contentPath: "",
  coverPath: "",
  qualityScore: 82,
  riskScore: 12,
  estimatedCost: 20,
  estimatedRevenue: 300,
  createdAt: "2026-06-18T00:00:00.000Z"
};

const config: WechatConfig = {
  appId: "wx-app-id",
  appSecret: "app-secret",
  token: "server-token",
  publishMode: "draft_only"
};

const autoPublishConfig: WechatConfig = {
  ...config,
  publishMode: "auto_publish"
};

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function articleWithCover(): ArticlePackage {
  const dir = mkdtempSync(join(tmpdir(), "wechat-draft-service-"));
  tempDirs.push(dir);
  const coverPath = join(dir, "cover.png");
  const coverBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  writeFileSync(coverPath, coverBytes);
  return {
    ...article,
    coverPath,
    visualPlan: {
      status: "ready",
      model: "gpt-image-2",
      updatedAt: "2026-07-13T00:00:00.000Z",
      assets: [{
        id: "article-1-cover-visual",
        role: "cover",
        alt: "Article cover",
        prompt: "prompt",
        localPath: coverPath,
        source: "gpt-image-2",
        model: "gpt-image-2",
        status: "generated",
        targetWidth: 1200,
        targetHeight: 510,
        generationSize: "1536x1024",
        width: 1200,
        height: 510,
        mimeType: "image/png",
        sha256: createHash("sha256").update(coverBytes).digest("hex"),
        generatedAt: "2026-07-13T00:00:00.000Z"
      }]
    }
  };
}

function createStore(overrides?: Partial<WorkspaceStore>): WorkspaceStore {
  const articleWithRasterCover = articleWithCover();
  const inlinePath = join(dirnameCompat(articleWithRasterCover.coverPath), "inline.png");
  const inlineBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  writeFileSync(inlinePath, inlineBytes);
  const testArticle: ArticlePackage = {
    ...articleWithRasterCover,
    visualPlan: {
      ...articleWithRasterCover.visualPlan!,
      assets: [
        ...articleWithRasterCover.visualPlan!.assets,
        {
          id: "article-1-inline-1",
          role: "body",
          alt: "Inline visual",
          prompt: "prompt",
          localPath: inlinePath,
          source: "gpt-image-2",
          model: "gpt-image-2",
          status: "generated",
          targetWidth: 1200,
          targetHeight: 800,
          generationSize: "1536x1024",
          width: 1200,
          height: 800,
          mimeType: "image/png",
          sha256: createHash("sha256").update(inlineBytes).digest("hex"),
          generatedAt: "2026-07-13T00:00:00.000Z"
        }
      ]
    }
  };
  let workspace = { ...createSeedWorkspace(), articles: [testArticle] };
  return {
    getWorkspace: vi.fn(() => workspace),
    getArticleDetail: vi.fn(() => ({ article: testArticle, markdown: `# Article title\n\nBody\n\n![inline visual](${inlinePath})` })),
    updateArticleDetail: vi.fn(),
    applyArticleAction: vi.fn((_articleId, action) => {
      const nextStatus = action === "create_wechat_draft" ? "wechat_draft" : action === "approve" ? "approved" : testArticle.status;
      workspace = { ...workspace, articles: [{ ...testArticle, status: nextStatus }] };
      return workspace;
    }),
    applySuggestionAction: vi.fn(),
    generateDraftFromTopic: vi.fn(),
    generateWeeklyReport: vi.fn(),
    refreshTrendSignals: vi.fn(),
    getExperimentSummary: vi.fn(),
    updateAutoLoopConfig: vi.fn(),
    saveExperimentRunResult: vi.fn(),
    stopAutoLoop: vi.fn(),
    recordArticleOutcomes: vi.fn(),
    recordPublicationAttempt: vi.fn((attempt) => {
      workspace = { ...workspace, publicationAttempts: [attempt] };
      return workspace;
    }),
    resetWorkspace: vi.fn(),
    ...overrides
} as unknown as WorkspaceStore;
}

function dirnameCompat(path: string): string {
  return path.replace(/[\\/][^\\/]+$/, "");
}

describe("createWechatDraftFromArticle", () => {
  it("creates a WeChat draft, uploads a cover, and marks the article as a WeChat draft", async () => {
    const store = createStore();
    const getAccessToken = vi.fn(async () => "access-token");
    const uploadImageMaterial = vi.fn(async () => ({ mediaId: "thumb-media-id" }));
    const uploadInlineImage = vi.fn(async () => ({ url: "https://mmbiz.qpic.cn/body.png" }));
    const createDraft = vi.fn(async () => ({ draftId: "draft-media-id" }));

    const result = await createWechatDraftFromArticle("article-1", {
      store,
      getConfig: () => config,
      getAccessToken,
      uploadImageMaterial,
      uploadInlineImage,
      createDraft
    });

    expect(getAccessToken).toHaveBeenCalledWith(config);
    expect(uploadImageMaterial).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "access-token" }));
    expect(uploadInlineImage).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "access-token" }));
    expect(uploadInlineImage).toHaveBeenCalledTimes(1);
    expect(createDraft).toHaveBeenCalledWith({
      article: expect.objectContaining({ id: "article-1" }),
      markdown: expect.stringContaining("https://mmbiz.qpic.cn/body.png"),
      accessToken: "access-token",
      thumbMediaId: "thumb-media-id"
    });
    expect(store.applyArticleAction).toHaveBeenCalledWith("article-1", "create_wechat_draft");
    expect(store.recordPublicationAttempt).toHaveBeenCalledWith(expect.objectContaining({
      articleId: "article-1",
      status: "draft_created",
      draftId: "draft-media-id"
    }));
    expect(store.recordPublicationAttempt).toHaveBeenCalledWith(expect.objectContaining({
      attribution: expect.objectContaining({
        titleAtDraft: "Article title",
        originalTitle: "Article title",
        titleChanged: false,
        markdownImageCount: 1,
        uploadedInlineImageCount: 1,
        remoteInlineImageCount: 0,
        coverMediaId: "thumb-media-id",
        draftId: "draft-media-id"
      })
    }));
    expect(result.draftId).toBe("draft-media-id");
    expect(result.workspace.articles[0].status).toBe("wechat_draft");
  });

  it("does not mark the article when WeChat config is missing", async () => {
    const store = createStore();

    await expect(
      createWechatDraftFromArticle("article-1", {
        store,
        getConfig: () => null,
        getAccessToken: vi.fn(),
        createDraft: vi.fn()
      })
    ).rejects.toThrow("WeChat config is not configured");

    expect(store.applyArticleAction).not.toHaveBeenCalled();
  });

  it("does not mark the article when the article document is missing", async () => {
    const store = createStore({ getArticleDetail: vi.fn(() => null) });

    await expect(
      createWechatDraftFromArticle("missing-article", {
        store,
        getConfig: () => config,
        getAccessToken: vi.fn(),
        createDraft: vi.fn()
      })
    ).rejects.toThrow("Article not found: missing-article");

    expect(store.applyArticleAction).not.toHaveBeenCalled();
  });

  it("blocks review articles before uploading anything", async () => {
    const reviewArticle = { ...articleWithCover(), status: "review" as const };
    const workspace = { ...createSeedWorkspace(), articles: [reviewArticle] };
    const store = createStore({
      getWorkspace: vi.fn(() => workspace),
      getArticleDetail: vi.fn(() => ({ article: reviewArticle, markdown: "# Review\n\nBody" }))
    });
    const uploadImageMaterial = vi.fn();
    const createDraft = vi.fn();

    await expect(createWechatDraftFromArticle("article-1", {
      store,
      getConfig: () => config,
      getAccessToken: vi.fn(),
      uploadImageMaterial,
      createDraft
    })).rejects.toThrow("Article must be approved before creating a WeChat draft: review");

    expect(uploadImageMaterial).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("blocks an approved article with a stored factual hard block before uploading", async () => {
    const blockedArticle = {
      ...articleWithCover(),
      qualityAssessment: {
        passed: false,
        score: 76,
        dimensions: {
          readerFit: 20,
          informationDensity: 18,
          factualReliability: 0,
          structureReadability: 15,
          headlineOpening: 10,
          uniquePerspective: 10,
          ctaNaturalness: 3
        },
        reasons: ["高影响主题缺少已核验的官方事实素材，不能进入微信草稿。"],
        hardBlockReasons: ["高影响主题缺少已核验的官方事实素材，不能进入微信草稿。"],
        evaluatedAt: "2026-07-13T00:00:00.000Z"
      }
    };
    const workspace = { ...createSeedWorkspace(), articles: [blockedArticle] };
    const store = createStore({
      getWorkspace: vi.fn(() => workspace),
      getArticleDetail: vi.fn(() => ({ article: blockedArticle, markdown: "# 安徽高考专业分析\n\n正文" }))
    });
    const getAccessToken = vi.fn();
    const uploadImageMaterial = vi.fn();

    await expect(createWechatDraftFromArticle("article-1", {
      store,
      getConfig: () => config,
      getAccessToken,
      uploadImageMaterial,
      createDraft: vi.fn()
    })).rejects.toThrow("Article quality assessment has hard blocks");

    expect(getAccessToken).not.toHaveBeenCalled();
    expect(uploadImageMaterial).not.toHaveBeenCalled();
  });

  it("blocks a new article whose raster visual plan is not ready", async () => {
    const plannedArticle = {
      ...articleWithCover(),
      visualPlan: {
        status: "planned" as const,
        model: "gpt-image-2",
        assets: [],
        updatedAt: "2026-07-13T00:00:00.000Z"
      }
    };
    const workspace = { ...createSeedWorkspace(), articles: [plannedArticle] };
    const store = createStore({
      getWorkspace: vi.fn(() => workspace),
      getArticleDetail: vi.fn(() => ({ article: plannedArticle, markdown: "# Article\n\nBody" }))
    });
    const getAccessToken = vi.fn();

    await expect(createWechatDraftFromArticle("article-1", {
      store,
      getConfig: () => config,
      getAccessToken,
      uploadImageMaterial: vi.fn(),
      createDraft: vi.fn()
    })).rejects.toThrow("Article raster visuals are not ready: planned");

    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("blocks an approved article whose editorial voice is still template-like", async () => {
    const blockedArticle = {
      ...articleWithCover(),
      editorialVoiceAssessment: {
        passed: false,
        score: 62,
        metrics: {
          sentenceLengthStdDev: 7,
          paragraphLengthStdDev: 16,
          shortSentenceCount: 0,
          longSentenceCount: 0,
          templatePhraseCount: 2,
          formulaicEnumerationCount: 4,
          explicitStanceCount: 0,
          qualificationCount: 0,
          sourceAnchorCount: 0,
          formulaicEndingCount: 1,
          paragraphCount: 9,
          sentenceCount: 12
        },
        reasons: ["文章仍然过于模板化。"],
        evaluatedAt: "2026-07-15T00:00:00.000Z"
      }
    };
    const workspace = { ...createSeedWorkspace(), articles: [blockedArticle] };
    const store = createStore({
      getWorkspace: vi.fn(() => workspace),
      getArticleDetail: vi.fn(() => ({ article: blockedArticle, markdown: "# Article\n\nBody" }))
    });
    const getAccessToken = vi.fn();

    await expect(createWechatDraftFromArticle("article-1", {
      store,
      getConfig: () => config,
      getAccessToken,
      uploadImageMaterial: vi.fn(),
      createDraft: vi.fn()
    })).rejects.toThrow("Article editorial voice assessment did not pass: 62");

    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("blocks vector-era articles until a raster visual plan is generated", async () => {
    const legacyArticle = { ...articleWithCover(), visualPlan: undefined };
    const workspace = { ...createSeedWorkspace(), articles: [legacyArticle] };
    const store = createStore({
      getWorkspace: vi.fn(() => workspace),
      getArticleDetail: vi.fn(() => ({ article: legacyArticle, markdown: "# Article\n\nBody" }))
    });
    const getAccessToken = vi.fn();

    await expect(createWechatDraftFromArticle("article-1", {
      store,
      getConfig: () => config,
      getAccessToken,
      uploadImageMaterial: vi.fn(),
      createDraft: vi.fn()
    })).rejects.toThrow("Article raster visual plan is missing");

    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("blocks a raster asset that changed after its recorded checksum", async () => {
    const tamperedArticle = articleWithCover();
    writeFileSync(tamperedArticle.coverPath, Buffer.from("tampered"));
    const workspace = { ...createSeedWorkspace(), articles: [tamperedArticle] };
    const store = createStore({
      getWorkspace: vi.fn(() => workspace),
      getArticleDetail: vi.fn(() => ({ article: tamperedArticle, markdown: "# Article\n\nBody" }))
    });
    const getAccessToken = vi.fn();

    await expect(createWechatDraftFromArticle("article-1", {
      store,
      getConfig: () => config,
      getAccessToken,
      uploadImageMaterial: vi.fn(),
      createDraft: vi.fn()
    })).rejects.toThrow("Article raster visual asset is incomplete");

    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("blocks official publish when config is not auto_publish", async () => {
    const store = createStore();

    const result = await publishWechatDraftFromArticle("article-1", "draft-media-id", {
      store,
      getConfig: () => config,
      getAccessToken: vi.fn(),
      publishDraft: vi.fn()
    });

    expect(result.status).toBe("blocked");
    expect(store.recordPublicationAttempt).toHaveBeenCalledWith(expect.objectContaining({
      articleId: "article-1",
      status: "blocked",
      draftId: "draft-media-id"
    }));
  });

  it("submits official publish when config is auto_publish", async () => {
    const store = createStore();
    const getAccessToken = vi.fn(async () => "access-token");
    const publishDraft = vi.fn(async () => ({ publishId: "publish-id" }));

    const result = await publishWechatDraftFromArticle("article-1", "draft-media-id", {
      store,
      getConfig: () => autoPublishConfig,
      getAccessToken,
      publishDraft
    });

    expect(getAccessToken).toHaveBeenCalledWith(autoPublishConfig);
    expect(publishDraft).toHaveBeenCalledWith({ draftId: "draft-media-id", accessToken: "access-token" });
    expect(store.recordPublicationAttempt).toHaveBeenCalledWith(expect.objectContaining({
      articleId: "article-1",
      status: "publish_submitted",
      draftId: "draft-media-id",
      publishId: "publish-id"
    }));
    expect(result).toEqual({ status: "publish_submitted", publishId: "publish-id" });
  });

  it("carries draft attribution into the official publish submission record", async () => {
    const draftAttribution = {
      titleAtDraft: "Article title",
      originalTitle: "Original title",
      titleChanged: true,
      wordCount: 980,
      markdownImageCount: 3,
      uploadedInlineImageCount: 2,
      remoteInlineImageCount: 1,
      imageDensityPerThousandWords: 3.06,
      headingCount: 4,
      coverPath: "cover.png",
      coverMediaId: "thumb-media-id",
      draftId: "draft-media-id",
      qualityScore: 82,
      riskScore: 12,
      estimatedCost: 20,
      estimatedRevenue: 300,
      createdAt: "2026-06-18T12:00:00.000Z"
    };
    const store = createStore({
      getWorkspace: vi.fn(() => ({
        ...createSeedWorkspace(),
        articles: [{ ...articleWithCover(), id: "article-1", status: "wechat_draft" as const }],
        publicationAttempts: [
          {
            id: "pub-draft-old",
            articleId: "article-1",
            status: "draft_created" as const,
            channel: "wechat" as const,
            draftId: "draft-media-id",
            attribution: draftAttribution,
            createdAt: "2026-06-18T12:00:00.000Z"
          }
        ]
      }))
    });
    const publishDraft = vi.fn(async () => ({ publishId: "publish-id" }));

    await publishWechatDraftFromArticle("article-1", "draft-media-id", {
      store,
      getConfig: () => autoPublishConfig,
      getAccessToken: vi.fn(async () => "access-token"),
      publishDraft
    });

    expect(store.recordPublicationAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: "publish_submitted",
      publishId: "publish-id",
      attribution: expect.objectContaining({
        ...draftAttribution,
        publishId: "publish-id"
      })
    }));
  });
});
