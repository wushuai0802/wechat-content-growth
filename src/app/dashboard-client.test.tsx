import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardClient } from "./dashboard-client";
import { createSeedWorkspace } from "@/lib/workspace-store";

describe("DashboardClient", () => {
  it("renders the AutoProfit controls", () => {
    const html = renderToStaticMarkup(<DashboardClient initialWorkspace={createSeedWorkspace()} />);

    expect(html).toContain("AutoProfit");
    expect(html).toContain("运行一次");
    expect(html).toContain("停止循环");
  });

  it("renders the daily autonomous run decision", () => {
    const html = renderToStaticMarkup(<DashboardClient initialWorkspace={createSeedWorkspace()} />);

    expect(html).toContain("今日计划");
    expect(html).toContain("AI 推荐生成篇数");
    expect(html).toContain("今日动作");
    expect(html).toContain("人工只发布");
  });

  it("renders candidate-pool maintenance status for long-running experiments", () => {
    const workspace = createSeedWorkspace();
    workspace.topics.push({
      ...workspace.topics[0],
      id: "topic-trend-baidu-test",
      title: "旧热点候选",
      category: "百度热搜",
      status: "rejected"
    });
    const html = renderToStaticMarkup(<DashboardClient initialWorkspace={workspace} />);

    expect(html).toContain("候选池维护");
    expect(html).toContain("已隔离旧热点");
    expect(html).toContain("旧热点候选");
  });

  it("does not render rejected topics as production candidates", () => {
    const workspace = createSeedWorkspace();
    workspace.topics = [
      {
        ...workspace.topics[0],
        id: "topic-rejected-visible-risk",
        title: "不该出现在生产候选里的旧热点",
        status: "rejected",
        expectedRevenue: 9999,
        risk: 1,
        saturation: 1
      },
      {
        ...workspace.topics[0],
        id: "topic-candidate-safe",
        title: "AI productivity checklist for beginners",
        status: "candidate",
        expectedRevenue: 400,
        risk: 10,
        saturation: 20
      }
    ];

    const html = renderToStaticMarkup(<DashboardClient initialWorkspace={workspace} />);

    expect(html).toContain("AI productivity checklist for beginners");
    expect(html).not.toContain("不该出现在生产候选里的旧热点");
  });

  it("renders long-run learning and service coverage signals", () => {
    const workspace = createSeedWorkspace();
    workspace.articleOutcomes = [
      {
        id: "outcome-1",
        articleId: workspace.articles[0].id,
        reads: 2300,
        shares: 18,
        favorites: 42,
        newFollowers: 27,
        unfollows: 2,
        revenue: 158,
        cost: 26,
        riskScore: 20,
        recordedAt: new Date().toISOString()
      }
    ];
    workspace.strategyLearning.articleRewards = [
      {
        articleId: workspace.articles[0].id,
        experimentTag: "workflow-playbook",
        reward: 386,
        netProfit: 132,
        trafficValue: 0,
        engagementValue: 0,
        followerValue: 0,
        modeledGrossValue: 158,
        riskPenalty: 0,
        followerPenalty: 0
      }
    ];
    const html = renderToStaticMarkup(<DashboardClient initialWorkspace={workspace} />);

    expect(html).toContain("学习闭环");
    expect(html).toContain("真实反馈");
    expect(html).toContain("服务保障");
    expect(html).toContain("计划任务 + 开机兜底");
  });

  it("does not present known demo outcomes as real feedback", () => {
    const workspace = createSeedWorkspace();
    workspace.costs = [];
    workspace.revenue = [];
    workspace.metrics = [];
    workspace.articleOutcomes = [
      {
        id: "outcome-article-1-20260618120000-0",
        articleId: "article-1",
        reads: 1200,
        shares: 30,
        favorites: 45,
        newFollowers: 12,
        unfollows: 1,
        revenue: 330,
        cost: 42,
        riskScore: 8,
        recordedAt: "2026-06-18T12:00:00.000Z"
      }
    ];
    workspace.strategyLearning = {
      sourceWeights: { hot: 1.9, evergreen: 1, series: 1, experimental: 1 },
      categoryWeights: { "百度热搜": 1.9 },
      experimentTagWeights: {},
      articleRewards: [
        {
          articleId: "article-1",
          reward: 449,
          netProfit: 288,
          trafficValue: 0,
          engagementValue: 0,
          followerValue: 0,
          modeledGrossValue: 330,
          riskPenalty: 16,
          followerPenalty: 0
        }
      ],
      updatedAt: "2026-06-18T12:05:00.000Z"
    };

    const html = renderToStaticMarkup(<DashboardClient initialWorkspace={workspace} />);

    expect(html).toContain("学习闭环");
    expect(html).toContain("等待真实导入");
    expect(html).toContain("0 条可靠结果 / 0 个可靠奖励样本");
    expect(html).not.toContain("真实反馈");
    expect(html).not.toContain("1 个奖励样本");
  });

  it("renders UI evolution as part of the profit experiment", () => {
    const html = renderToStaticMarkup(<DashboardClient initialWorkspace={createSeedWorkspace()} />);

    expect(html).toContain("界面进化");
    expect(html).toContain("操作成本");
    expect(html).toContain("发布前错漏");
  });
});
