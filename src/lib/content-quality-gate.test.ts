import { describe, expect, it } from "vitest";
import { buildContentBrief } from "./content-brief";
import type { ArticleFact, TopicCandidate } from "./domain";
import { evaluateArticleQuality } from "./content-quality-gate";

function gaokaoTopic(): TopicCandidate {
  return {
    id: "topic-gaokao",
    title: "安徽高考热门专业怎么选",
    source: "evergreen",
    category: "高考志愿",
    audience: "安徽考生和家长",
    angle: "比较课程要求、个人适配和就业边界",
    status: "candidate",
    expectedRevenue: 100,
    timeliness: 80,
    accountFit: 90,
    historicalSimilarity: 60,
    risk: 20,
    estimatedCost: 20,
    saturation: 40,
    createdAt: "2026-07-13T00:00:00.000Z"
  };
}

function gaokaoMarkdown(): string {
  return [
    "# 安徽高考热门专业怎么选：先看课程，再谈就业",
    "",
    "填志愿时，很多家庭会先搜热门专业，再看别人说好不好就业。真正做决定时，却常常不知道课程学什么、孩子是否适合、不同学校培养方向有什么差异。先把这些问题拆开，比追一个简单排名更有用。",
    "",
    "## 先核对当年的官方要求",
    "选择专业前，要回到当年的招生章程和专业选考要求。年份、地区、批次和院校不同，信息不能直接混用。本文只提供比较方法，不替代官方文件。",
    "",
    "## 再看课程和能力是否匹配",
    "1. 找到专业培养方案，查看基础课和核心课。",
    "2. 区分自己是喜欢某个职业名称，还是愿意长期学习相关课程。",
    "3. 把数学、实验、表达、阅读和动手要求逐项比较。",
    "4. 遇到不清楚的信息，记下问题并向学校招生部门核对。",
    "",
    "## 就业信息要看边界",
    "专业名称不能直接等同于某一份工作。行业变化、城市、学历、实习和个人能力都会影响结果。可以了解常见方向，但不要把个别人的经历当成确定承诺。",
    "",
    "## 做一张家庭比较表",
    "把感兴趣的专业放在同一张表里，统一记录课程、能力要求、院校差异、深造方向和仍需核实的问题。讨论时只比较同一维度，减少被单一口号带着走。",
    "",
    "## 今天先做一件小事",
    "先选三个专业，分别打开学校官方培养方案和当年招生章程。每个专业写下一条吸引你的地方、一条可能不适合的地方，以及一个还要向学校核对的问题。"
  ].join("\n");
}

