import { describe, expect, it } from "vitest";
import { articles, strategySuggestions } from "./sample-data";
import { applyArticleAction, applySuggestionAction } from "./workflow";

describe("applyArticleAction", () => {
  it("approves an article in review", () => {
    const updated = applyArticleAction(articles, "article-1", "approve");

    expect(updated.find((article) => article.id === "article-1")?.status).toBe("approved");
  });

  it("moves an approved article into WeChat draft state", () => {
    const updated = applyArticleAction(articles, "article-2", "create_wechat_draft");

    expect(updated.find((article) => article.id === "article-2")?.status).toBe("wechat_draft");
  });

  it("keeps invalid transitions unchanged", () => {
    const updated = applyArticleAction(articles, "article-1", "publish");

    expect(updated.find((article) => article.id === "article-1")?.status).toBe("review");
  });

  it("keeps publish submission separate from confirmed publication", () => {
    const submitted = applyArticleAction(articles, "article-2", "create_wechat_draft");
    const publishing = applyArticleAction(submitted, "article-2", "submit_publish");
    const published = applyArticleAction(publishing, "article-2", "publish");

    expect(publishing.find((article) => article.id === "article-2")?.status).toBe("publish_submitted");
    expect(published.find((article) => article.id === "article-2")?.status).toBe("published");
  });
});

describe("applySuggestionAction", () => {
  it("removes an accepted suggestion from the pending list", () => {
    const updated = applySuggestionAction(strategySuggestions, "suggestion-1", "accept");

    expect(updated.some((suggestion) => suggestion.id === "suggestion-1")).toBe(false);
  });

  it("removes a dismissed suggestion from the pending list", () => {
    const updated = applySuggestionAction(strategySuggestions, "suggestion-2", "dismiss");

    expect(updated.some((suggestion) => suggestion.id === "suggestion-2")).toBe(false);
  });
});
