"use client";

import React, { useMemo, useState } from "react";
import { Archive, Check, FileText, Image as ImageIcon, Layers3, RefreshCcw, Save, Send } from "lucide-react";
import type { ArticleDocument } from "@/lib/article-document";
import type { ArticleVisualGenerationScope } from "@/lib/article-visual-service";
import type { ArticleVisualPlanStatus } from "@/lib/domain";
import type { ArticleAction } from "@/lib/workflow";

const statusLabel = {
  drafting: "生成中",
  review: "待审阅",
  approved: "已通过",
  wechat_draft: "微信草稿",
  publish_submitted: "发布处理中",
  needs_reconcile: "待核对",
  published: "已发布",
  archived: "归档"
};

const visualStatusLabel: Record<ArticleVisualPlanStatus, string> = {
  planned: "待生成位图",
  generating: "位图生成中",
  needs_visual_review: "配图需处理",
  ready: "位图已就绪",
  approved: "配图已确认"
};

function MarkdownPreview({ markdown }: { markdown: string }) {
  const blocks = useMemo(
    () => markdown.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean),
    [markdown]
  );

  if (blocks.length === 0) {
    return <p className="emptyPreview">暂无正文内容。</p>;
  }

  return (
    <div className="markdownPreview">
      {blocks.map((block, index) => {
        if (block.startsWith("# ")) {
          return <h1 key={index}>{block.replace(/^#\s+/, "")}</h1>;
        }
        if (block.startsWith("## ")) {
          return <h2 key={index}>{block.replace(/^##\s+/, "")}</h2>;
        }
        if (block.startsWith("- ")) {
          return (
            <ul key={index}>
              {block.split("\n").map((line) => (
                <li key={line}>{line.replace(/^-\s+/, "")}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{block}</p>;
      })}
    </div>
  );
}

export function ArticleEditorClient({ initialDetail }: { initialDetail: ArticleDocument }) {
  const [detail, setDetail] = useState(initialDetail);
  const [title, setTitle] = useState(initialDetail.article.title);
  const [summary, setSummary] = useState(initialDetail.article.summary);
  const [markdown, setMarkdown] = useState(initialDetail.markdown);
  const [activity, setActivity] = useState("文章已加载，等待审阅。");
  const [isSaving, setIsSaving] = useState(false);
  const [isVisualBusy, setIsVisualBusy] = useState(false);
  const visualPlan = detail.article.visualPlan;
  const editorialVoice = detail.article.editorialVoiceAssessment;
  const visibleVisualAssets = (visualPlan?.assets ?? []).filter((asset) => asset.status === "generated" || asset.status === "approved");

  const saveArticle = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/articles/${detail.article.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, summary, markdown })
      });

      if (!response.ok) {
        throw new Error("保存文章失败");
      }

      const updated = (await response.json()) as ArticleDocument;
      setDetail(updated);
      setTitle(updated.article.title);
      setSummary(updated.article.summary);
      setMarkdown(updated.markdown);
      setActivity("文章内容已保存。");
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "保存文章失败");
    } finally {
      setIsSaving(false);
    }
  };

  const runAction = async (action: ArticleAction, message: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/articles/${detail.article.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "保存审阅动作失败");
      }

      const refreshed = await fetch(`/api/articles/${detail.article.id}`);
      const nextDetail = (await refreshed.json()) as ArticleDocument;
      setDetail(nextDetail);
      setActivity(`${message} 已保存。`);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "保存审阅动作失败");
    } finally {
      setIsSaving(false);
    }
  };

  const runVisualAction = async (action: "generate" | "approve", scope: ArticleVisualGenerationScope = "all") => {
    setIsVisualBusy(true);
    setActivity(action === "generate" ? "正在生成高质量位图…" : "正在确认配图…");
    try {
      const response = await fetch(`/api/articles/${detail.article.id}/visuals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, scope })
      });
      const payload = (await response.json()) as ArticleDocument | { error?: string };
      if (!response.ok || !("article" in payload)) {
        throw new Error("error" in payload && payload.error ? payload.error : "配图操作失败");
      }
      setDetail(payload);
      setMarkdown(payload.markdown);
      const nextPlan = payload.article.visualPlan;
      if (nextPlan?.status === "needs_visual_review") {
        const firstError = nextPlan.assets.find((asset) => asset.error)?.error;
        setActivity(firstError ? `配图需要处理：${firstError}` : "配图需要人工处理。");
      } else {
        setActivity(action === "approve" ? "配图确认已保存。" : "位图生成完成。");
      }
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "配图操作失败");
    } finally {
      setIsVisualBusy(false);
    }
  };

  return (
    <section className="articleEditorGrid">
      <div className="articleEditPanel">
        <div className="editorStatusLine">
          <span className={`statusPill ${detail.article.status === "review" ? "warn" : "ok"}`}>
            <FileText size={14} />
            {statusLabel[detail.article.status]}
          </span>
          <span>{activity}</span>
        </div>

        <div id="visuals" className="visualReviewBar">
          <div className="visualStatusSummary">
            <ImageIcon size={16} />
            <span>位图配图</span>
            <strong>{visualPlan ? visualStatusLabel[visualPlan.status] : "旧稿未规划"}</strong>
            <small>{visualPlan?.model ?? "gpt-image-2"} · {visibleVisualAssets.length}/{visualPlan?.assets.length ?? 0}</small>
          </div>
          <div className="visualActionGroup">
            <button className="iconButton" title="重新生成全部配图" onClick={() => runVisualAction("generate", "all")} disabled={isVisualBusy}>
              <RefreshCcw size={16} />
            </button>
            <button className="iconButton" title="重新生成封面" onClick={() => runVisualAction("generate", "cover")} disabled={isVisualBusy}>
              <ImageIcon size={16} />
            </button>
            <button className="iconButton" title="重新生成正文图" onClick={() => runVisualAction("generate", "body")} disabled={isVisualBusy}>
              <Layers3 size={16} />
            </button>
            <button
              className="iconButton"
              title="确认配图"
              onClick={() => runVisualAction("approve")}
              disabled={isVisualBusy || (visualPlan?.status !== "ready" && visualPlan?.status !== "approved")}
            >
              <Check size={16} />
            </button>
          </div>
        </div>

        <label className="editorField">
          <span>标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label className="editorField">
          <span>摘要</span>
          <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} />
        </label>

        <label className="editorField bodyField">
          <span>Markdown 正文</span>
          <textarea value={markdown} onChange={(event) => setMarkdown(event.target.value)} rows={18} />
        </label>

        <div className="editorActions">
          <button className="primaryButton" onClick={saveArticle} disabled={isSaving}>
            <Save size={16} />
            保存修改
          </button>
          {detail.article.status === "review" ? (
            <button className="ghostButton" onClick={() => runAction("approve", "文章已通过审阅")} disabled={isSaving}>
              <Check size={16} />
              通过
            </button>
          ) : null}
          {detail.article.status === "approved" ? (
            <button className="ghostButton" onClick={() => runAction("create_wechat_draft", "微信草稿动作")} disabled={isSaving}>
              <Send size={16} />
              创建草稿
            </button>
          ) : null}
          {detail.article.status === "publish_submitted" || detail.article.status === "needs_reconcile" ? (
            <button className="ghostButton" onClick={() => runAction("publish", "已确认发布成功")} disabled={isSaving}>
              <Check size={16} />
              确认已发布
            </button>
          ) : null}
          <button className="ghostButton" onClick={() => runAction("archive", "文章已归档")} disabled={isSaving}>
            <Archive size={16} />
            归档
          </button>
        </div>
      </div>

      <aside className="articlePreviewPanel">
        <div className="previewMetaGrid">
          <div>
            <span>预计收益</span>
            <strong>¥{detail.article.estimatedRevenue}</strong>
          </div>
          <div>
            <span>成本</span>
            <strong>¥{detail.article.estimatedCost}</strong>
          </div>
          <div>
            <span>质量</span>
            <strong>{detail.article.qualityScore}</strong>
          </div>
          <div>
            <span>风险</span>
            <strong>{detail.article.riskScore}</strong>
          </div>
          <div>
            <span>编辑声音</span>
            <strong>{editorialVoice?.score ?? "-"}</strong>
          </div>
        </div>
        {editorialVoice && !editorialVoice.passed ? (
          <div className="editorialVoiceNotice" role="status">
            <strong>声音门禁未通过</strong>
            <span>{editorialVoice.reasons[0] ?? "文章仍需人工改写。"}</span>
          </div>
        ) : null}
        <section className="visualAssetReview" aria-label="文章位图预览">
          <div className="visualAssetReviewHeader">
            <span>配图审阅</span>
            <strong>{visualPlan ? visualStatusLabel[visualPlan.status] : "未建立计划"}</strong>
          </div>
          {visibleVisualAssets.length > 0 ? (
            <div className="visualAssetList">
              {visibleVisualAssets.map((asset) => (
                <figure className={`visualAssetFigure ${asset.role}`} key={asset.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/articles/${detail.article.id}/visuals?assetId=${encodeURIComponent(asset.id)}&v=${encodeURIComponent(asset.generatedAt ?? visualPlan?.updatedAt ?? "")}`}
                    alt={asset.alt}
                    width={asset.width ?? asset.targetWidth}
                    height={asset.height ?? asset.targetHeight}
                  />
                  <figcaption>
                    <span>{asset.role === "cover" ? "封面" : asset.anchorHeading ?? "正文配图"}</span>
                    <strong>{asset.width ?? asset.targetWidth}×{asset.height ?? asset.targetHeight}</strong>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="visualEmptyState">暂无可审阅位图</div>
          )}
        </section>
        <MarkdownPreview markdown={markdown} />
      </aside>
    </section>
  );
}