describe("evaluateArticleQuality", () => {
  it("accepts broad non-AI public-account drafts with actionable life value", () => {
    const markdown = [
      "# 家里东西越买越多？周末用一张清单先止住重复消费",
      "",
      "你有没有发现，家里明明还有洗衣液、纸巾、数据线，可是一到促销就又顺手下单。最后柜子越来越满，钱也花得不清不楚。这个问题不需要复杂工具，先用一个周末把常用物品看清楚就够了。",
      "",
      "## 先从最容易重复买的东西开始",
      "不要一上来整理全屋。先选三类：清洁用品、厨房消耗品、充电线和小配件。它们最容易被忘记，也最容易在促销时重复买。",
      "",
      "## 做一张不会让人崩溃的家庭库存表",
      "1. 每类只记录名称、数量、放在哪里。",
      "2. 不追求精确到克，只判断够不够用。",
      "3. 把快用完和半年都用不完分开标记。",
      "4. 下次购物前先看这张表。",
      "",
      "## 最容易踩的坑",
      "不要为了整理又买一堆收纳盒。先把已有物品看清楚，再决定要不要收纳。也不要把库存表做得太复杂，越复杂越容易坚持不下去。",
      "",
      "## 今天就能做的小动作",
      "打开一个备忘录，写下家里三类最常重复购买的东西。每类拍一张柜子照片，购物前先翻一下。这个动作很小，但能让你少一点冲动消费，也少一点家里越堆越乱的烦躁。",
      "",
      "如果你愿意再往前走一步，可以把家里的常用物品分成三种状态：够用、快没了、太多了。够用的东西不用管，快没了的东西放进下次采购清单，太多了的东西先暂停购买一个月。这个方法不需要强迫自己断舍离，也不需要一次整理到完美，它只是帮你在付款前多一个提醒。很多家庭真正浪费的钱，不是花在大件上，而是花在一次又一次忘记自己已经买过的小东西上。"
    ].join("\n");

    const result = evaluateArticleQuality({
      title: "家里东西越买越多？周末用一张清单先止住重复消费",
      category: "life money-saving family organization",
      markdown
    });

    expect(result.reasons).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.dimensions).toEqual(expect.objectContaining({
      readerFit: expect.any(Number),
      informationDensity: expect.any(Number),
      factualReliability: expect.any(Number),
      structureReadability: expect.any(Number),
      headlineOpening: expect.any(Number),
      uniquePerspective: expect.any(Number),
      ctaNaturalness: expect.any(Number)
    }));
    expect(Object.values(result.dimensions).reduce((sum, value) => sum + value, 0)).toBe(result.score);
  });

  it("rejects public political hotspot drafts with internal revenue assumptions", () => {
    const result = evaluateArticleQuality({
      title: "习近平给新华社老党员张连生回信：公众号运营者该怎么判断机会",
      category: "新闻",
      markdown: [
        "# 习近平给新华社老党员张连生回信：公众号运营者该怎么判断机会",
        "",
        "## 正文草稿",
        "这类公共政治热点不适合作为收益实验草稿。",
        "",
        "## 收益假设",
        "本选题预估收益 636 CNY，预估成本 36 CNY。",
        "",
        "## 审阅提示",
        "发布前建议人工检查。"
      ].join("\n")
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      expect.stringContaining("敏感公共/政治"),
      expect.stringContaining("内部"),
      expect.stringContaining("收益")
    ]));
  });

  it("does not confuse an ordinary phrase containing 人大 with a political topic", () => {
    const safe = evaluateArticleQuality({
      title: "AI行业高薪讨论刷屏，普通人先算清转行成本",
      category: "career",
      markdown: "# AI行业高薪讨论刷屏，普通人先算清转行成本\n\n很多人看到抢人大战就容易焦虑。\n\n## 先看能力\n写下自己已经具备的经验。\n\n## 再做验证\n用一个小项目检查是否适合。"
    });
    const political = evaluateArticleQuality({
      title: "全国人大相关热点",
      category: "新闻",
      markdown: "# 全国人大相关热点\n\n## 正文\n这是一段公共政治热点内容。"
    });

    expect(safe.hardBlockReasons.some((reason) => reason.includes("敏感公共/政治"))).toBe(false);
    expect(political.hardBlockReasons.some((reason) => reason.includes("敏感公共/政治"))).toBe(true);
  });

  it("hard-blocks disaster hotspot drafts even when they contain lifestyle advice", () => {
    const result = evaluateArticleQuality({
      title: "台风暴雨来临前，家庭物资怎么准备",
      category: "生活清单",
      markdown: "# 台风暴雨来临前，家庭物资怎么准备\n\n## 准备事项\n1. 检查家中物品。\n2. 记录缺少内容。\n3. 今天先做一次清单。"
    });

    expect(result.passed).toBe(false);
    expect(result.hardBlockReasons.some((reason) => reason.includes("台风") || reason.includes("暴雨"))).toBe(true);
  });

  it("hard-blocks rescue hotspot drafts that evade generic disaster words", () => {
    const result = evaluateArticleQuality({
      title: "沈阳一男子倒在积水中多人施救",
      category: "实时热点",
      markdown: "# 沈阳一男子倒在积水中多人施救\n\n## 现场\n多人参与施救。\n\n## 提醒\n今天先记录信息来源，不传播未经核验的细节。"
    });

    expect(result.passed).toBe(false);
    expect(result.hardBlockReasons.some((reason) => reason.includes("积水") || reason.includes("施救"))).toBe(true);
  });

  it.each(["中山大学取消录取资格", "三大指数集体大跌"])(
    "requires an official fact for newly recognized high-stakes topic: %s",
    (title) => {
      const result = evaluateArticleQuality({
        title,
        category: "实时热点",
        markdown: `# ${title}\n\n## 发生了什么\n这是一段没有官方事实素材支持的分析。\n\n## 今天怎么做\n1. 先核对来源。\n2. 写下需要确认的问题。\n3. 再决定是否行动。`
      });

      expect(result.passed).toBe(false);
      expect(result.hardBlockReasons.some((reason) => reason.includes("官方事实"))).toBe(true);
    }
  );

  it("accepts a safe actionable AI productivity draft", () => {
    const markdown = [
      "# 用 AI 自动整理会议纪要：一套 20 分钟可落地流程",
      "",
      "很多知识工作者的问题不是不会记录，而是会议结束后没有稳定的整理流程。下面这套方法适合团队先小范围试用。",
      "",
      "## 适用场景",
      "当会议包含明确决策、待办事项和跨部门协作时，可以用这套流程减少重复整理。",
      "",
      "## 操作步骤",
      "1. 会前准备统一模板，包含议题、决策、负责人和截止时间。",
      "2. 会后把录音转写内容交给 AI 提取结构化事项。",
      "3. 人工核对关键事实，再同步到任务系统。",
      "4. 每周复盘一次，删除没有带来效率提升的步骤。",
      "",
      "## 注意事项",
      "不要上传包含客户隐私、合同金额或未公开业务信息的材料。先从低风险会议开始测试。第一次使用时，可以只处理一段公开会议材料或模拟文本，确认输出结构稳定后，再接入真实工作场景。对于涉及客户、财务、人事和战略的信息，应该默认不上传，除非已经完成脱敏和权限确认。AI 的作用是帮助整理，不是替你承担判断责任。",
      "",
      "## 复盘指标",
      "记录整理耗时、遗漏事项数量、参与者反馈和后续任务完成率。连续三次复盘后，再决定是否扩大使用。不要只看单次节省了几分钟，而要观察它是否稳定减少返工、是否让团队更愿意同步信息、是否降低了后续沟通成本。如果结果不稳定，就把流程退回到更小的任务上继续测试。真正值得保留的 AI 工作流，应该让人更快进入判断和行动，而不是制造更多需要解释的材料。"
    ].join("\n");

    const result = evaluateArticleQuality({
      title: "用 AI 自动整理会议纪要：一套 20 分钟可落地流程",
      category: "AI tools",
      markdown
    });

    expect(result.reasons).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("rejects drafts that expose reviewer-only sections", () => {
    const result = evaluateArticleQuality({
      title: "AI 内容工作流如何做周复盘",
      category: "AI tools",
      markdown: [
        "# AI 内容工作流如何做周复盘",
        "",
        "## 正文",
        "这是一篇面向创作者的复盘文章，内容较长但仍包含内部说明。",
        "",
        "## 审阅提示",
        "请检查是否符合账号定位。"
      ].join("\n")
    });

    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("内部"))).toBe(true);
    expect(result.hardBlockReasons.some((reason) => reason.includes("内部"))).toBe(true);
  });

  it("hard-blocks high-stakes education analysis without a verified official fact", () => {
    const topic = gaokaoTopic();
    const result = evaluateArticleQuality({
      title: topic.title,
      category: topic.category,
      markdown: gaokaoMarkdown(),
      contentBrief: buildContentBrief(topic),
      factPack: []
    });

    expect(result.passed).toBe(false);
    expect(result.dimensions.factualReliability).toBe(0);
    expect(result.hardBlockReasons.some((reason) => reason.includes("官方事实"))).toBe(true);
  });

  it("treats the professional analysis article type as high-stakes even without gaokao keywords", () => {
    const topic = gaokaoTopic();
    const brief = { ...buildContentBrief(topic), articleType: "professional_analysis" as const };
    const result = evaluateArticleQuality({
      title: "软件工程方向的课程与能力要求",
      category: "education",
      markdown: gaokaoMarkdown().replaceAll("高考", "升学").replaceAll("招生", "院校"),
      contentBrief: brief,
      factPack: []
    });

    expect(result.passed).toBe(false);
    expect(result.hardBlockReasons.some((reason) => reason.includes("官方事实"))).toBe(true);
  });

  it("accepts high-stakes education analysis when an official fact is verified", () => {
    const topic = gaokaoTopic();
    const fact: ArticleFact = {
      id: "fact-official",
      claim: "考生应以当年高校招生章程和选考科目要求为准",
      sourceName: "安徽省教育招生考试院",
      sourceType: "official",
      verificationStatus: "verified",
      sourceUrl: "https://www.ahzsks.cn/",
      publishedAt: "2026-06-01",
      applicableRegion: "安徽"
    };
    const result = evaluateArticleQuality({
      title: topic.title,
      category: topic.category,
      markdown: `${gaokaoMarkdown()}\n\n来源：[安徽省教育招生考试院](${fact.sourceUrl})`,
      contentBrief: buildContentBrief(topic),
      factPack: [fact]
    });

    expect(result.hardBlockReasons).toEqual([]);
    expect(result.dimensions.factualReliability).toBe(20);
    expect(result.passed).toBe(true);
  });

  it("hard-blocks unsupported statistics even for an otherwise safe topic", () => {
    const markdown = `${gaokaoMarkdown().replaceAll("高考", "学习").replaceAll("招生", "课程")}\n\n研究显示，使用这套方法的人满意率达到 97%。`;
    const result = evaluateArticleQuality({
      title: "学习方向怎么选",
      category: "learning",
      markdown
    });

    expect(result.passed).toBe(false);
    expect(result.dimensions.factualReliability).toBeLessThanOrEqual(4);
    expect(result.hardBlockReasons.some((reason) => reason.includes("统计"))).toBe(true);
  });
});
