import type { ArticleContentType, ArticleFact, EditorialVoiceMetrics } from "./domain";

export interface EditorialVoiceInput {
  markdown: string;
  articleType?: ArticleContentType;
  factPack?: ArticleFact[];
}

export interface EditorialVoiceResult {
  passed: boolean;
  score: number;
  metrics: EditorialVoiceMetrics;
  reasons: string[];
}

const TEMPLATE_PHRASES = [
  "首先", "其次", "再者", "综上所述", "总而言之", "总的来说", "综合来看", "由此可见", "不难发现",
  "值得注意的是", "需要指出的是", "不可否认", "毋庸置疑", "众所周知", "显而易见", "可以说",
  "从某种意义上说", "在此基础上", "与此同时", "不仅如此", "更重要的是"
];

const STANCE_PATTERNS = [
  /我的判断是/g,
  /我更(?:担心|在意|愿意|倾向)/g,
  /我不太(?:赞成|相信|认同)/g,
  /我觉得/g,
  /我认为/g,
  /在我看来/g,
  /说实话/g,
  /坦白说/g,
  /我会先/g,
  /我宁愿/g,
  /我不确定/g
];

const QUALIFICATION_PATTERNS = [
  /不对/g,
  /准确(?:地)?说/g,
  /刚才说得/g,
  /也不完全/g,
  /我也不确定/g,
  /算了/g,
  /扯远了/g,
  /说回正题/g,
  /但有个例外/g,
  /问题是/g,
  /话不能说满/g
];

const FORMULAIC_ENUMERATION_PATTERN = /^(?:第[一二三四五六七八九十](?:步|点|笔|个|条)|首先|其次|再者|最后)[，、：:。\s]/;
const FORMULAIC_ENDING_PATTERNS = [
  /总的来说/,
  /综上所述/,
  /真正.+不是.+而是/,
  /真正能留下的是/,
  /只要.+就(?:已经)?/,
  /今天先做一件小事/,
  /从现在开始/,
  /这次阅读就已经产生了价值/
];

function cleanInlineMarkdown(value: string): string {
  return value
    .replace(/<!--[^>]*-->/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readableParagraphs(markdown: string): string[] {
  return markdown
    .split(/\r?\n\s*\r?\n/)
    .map(cleanInlineMarkdown)
    .filter((paragraph) => paragraph && !/^#{1,6}\s/.test(paragraph) && !paragraph.startsWith("visual:"));
}

function sentenceLengths(paragraphs: string[]): number[] {
  return paragraphs
    .flatMap((paragraph) => paragraph.split(/[。！？!?；;]+/))
    .map((sentence) => sentence.replace(/\s+/g, "").length)
    .filter((length) => length > 0);
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function countPatternMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (text.match(pattern)?.length ?? 0), 0);
}

function sourceAnchorCount(markdown: string, factPack: ArticleFact[]): number {
  const verifiedSourceNames = factPack
    .filter((fact) => fact.verificationStatus === "verified")
    .filter((fact) => markdown.includes(fact.sourceName))
    .length;
  const markdownLinks = markdown.match(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g)?.length ?? 0;
  const attributedClaims = markdown.match(/(?:^|[，。；：:\s])(?:据|援引|来源[:：])[^，。\n]{2,24}/gm)?.length ?? 0;
  return verifiedSourceNames + markdownLinks + attributedClaims;
}

export function evaluateEditorialVoice(input: EditorialVoiceInput): EditorialVoiceResult {
  const paragraphs = readableParagraphs(input.markdown);
  const sentences = sentenceLengths(paragraphs);
  const paragraphLengths = paragraphs.map((paragraph) => paragraph.replace(/\s+/g, "").length);
  const text = paragraphs.join("\n");
  const ending = text.slice(-260);
  const templatePhraseCount = TEMPLATE_PHRASES.reduce(
    (count, phrase) => count + (text.split(phrase).length - 1),
    0
  );
  const formulaicEnumerationCount = paragraphs.filter((paragraph) => FORMULAIC_ENUMERATION_PATTERN.test(paragraph)).length;
  const explicitStanceCount = countPatternMatches(text, STANCE_PATTERNS);
  const qualificationCount = countPatternMatches(text, QUALIFICATION_PATTERNS);
  const formulaicEndingCount = FORMULAIC_ENDING_PATTERNS.filter((pattern) => pattern.test(ending)).length;
  const anchors = sourceAnchorCount(input.markdown, input.factPack ?? []);
  const metrics: EditorialVoiceMetrics = {
    sentenceLengthStdDev: Number(standardDeviation(sentences).toFixed(1)),
    paragraphLengthStdDev: Number(standardDeviation(paragraphLengths).toFixed(1)),
    shortSentenceCount: sentences.filter((length) => length <= 7).length,
    longSentenceCount: sentences.filter((length) => length >= 38).length,
    templatePhraseCount,
    formulaicEnumerationCount,
    explicitStanceCount,
    qualificationCount,
    sourceAnchorCount: anchors,
    formulaicEndingCount,
    paragraphCount: paragraphs.length,
    sentenceCount: sentences.length
  };

  let score = 100;
  const reasons: string[] = [];
  const penalize = (points: number, reason: string) => {
    score -= points;
    reasons.push(reason);
  };

  if (sentences.length >= 8) {
    if (metrics.sentenceLengthStdDev < 8) penalize(20, "句子长度过于均匀，读感像连续生成的标准答案。");
    else if (metrics.sentenceLengthStdDev < 13) penalize(10, "长短句落差不足，文章节奏偏平。");
    if (metrics.shortSentenceCount === 0 || metrics.longSentenceCount === 0) {
      penalize(10, "缺少极短句与长句的节奏对照。");
    }
  }

  if (paragraphs.length >= 6) {
    if (metrics.paragraphLengthStdDev < 18) penalize(15, "段落长度过于整齐，版面和语气都显得模板化。");
    else if (metrics.paragraphLengthStdDev < 30) penalize(8, "段落节奏变化不足。");
  }

  if (templatePhraseCount > 0) {
    penalize(Math.min(20, templatePhraseCount * 5), `命中 ${templatePhraseCount} 处常见 AI 连接或总结用语。`);
  }
  if (formulaicEnumerationCount >= 5) penalize(18, "编号式段落过多，全文像提纲展开。");
  else if (formulaicEnumerationCount >= 3) penalize(10, "连续编号结构偏多，缺少自然展开。");
  if (explicitStanceCount === 0) penalize(12, "缺少明确的作者判断，文章更像中立说明书。");
  if (qualificationCount === 0) penalize(8, "全文没有保留、修正或反向思考，结论过于完整。");
  if (formulaicEndingCount > 0) penalize(12, "结尾再次总结或升华，收束方式过于标准。");

  const needsSourceAnchor = input.articleType === "hot_explainer" || input.articleType === "case_story";
  if (anchors === 0) {
    penalize(needsSourceAnchor ? 15 : 6, needsSourceAnchor
      ? "热点或案例文章缺少正文中的具名来源锚点。"
      : "正文没有具名来源锚点，内容容易停留在通用建议。");
  }

  score = Math.max(0, Math.round(score));
  return {
    passed: score >= 78,
    score,
    metrics,
    reasons
  };
}
