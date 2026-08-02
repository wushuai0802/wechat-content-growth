import { describe, expect, it } from "vitest";
import { DEFAULT_WECHAT_AUTHOR } from "./wechat-publisher";
import {
  CONTENT_EXPERIMENT_POLICY,
  getInitialContentShapePrior,
  validateDraftEnvelope
} from "./content-experiment-policy";

describe("content experiment policy", () => {
  it("fixes non-learnable publication defaults from recent draft corrections", () => {
    expect(CONTENT_EXPERIMENT_POLICY.author).toBe(DEFAULT_WECHAT_AUTHOR);
    expect(CONTENT_EXPERIMENT_POLICY.visual.targetWidth).toBe(1200);
    expect(CONTENT_EXPERIMENT_POLICY.visual.targetHeight).toBe(510);
    expect(CONTENT_EXPERIMENT_POLICY.visual.aspectRatio).toBeCloseTo(1200 / 510, 3);
    expect(CONTENT_EXPERIMENT_POLICY.learnableKnobs).toEqual(expect.arrayContaining([
      "topic",
      "angle",
      "wordCount",
      "imageDensity",
      "imagePlacement",
      "coverStyle",
      "publishTiming"
    ]));
  });

  it("flags the exact mistakes found in WeChat drafts", () => {
    const result = validateDraftEnvelope({
      title: "AI不是给高手用的：普通人少走弯路的上手清单",
      author: "content-growth",
      headingTitles: ["AI不是给高手用的：普通人少走弯路的上手清单", "先从一件小事开始"],
      imageAlts: ["从一件烦心小事开始试用 AI", "从一件烦心小事开始试用 AI"],
      imageRatios: [1.5]
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.stringContaining("author"),
      expect.stringContaining("duplicate image"),
      expect.stringContaining("title repeated")
    ]));
  });

  it("keeps early priors flexible so real outcomes can tune them", () => {
    const prior = getInitialContentShapePrior();

    expect(prior.wordCount.kind).toBe("learnable-range");
    expect(prior.inlineImages.kind).toBe("content-need");
    expect(prior.inlineImages.hardLimit).toBeNull();
    expect(prior.optimizationObjective).toBe("maximize_net_profit");
  });
});
