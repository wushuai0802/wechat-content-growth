import { describe, expect, it } from "vitest";
import type { TopicCandidate } from "./domain";
import { getTopicEvidenceBlockers, isTopicEvidenceReady } from "./topic-evidence";

function manufactureTopic(patch: Partial<TopicCandidate> = {}): TopicCandidate {
  return {
    id: "topic-original-test",
    title: "我们按 5 个指标做一次原创实测",
    source: "experimental",
    category: "原创实测与排名",
    audience: "普通读者",
    angle: "公开样本和方法",
    status: "candidate",
    expectedRevenue: 800,
    timeliness: 60,
    accountFit: 80,
    historicalSimilarity: 40,
    risk: 10,
    estimatedCost: 50,
    saturation: 20,
    createdAt: "2026-07-13T00:00:00.000Z",
    contentStrategy: "manufacture",
    ...patch
  };
}

describe("topic evidence readiness", () => {
  it("blocks manufacture topics that only claim to be research-ready", () => {
    const topic = manufactureTopic({
      opportunityProfile: {
        strategy: "manufacture",
        growthRate: 60,
        remainingHalfLifeHours: 168,
        audienceOverlap: 80,
        contentSupplyGap: 80,
        monetizationIntent: 60,
        sharePotential: 75,
        productionLatencyHours: 18,
        policyRisk: 10,
        confidence: 70,
        evidenceReadiness: "ready",
        evidencePlan: ["完成原创实测"]
      }
    });

    expect(isTopicEvidenceReady(topic)).toBe(false);
    expect(getTopicEvidenceBlockers(topic)).toContain("manufacture_topic_requires_verified_evidence");
  });

  it("allows manufacture topics after verified evidence is attached", () => {
    const topic = manufactureTopic({
      opportunityProfile: {
        strategy: "manufacture",
        growthRate: 60,
        remainingHalfLifeHours: 168,
        audienceOverlap: 80,
        contentSupplyGap: 80,
        monetizationIntent: 60,
        sharePotential: 75,
        productionLatencyHours: 18,
        policyRisk: 10,
        confidence: 70,
        evidenceReadiness: "ready",
        evidencePlan: ["完成原创实测"]
      },
      factPack: [{
        id: "test-record",
        claim: "已完成 5 个工具的同任务实测并保存原始记录",
        sourceName: "编辑部原创实测记录",
        sourceType: "historical_data",
        verificationStatus: "verified"
      }]
    });

    expect(isTopicEvidenceReady(topic)).toBe(true);
  });
});
