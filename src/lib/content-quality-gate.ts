import type { ArticleFact, ContentBrief, ContentQualityDimensions } from "./domain";

export interface ArticleQualityInput {
  title: string;
  category?: string;
  markdown: string;
  contentBrief?: ContentBrief;
  factPack?: ArticleFact[];
}

export interface ArticleQualityResult {
  passed: boolean;
  score: number;
  dimensions: ContentQualityDimensions;
  reasons: string[];
  hardBlockReasons: string[];
}

const SAFE_DOMAIN_KEYWORDS = [
  "ai", "agent", "自动化", "效率", "工具", "工作流", "生产力", "内容运营", "创作者", "副业", "增长", "saas", "nas",
  "教程", "复盘", "数据分析", "生活", "家庭", "家务", "省钱", "消费", "职场", "情绪价值", "习惯", "整理", "清单",
  "学习", "教育", "高考", "志愿", "招生", "专业", "院校", "大学", "亲子", "关系", "旅行", "健康习惯", "公众号",
  "life", "family", "household", "home", "money-saving", "consumer", "workplace", "emotional value", "habits", "organization",
  "checklist", "learning", "education", "parenting", "relationship", "travel", "health habit", "public-account"
];

const SENSITIVE_PUBLIC_KEYWORDS = [
  "习近平", "总书记", "新华社", "党员", "中央", "国务院", "外交", "外交部", "政治局", "全国人大", "人大代表", "人大常委", "人民代表大会", "政协", "党政", "选举", "台湾",
  "中美", "俄乌", "战争", "军事", "刑事", "命案", "灾难", "事故", "疫情", "暴雨", "台风", "洪水", "防汛", "汛情", "地震", "火灾", "泥石流", "山体滑坡", "积水", "施救", "救援", "被困", "失联", "遇难", "死亡", "坠亡", "爆炸", "坍塌"
];

const INTERNAL_ONLY_PATTERNS = [
  /##\s*收益假设/i,
  /##\s*审阅提示/i,
  /预估收益\s*[:：]?\s*\d+/i,
  /预计收益\s*[:：]?\s*\d+/i,
  /estimated\s+revenue/i,
  /risk\s*score/i,
  /质量分/i,
  /风险分/i,
  /发布前建议人工/i
];

const HARD_PROMISE_PATTERNS = [
  /保证.*收益/,
  /稳赚/,
  /躺赚/,
  /日入\s*\d+/,
  /月入\s*\d+/,
  /\d+\s*CNY/,
  /\d+\s*元收益/
];

const HIGH_STAKES_PATTERN = /高考|志愿|招生|专业录取|录取|退档|取消资格|分数线|投档线|选考|选科|医疗|医学|药品|金融|投资|指数|大跌|暴跌|涨停|跌停|A股|基金|理财|黄金|汇率|期货|债券|币圈|法律|法规|政策|就业率|薪资/i;
const UNSUPPORTED_STAT_PATTERNS = [
  /\d+(?:\.\d+)?\s*%/,
  /(?:数据|调查|研究|报告)\s*(?:显示|表明|指出|认为)/,
  /(?:就业率|录取率|升学率|转化率|满意率)\D{0,8}\d+/
];
const CLICHE_OPENING_PATTERN = /^(?:随着.{0,12}(?:发展|变化)|近年来|在当今社会|众所周知|随着时代)/;

function includesAny(text: string, keywords: string[]): string[] {
  const normalized = text.toLowerCase();
  return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()));
}

