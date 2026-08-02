import type { TopicCandidate } from "./domain";

export function getTopicEvidenceBlockers(topic: TopicCandidate): string[] {
  const blockers: string[] = [];
  const strategy = topic.contentStrategy ?? topic.opportunityProfile?.strategy;
  if (topic.opportunityProfile?.evidenceReadiness === "needs_research") {
    blockers.push("topic_evidence_research_incomplete");
  }
  if (strategy === "manufacture") {
    const hasVerifiedEvidence = (topic.factPack ?? []).some((fact) =>
      fact.verificationStatus === "verified"
      && ["historical_data", "official", "industry_source"].includes(fact.sourceType)
    );
    if (!hasVerifiedEvidence) blockers.push("manufacture_topic_requires_verified_evidence");
  }
  return [...new Set(blockers)];
}

export function isTopicEvidenceReady(topic: TopicCandidate): boolean {
  return getTopicEvidenceBlockers(topic).length === 0;
}
