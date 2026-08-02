import { describe, expect, it } from "vitest";
import type { ArticlePackage } from "./domain";
import { createArticleVisualPlan, estimateReadableChars, planArticleVisualSlots, planInlineVisualDensity } from "./article-visuals";

const article: ArticlePackage = {
  id: "article-visual-test",
  topicId: "topic-1",
  title: "Test article",
  summary: "Summary",
  status: "review",
  contentPath: "",
  coverPath: "D:/covers/article-visual-test.png",
  qualityScore: 80,
  riskScore: 10,
  estimatedCost: 1,
  estimatedRevenue: 2,
  createdAt: "2026-06-19T00:00:00.000Z"
};

function section(index: number, chars: number): string {
  return [`## Section ${index}`, "", "a".repeat(chars)].join("\n");
}

describe("article visual planning", () => {
  it("estimates readable text without markdown image noise", () => {
    const markdown = [
      "# Title",
      "",
      "## First",
      "",
      "hello world",
      "![visual](/tmp/image.png)",
      "- list item"
    ].join("\n");

    expect(estimateReadableChars(markdown)).toBe("TitleFirsthelloworldlistitem".length);
  });

  it("uses no inline images for very short articles", () => {
    const markdown = ["# Title", "", section(1, 300), "", section(2, 300)].join("\n");

    expect(planInlineVisualDensity(markdown).inlineImageCount).toBe(0);
  });

  it("uses one inline image for an early-stage short article", () => {
    const markdown = ["# Title", "", section(1, 450), "", section(2, 500), "", section(3, 100)].join("\n");

    const plan = planInlineVisualDensity(markdown);

    expect(plan.inlineImageCount).toBe(1);
    expect(plan.selectedHeadings).toEqual(["Section 1"]);
  });

  it("uses two inline images for a medium article with distinct sections", () => {
    const markdown = ["# Title", "", section(1, 500), "", section(2, 500), "", section(3, 500)].join("\n");

    const plan = planInlineVisualDensity(markdown);

    expect(plan.inlineImageCount).toBe(2);
    expect(plan.selectedHeadings).toEqual(["Section 1", "Section 3"]);
  });

  it("spreads two inline images across longer articles", () => {
    const markdown = ["# Title", "", section(1, 650), "", section(2, 650), "", section(3, 650)].join("\n");

    const plan = planInlineVisualDensity(markdown, { maxInlineImages: 2, minCharsPerInlineImage: 850 });

    expect(plan.inlineImageCount).toBe(2);
    expect(plan.selectedHeadings).toEqual(["Section 1", "Section 3"]);
  });

  it("keeps the cover slot while limiting inline slots by density", () => {
    const markdown = ["# Title", "", section(1, 500), "", section(2, 500)].join("\n");

    const slots = planArticleVisualSlots(article, markdown, { imageDir: "D:/tmp", maxInlineImages: 2, minCharsPerInlineImage: 850 });

    expect(slots).toHaveLength(2);
    expect(slots[0].anchorHeading).toBeUndefined();
    expect(slots[0].localPath).toBe(article.coverPath);
    expect(slots[0]).toMatchObject({
      role: "cover",
      targetWidth: 1200,
      targetHeight: 510,
      generationSize: "1536x1024"
    });
    expect(slots[0].prompt).toContain("no text");
    expect(slots[0].prompt).toContain("not flat vector");
    expect(slots[0].prompt).toContain("left 38%");
    expect(slots[1].anchorHeading).toBe("Section 1");
    expect(slots[1]).toMatchObject({
      role: "body",
      targetWidth: 1200,
      targetHeight: 800,
      generationSize: "1536x1024"
    });
  });

  it("grounds body prompts in the selected section content", () => {
    const markdown = [
      "# Title",
      "",
      "## Clear old files",
      "",
      "Open the phone photo album, chat downloads, recycle bin, and cloud sync folder.",
      "a".repeat(900),
      "",
      "## Another section",
      "",
      "b".repeat(900)
    ].join("\n");

    const slots = planArticleVisualSlots(article, markdown, {
      imageDir: "D:/tmp",
      maxInlineImages: 1,
      minCharsPerInlineImage: 850
    });

    expect(slots[1].prompt).toContain("Section scene cues: Open the phone photo album, chat downloads, recycle bin, and cloud sync folder.");
    expect(slots[1].prompt).toContain("do not repeat the cover scene or another body image");
  });

  it("creates a planned raster manifest without pretending assets exist", () => {
    const markdown = ["# Title", "", section(1, 900), "", section(2, 900)].join("\n");
    const plan = createArticleVisualPlan(article, markdown, new Date("2026-07-13T00:00:00.000Z"), {
      imageDir: "D:/tmp",
      maxInlineImages: 2,
      minCharsPerInlineImage: 850,
      model: "gpt-image-2"
    });

    expect(plan.status).toBe("planned");
    expect(plan.model).toBe("gpt-image-2");
    expect(plan.assets).toHaveLength(3);
    expect(plan.assets.every((asset) => asset.status === "planned")).toBe(true);
    expect(plan.assets.every((asset) => asset.source === "gpt-image-2")).toBe(true);
  });
});
