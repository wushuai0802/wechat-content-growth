import type { ArticleContentType, ContentBrief, ContentPrimaryGoal, TopicCandidate } from "./domain";

const professionalAnalysisPattern = /高考|志愿|招生|专业|院校|大学|课程|就业方向|major|admission/i;
const decisionPattern = /购买|该不该|怎么选|选择|对比|决策|避坑|指南|值不值|buy|buyer|compare|decision|guide/i;
const howToPattern = /教程|步骤|流程|清单|方法|工作流|如何|怎么做|how\s*to|workflow|playbook|tutorial/i;
const caseStoryPattern = /案例|故事|经历|复盘|实验|case|story|review/i;

function articleTypeFor(topic: TopicCandidate): ArticleContentType {
  const text = `${topic.title}\n${topic.category}\n${topic.angle}`;
  if (professionalAnalysisPattern.test(text)) return "professional_analysis";
  if (decisionPattern.test(text)) return "decision_guide";
  if (howToPattern.test(text)) return "how_to";
  if (caseStoryPattern.test(text)) return "case_story";
  return topic.source === "hot" ? "hot_explainer" : "how_to";
}

function primaryGoalFor(topic: TopicCandidate, articleType: ArticleContentType): ContentPrimaryGoal {
  if (topic.contentStrategy === "convert") return "convert";
  if (topic.contentStrategy === "manufacture") return "trust";
  if (articleType === "hot_explainer") return "share";
  if (articleType === "case_story") return "trust";
  return "save";
}

function corePromiseFor(topic: TopicCandidate, articleType: ArticleContentType): string {
  const prefix = `帮助${topic.audience}`;
  switch (articleType) {
    case "decision_guide":
      return `${prefix}用清晰的比较维度做出适合自己的选择`;
    case "professional_analysis":
      return `${prefix}看懂关键差异、适配条件和现实边界`;
    case "hot_explainer":
      return `${prefix}判断热点与自身的关系，并找到下一步行动`;
    case "case_story":
      return `${prefix}从真实决策过程里提炼可复用的方法`;
    default:
      return `${prefix}按低门槛步骤完成一次可验证的实践`;
  }
}

function callToActionFor(topic: TopicCandidate, articleType: ArticleContentType): string {
  if (topic.contentStrategy === "convert") {
    return "先核对适用条件、总成本和替代方案，再选择最匹配的一项；涉及推广时以明确披露为准";
  }
  if (topic.contentStrategy === "manufacture") {
    return "先查看样本、方法和原始记录，再用同一套指标复核自己的场景";
  }
  if (articleType === "decision_guide" || articleType === "professional_analysis") {
    return "先列出三个不能妥协的条件，再用文章中的维度逐项比较";
  }
  if (articleType === "hot_explainer") {
    return "先判断这件事是否影响自己，再选择一个最小行动";
  }
  if (articleType === "case_story") {
    return "写下自己正在面对的相似问题，并复用其中一个判断方法";
  }
  return "今天只完成第一步，并记录结果是否真的有帮助";
}

function mustAvoidFor(topic: TopicCandidate, articleType: ArticleContentType): string[] {
  const items = ["编造数据、来源或真实案例", "承诺收益或确定性结果", "输出内部评分、成本或审阅字段"];
  if (articleType === "professional_analysis" || professionalAnalysisPattern.test(`${topic.title}\n${topic.category}`)) {
    items.push("保证录取结果", "承诺就业、薪资或职业前景", "混用不同年份或地区的招生政策");
  }
  if (topic.contentStrategy === "convert") {
    items.push("隐瞒推广或返佣关系", "制造虚假稀缺、倒计时或确定性承诺");
  }
  if (topic.contentStrategy === "manufacture") {
    items.push("把未完成的实测写成已经发生", "隐藏样本、方法或不利结果");
  }
  return items;
}

export function buildContentBrief(topic: TopicCandidate): ContentBrief {
  if (topic.contentBrief) {
    return { ...topic.contentBrief, mustAvoid: [...topic.contentBrief.mustAvoid] };
  }

  const articleType = articleTypeFor(topic);
  return {
    primaryGoal: primaryGoalFor(topic, articleType),
    articleType,
    audience: topic.audience,
    readerProblem: `正在面对“${topic.angle}”问题，但缺少适合自身场景的判断依据和行动顺序`,
    corePromise: corePromiseFor(topic, articleType),
    angle: topic.angle,
    callToAction: callToActionFor(topic, articleType),
    mustAvoid: mustAvoidFor(topic, articleType)
  };
}
