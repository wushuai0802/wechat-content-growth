import { describe, expect, it } from "vitest";
import { evaluateEditorialVoice } from "./editorial-voice-gate";

describe("evaluateEditorialVoice", () => {
  it("flags a symmetrical checklist with no author judgment", () => {
    const markdown = [
      "# 标题",
      "",
      "## 四个步骤",
      "",
      "第一步，先把信息收集起来，再逐项核对。",
      "",
      "第二步，列出预算、时间和使用频率。",
      "",
      "第三步，对照不同选择的优点和缺点。",
      "",
      "第四步，记录结果并及时调整方向。",
      "",
      "真正重要的不是立刻得到答案，而是找到适合自己的选择。"
    ].join("\n");

    const result = evaluateEditorialVoice({ markdown, articleType: "decision_guide" });

    expect(result.passed).toBe(false);
    expect(result.metrics.formulaicEnumerationCount).toBe(4);
    expect(result.metrics.explicitStanceCount).toBe(0);
    expect(result.reasons).toContain("连续编号结构偏多，缺少自然展开。");
  });

  it("passes varied editorial prose with sources, stance, and a restrained ending", () => {
    const markdown = [
      "# 标题",
      "",
      "周二晚上，产品群里突然刷了十几条同一个链接。大家问的不是功能，而是：这东西到底会不会把现有流程掀翻？",
      "",
      "短答案：不会。",
      "",
      "## 热闹先放一边",
      "",
      "据[官方更新说明](https://example.com/update)，这次变化只覆盖两个明确场景，离‘全面替代’还远。我的判断是，真正值得盯住的是原来要来回复制三次的那段工作。它不性感，但天天折磨人。",
      "",
      "我刚才说得有点绝对。对资料非常零散的小团队，这次更新仍可能省掉一轮人工确认；但有个例外：来源混乱时，自动化只会把错误搬得更快。",
      "",
      "## 我会怎么试",
      "",
      "先挑一份不重要的旧材料。跑一遍，故意塞进去一个日期冲突，再看它会不会提醒你。这个动作也就十来分钟，却比收藏五篇教程管用得多，因为你马上能看到边界在哪里，哪里还得靠人盯着。",
      "",
      "能过这一关，再往正式流程里放。过不了，就关掉。"
    ].join("\n");

    const result = evaluateEditorialVoice({ markdown, articleType: "hot_explainer" });

    expect(result.passed).toBe(true);
    expect(result.metrics.explicitStanceCount).toBeGreaterThan(0);
    expect(result.metrics.qualificationCount).toBeGreaterThan(0);
    expect(result.metrics.sourceAnchorCount).toBeGreaterThan(0);
  });

  it("does not mistake the character in 数据 for an attributed source", () => {
    const result = evaluateEditorialVoice({
      markdown: "# 标题\n\n## 正文\n\n把数据整理好，再看流程哪里出了问题。",
      articleType: "decision_guide"
    });

    expect(result.metrics.sourceAnchorCount).toBe(0);
  });
});
