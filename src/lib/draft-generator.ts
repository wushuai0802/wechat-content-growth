import { join } from "node:path";
import { buildContentBrief } from "./content-brief";
import { evaluateArticleQuality } from "./content-quality-gate";
import { evaluateEditorialVoice } from "./editorial-voice-gate";
import type { ArticleContentType, ArticleFact, ArticlePackage, ContentBrief, TopicCandidate } from "./domain";
import { getArticleDraftsDir, getCoverImagesDir } from "./paths";

export interface GeneratedDraft {
  article: ArticlePackage;
  markdown: string;
}

const safeTopicTitleFallbacks: Record<string, string> = {
  "topic-safe-ai-meeting-notes-workflow": "用 AI 自动整理会议纪要：从录音到行动清单",
  "topic-safe-content-roi-dashboard": "内容 ROI 仪表盘：用数据决定下一篇写什么",
  "topic-safe-local-ai-content-pipeline": "本地 AI 内容流水线：从资料归档到公众号初稿"
};

function hasCjk(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

function extractMarkdownTitle(markdown: string): string | null {
  return /^#\s+(.+)$/m.exec(markdown)?.[1].trim() ?? null;
}

function readableTopicTitle(topic: TopicCandidate, markdown: string): string {
  const markdownTitle = extractMarkdownTitle(markdown);
  if (markdownTitle && hasCjk(markdownTitle)) {
    return markdownTitle;
  }
  if (safeTopicTitleFallbacks[topic.id]) {
    return safeTopicTitleFallbacks[topic.id];
  }
  return topic.title;
}

function syncMarkdownTitle(markdown: string, title: string): string {
  if (/^#\s+.+$/m.test(markdown)) {
    return markdown.replace(/^#\s+.+$/m, `# ${title}`);
  }
  return `# ${title}\n\n${markdown}`;
}

function verifiedFactSection(facts: ArticleFact[]): string[] {
  const verified = facts.filter((fact) => fact.verificationStatus === "verified");
  if (verified.length === 0) return [];
  return [
    "## 先核对这些信息",
    "",
    ...verified.flatMap((fact) => [
      `- ${fact.claim}`,
      `  来源：${fact.sourceUrl ? `[${fact.sourceName}](${fact.sourceUrl})` : fact.sourceName}${fact.publishedAt ? `，${fact.publishedAt}` : ""}${fact.applicableRegion ? `，适用地区：${fact.applicableRegion}` : ""}`
    ]),
    ""
  ];
}

function typeSpecificGuidance(articleType: ArticleContentType): string {
  switch (articleType) {
    case "decision_guide":
      return "不要急着找一个对所有人都成立的答案。先把预算、使用频率、学习成本和不能妥协的条件列出来，再逐项比较。选择的价值不在于追最新，而在于它能否稳定解决自己的问题。";
    case "professional_analysis":
      return "先分清课程要求、能力偏好、院校培养差异和就业边界。公开信息只能帮助缩小范围，最终仍要结合当年章程、所在地区政策和个人条件核对。";
    case "hot_explainer":
      return "热点本身不是行动理由。先判断变化影响了谁、影响什么，再确认自己是否真的需要调整。与自己无关的热闹，可以先放下；与当前任务相关的变化，再做小范围验证。";
    case "case_story":
      return "案例最有价值的部分不是结果，而是当时掌握了哪些信息、做了什么取舍、哪些判断后来被证明有效。把过程拆开，才能知道哪些方法可以复用。";
    default:
      return "先选一个风险低、范围小、结果容易观察的场景。完成一次以后记录耗时、错误和实际帮助，再决定要不要扩大。不要一开始就重做整套流程。";
  }
}

function fallbackMarkdown(topic: TopicCandidate, brief: ContentBrief, facts: ArticleFact[]): string {
  return [
    `# ${topic.title}`,
    "",
    `如果你是${brief.audience}，很可能已经遇到这样的情况：${brief.readerProblem}。信息越多，越容易把“看过很多”误当成“已经会选”。这篇文章不替你做决定，而是给出一套能马上使用的判断顺序。`,
    "",
    "## 先把问题说清楚",
    "",
    `${brief.corePromise}。真正需要解决的不是把所有资料收集齐，而是先知道哪些信息会改变决定，哪些只是让人更焦虑。把问题限定在自己的时间、预算和实际场景里，后面的比较才有意义。`,
    "",
    ...verifiedFactSection(facts),
    "## 用一个更稳妥的框架判断",
    "",
    typeSpecificGuidance(brief.articleType),
    "",
    "可以先问自己三个问题：",
    "",
    "1. 我现在最想解决的具体问题是什么？",
    "2. 哪三个条件会直接影响我的选择？",
    "3. 哪些结论需要回到官方页面或原始资料再次核对？",
    "",
    "## 按这个顺序行动",
    "",
    "第一步，只收集会改变决定的信息，并记下来源和日期。第二步，把不同选项放进同一张表，不要拿宣传口号互相比较。第三步，先做一次成本较低的小验证。第四步，记录结果，再决定继续、调整还是放弃。",
    "",
    "这样做看起来慢一点，却能减少被单一观点带着走的概率。尤其遇到数字、政策、价格、录取或就业信息时，要确认年份、地区和统计口径，不要把别人的条件直接套到自己身上。",
    "",
    "## 最容易踩的坑",
    "",
    "- 只看结论，不看它适用于什么人。",
    "- 看到一个漂亮数字，就忽略来源、年份和口径。",
    "- 为了追求一步到位，把第一次尝试做得过重。",
    "- 把个别人的经历，当成所有人的确定答案。",
    "",
    "## 今天先做一件小事",
    "",
    `${brief.callToAction}。先把这一小步做完，不需要今天就得到最终答案。只要信息更清楚、下一步更具体，这次阅读就已经产生了价值。`
  ].join("\n");
}

export function generateDraftArticle(
  topic: TopicCandidate,
  options?: { now?: Date; sequence?: number; draftDir?: string; coverDir?: string; markdownOverride?: string }
): GeneratedDraft {
  const now = options?.now ?? new Date();
  const sequence = options?.sequence ?? 1;
  const timestamp = formatTimestamp(now);
  const articleId = `article-${topic.id}-${timestamp}-${sequence}`;
  const fileName = `${articleId}.md`;
  const contentPath = join(options?.draftDir ?? getArticleDraftsDir(), fileName);
  const coverPath = join(options?.coverDir ?? getCoverImagesDir(), `${articleId}.png`);
  const contentBrief = buildContentBrief(topic);
  const factPack = (topic.factPack ?? []).map((fact) => ({ ...fact }));

  const rawMarkdown = options?.markdownOverride ?? fallbackMarkdown(topic, contentBrief, factPack);
  const title = readableTopicTitle(topic, rawMarkdown);
  const markdown = syncMarkdownTitle(rawMarkdown, title);
  const quality = evaluateArticleQuality({
    title,
    category: topic.category,
    markdown,
    contentBrief,
    factPack
  });
  const editorialVoice = evaluateEditorialVoice({
    markdown,
    articleType: contentBrief.articleType,
    factPack
  });

  return {
    article: {
      id: articleId,
      topicId: topic.id,
      title,
      summary: `${title}：面向${topic.audience}的可执行方法。`,
      status: "review",
      contentPath,
      coverPath,
      qualityScore: quality.score,
      riskScore: topic.risk,
      experimentTag: topic.experimentTag,
      estimatedCost: topic.estimatedCost,
      estimatedRevenue: topic.expectedRevenue,
      createdAt: now.toISOString(),
      contentBrief,
      factPack,
      qualityAssessment: {
        ...quality,
        evaluatedAt: now.toISOString()
      },
      editorialVoiceAssessment: {
        ...editorialVoice,
        evaluatedAt: now.toISOString()
      }
    },
    markdown
  };
}

function formatTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return [
    value("year"),
    value("month"),
    value("day"),
    value("hour"),
    value("minute"),
    value("second")
  ].join("");
}
