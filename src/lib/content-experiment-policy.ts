import { DEFAULT_WECHAT_AUTHOR } from "./wechat-publisher";

export type LearnableContentKnob =
  | "topic"
  | "angle"
  | "wordCount"
  | "imageDensity"
  | "imagePlacement"
  | "coverStyle"
  | "publishTiming";

export interface DraftEnvelopeInput {
  title: string;
  author?: string;
  headingTitles?: string[];
  imageAlts?: string[];
  imageRatios?: Array<number | null | undefined>;
}

export interface DraftEnvelopeValidationResult {
  passed: boolean;
  issues: string[];
}

export const CONTENT_EXPERIMENT_POLICY = {
  objective: "maximize_net_profit",
  author: DEFAULT_WECHAT_AUTHOR,
  visual: {
    targetWidth: 1200,
    targetHeight: 510,
    aspectRatio: 1200 / 510,
    ratioTolerance: 0.08,
    forbidGenericReuse: true
  },
  nonLearnableGuards: [
    "author must stay fixed",
    "cover and inline visuals must be topic-specific",
    "do not repeat the article title as a section heading",
    "do not publish duplicated inline images",
    "do not expose internal revenue assumptions or review notes"
  ],
  learnableKnobs: [
    "topic",
    "angle",
    "wordCount",
    "imageDensity",
    "imagePlacement",
    "coverStyle",
    "publishTiming"
  ] satisfies LearnableContentKnob[]
} as const;

export function getInitialContentShapePrior() {
  return {
    optimizationObjective: CONTENT_EXPERIMENT_POLICY.objective,
    wordCount: {
      kind: "learnable-range" as const,
      initialMin: 900,
      initialMax: 1800,
      note: "Early WeChat drafts should favor readable mass-market length, then let outcomes tune the range."
    },
    inlineImages: {
      kind: "content-need" as const,
      hardLimit: null,
      initialCharsPerImage: 700,
      note: "Image count is decided by section need, with roughly one body image per 700 readable characters during exploration, then adjusted from reads, shares, favorites, revenue, and churn."
    },
    tone: {
      kind: "guardrail" as const,
      value: "mass-market, concrete, useful, not hardcore unless outcomes prove the niche pays"
    }
  };
}

export function validateDraftEnvelope(input: DraftEnvelopeInput): DraftEnvelopeValidationResult {
  const issues: string[] = [];
  const normalizedTitle = normalize(input.title);

  if ((input.author ?? "") !== CONTENT_EXPERIMENT_POLICY.author) {
    issues.push(`author must be ${CONTENT_EXPERIMENT_POLICY.author}`);
  }

  const normalizedHeadings = (input.headingTitles ?? []).map(normalize).filter(Boolean);
  if (normalizedHeadings.some((heading) => heading === normalizedTitle)) {
    issues.push("title repeated as a section heading");
  }

  const imageAlts = (input.imageAlts ?? []).map(normalize).filter(Boolean);
  if (new Set(imageAlts).size < imageAlts.length) {
    issues.push("duplicate image alt suggests duplicated inline image or generic visual reuse");
  }

  const targetRatio = CONTENT_EXPERIMENT_POLICY.visual.aspectRatio;
  const tolerance = CONTENT_EXPERIMENT_POLICY.visual.ratioTolerance;
  for (const ratio of input.imageRatios ?? []) {
    if (typeof ratio === "number" && Number.isFinite(ratio) && Math.abs(ratio - targetRatio) > tolerance) {
      issues.push(`image ratio ${round(ratio)} does not match WeChat-friendly ${CONTENT_EXPERIMENT_POLICY.visual.targetWidth}x${CONTENT_EXPERIMENT_POLICY.visual.targetHeight}`);
      break;
    }
  }

  return { passed: issues.length === 0, issues };
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
