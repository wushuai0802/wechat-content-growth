import { describe, expect, it } from "vitest";
import type { TopicCandidate } from "./domain";
import { buildContentBrief } from "./content-brief";

function topic(overrides?: Partial<TopicCandidate>): TopicCandidate {
  return {
    id: "topic-1",
    title: "618 后家用 NAS 价格变化：普通用户该不该入手",
    source: "hot",
    category: "consumer tech",
    audience: "数码消费人群",
    angle: "购买决策",
    status: "candidate",
    expectedRevenue: 430,
    timeliness: 82,
    accountFit: 81,
    historicalSimilarity: 71,
    risk: 22,
    estimatedCost: 50,
    saturation: 44,
    createdAt: "2026-07-13T00:00:00.000Z",
    ...overrides
  };
}

describe("buildContentBrief", () => {
  it("derives a decision guide focused on saves for purchase questions", () => {
    const brief = buildContentBrief(topic());

    expect(brief.articleType).toBe("decision_guide");
    expect(brief.primaryGoal).toBe("save");
    expect(brief.audience).toBe("数码消费人群");
    expect(brief.readerProblem).toContain("购买决策");
  });

  it("uses conversion as the single primary goal for commercial-intent topics", () => {
    const brief = buildContentBrief(topic({
      contentStrategy: "convert",
      primaryMonetizationChannel: "affiliate"
    }));

    expect(brief.articleType).toBe("decision_guide");
    expect(brief.primaryGoal).toBe("convert");
    expect(brief.callToAction).toContain("适用条件");
  });

  it("derives a professional analysis for gaokao major topics", () => {
    const brief = buildContentBrief(topic({
      title: "安徽高考热门专业怎么选",
      category: "高考志愿",
      audience: "安徽考生和家长",
      angle: "专业方向、课程和就业边界"
    }));

    expect(brief.articleType).toBe("professional_analysis");
    expect(brief.mustAvoid).toEqual(expect.arrayContaining([
      expect.stringContaining("录取"),
      expect.stringContaining("就业")
    ]));
  });

  it("preserves an explicit editorial brief", () => {
    const explicit = {
      primaryGoal: "trust" as const,
      articleType: "case_story" as const,
      audience: "首次填报志愿的家庭",
      readerProblem: "不知道怎样把兴趣和专业要求放在一起比较",
      corePromise: "提供一套家庭讨论框架",
      angle: "从一次家庭讨论的分歧切入",
      callToAction: "先列出三个不能妥协的条件",
      mustAvoid: ["替读者做决定"]
    };

    expect(buildContentBrief(topic({ contentBrief: explicit }))).toEqual(explicit);
  });
});