function countChineseChars(text: string): number {
  return (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
}

function headingCount(markdown: string): number {
  return markdown.split(/\r?\n/).filter((line) => /^#{1,3}\s+/.test(line.trim())).length;
}

function listItemCount(markdown: string): number {
  return markdown.split(/\r?\n/).filter((line) => /^\s*(?:[-*]|\d+\.)\s+/.test(line)).length;
}

function openingParagraph(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && !line.startsWith(">") && !/^[-*]\s+/.test(line) && !/^\d+\.\s+/.test(line)) ?? "";
}

function factualReliability(input: ArticleQualityInput, text: string, addHardBlock: (reason: string) => void): number {
  const facts = input.factPack ?? [];
  const verifiedFacts = facts.filter((fact) => fact.verificationStatus === "verified");
  const verifiedOfficialFacts = verifiedFacts.filter((fact) => fact.sourceType === "official");
  const highStakes = input.contentBrief?.articleType === "professional_analysis"
    || HIGH_STAKES_PATTERN.test(`${input.title}\n${input.category ?? ""}`);

  if (highStakes && verifiedOfficialFacts.length === 0) {
    addHardBlock("高影响主题缺少已核验的官方事实素材，不能进入微信草稿。");
    return 0;
  }

  const unsupportedStatistics = UNSUPPORTED_STAT_PATTERNS.some((pattern) => pattern.test(text));
  if (unsupportedStatistics && verifiedFacts.length === 0) {
    addHardBlock("正文包含没有事实素材支持的统计数字或研究结论。");
    return 4;
  }

  if (highStakes) return 20;
  if (verifiedFacts.length > 0) return 20;
  if (facts.some((fact) => fact.verificationStatus === "needs_review")) return 12;
  return 16;
}

export function evaluateArticleQuality(input: ArticleQualityInput): ArticleQualityResult {
  const text = `${input.title}\n${input.category ?? ""}\n${input.markdown}`;
  const reasons: string[] = [];
  const hardBlockReasons: string[] = [];
  const addReason = (reason: string) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };
  const addHardBlock = (reason: string) => {
    addReason(reason);
    if (!hardBlockReasons.includes(reason)) hardBlockReasons.push(reason);
  };

  const safeMatches = includesAny(text, SAFE_DOMAIN_KEYWORDS);
  let readerFit = input.contentBrief?.audience && input.contentBrief.readerProblem && input.contentBrief.corePromise ? 20 : 18;
  if (safeMatches.length === 0) {
    readerFit = Math.min(readerFit, 8);
    addReason("选题不在当前实验允许的低风险商业、教育、工具、效率或生活内容域内。");
  }
  if (/浅谈|关于.+的思考|情况分析|综合分析/.test(input.title)) {
    readerFit = Math.min(readerFit, 12);
    addReason("标题过于抽象，没有明确读者问题或阅读收益。");
  }

  const chineseChars = countChineseChars(input.markdown);
  let informationDensity = 20;
  if (chineseChars < 300) informationDensity = 4;
  else if (chineseChars < 450) informationDensity = 8;
  else if (chineseChars < 650) informationDensity = 15;
  else if (chineseChars < 900) informationDensity = 18;
  if (chineseChars < 450) addReason(`正文有效中文内容过短：${chineseChars} 字。`);

  let factualReliabilityScore = factualReliability(input, text, addHardBlock);

  const headings = headingCount(input.markdown);
  const items = listItemCount(input.markdown);
  let structureReadability = 15;
  if (headings < 3 || items < 3) {
    structureReadability = headings >= 3 || items >= 3 ? 10 : 5;
    addReason("结构不够可执行，至少需要多个清晰小节和步骤或清单。");
  }

  const opening = openingParagraph(input.markdown);
  let headlineOpening = 10;
  if (input.title.trim().length < 8 || opening.length < 45 || CLICHE_OPENING_PATTERN.test(opening)) {
    headlineOpening = 6;
    addReason("标题或开头没有快速进入具体读者场景。");
  }

  let uniquePerspective = input.contentBrief?.angle ? 10 : 8;
  if (!input.contentBrief?.angle && !/不是|而是|先|避免|区别|适合|取舍|边界/.test(input.markdown)) {
    uniquePerspective = 5;
    addReason("文章缺少明确角度，容易变成通用信息汇总。");
  }

  const ending = input.markdown.slice(-400);
  let ctaNaturalness = /今天|先做|试试|行动|清单|打开|写下|记录|再决定/.test(ending) ? 5 : 2;
  if (ctaNaturalness < 5) addReason("结尾缺少低门槛、非强迫式的下一步行动。");

  const sensitiveMatches = includesAny(text, SENSITIVE_PUBLIC_KEYWORDS);
  if (sensitiveMatches.length > 0) {
    readerFit = 0;
    factualReliabilityScore = 0;
    addHardBlock(`包含敏感公共/政治或高风险热点词：${sensitiveMatches.slice(0, 5).join("、")}`);
  }

  if (INTERNAL_ONLY_PATTERNS.some((pattern) => pattern.test(text))) {
    readerFit = 0;
    uniquePerspective = 0;
    addHardBlock("包含内部评估、审阅提示或系统运营字段，不能进入微信草稿。");
  }

  if (HARD_PROMISE_PATTERNS.some((pattern) => pattern.test(text))) {
    factualReliabilityScore = 0;
    ctaNaturalness = 0;
    addHardBlock("包含收益承诺、硬收益数字或不适合公开发布的收益表述。");
  }

  if (/公众号运营者该怎么判断机会|机会判断|热点评估/.test(input.title) && sensitiveMatches.length > 0) {
    headlineOpening = 0;
    addHardBlock("标题像内部选题判断稿，不像可直接发布的读者价值稿。");
  }

  const dimensions: ContentQualityDimensions = {
    readerFit,
    informationDensity,
    factualReliability: factualReliabilityScore,
    structureReadability,
    headlineOpening,
    uniquePerspective,
    ctaNaturalness
  };
  const score = Object.values(dimensions).reduce((sum, value) => sum + value, 0);

  return {
    passed: hardBlockReasons.length === 0 && score >= 80,
    score,
    dimensions,
    reasons,
    hardBlockReasons
  };
}
