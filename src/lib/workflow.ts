import type { ArticlePackage, ArticleStatus, StrategySuggestion } from "./domain";

export type ArticleAction =
  | "approve"
  | "create_wechat_draft"
  | "submit_publish"
  | "mark_reconcile"
  | "publish"
  | "archive";
export type SuggestionAction = "accept" | "dismiss";

const transitions: Record<ArticleAction, Partial<Record<ArticleStatus, ArticleStatus>>> = {
  approve: {
    review: "approved"
  },
  create_wechat_draft: {
    approved: "wechat_draft"
  },
  submit_publish: {
    wechat_draft: "publish_submitted"
  },
  mark_reconcile: {
    wechat_draft: "needs_reconcile",
    publish_submitted: "needs_reconcile"
  },
  publish: {
    publish_submitted: "published",
    needs_reconcile: "published"
  },
  archive: {
    drafting: "archived",
    review: "archived",
    approved: "archived",
    wechat_draft: "archived",
    publish_submitted: "archived",
    needs_reconcile: "archived",
    published: "archived"
  }
};

export function applyArticleAction(
  articles: ArticlePackage[],
  articleId: string,
  action: ArticleAction
): ArticlePackage[] {
  return articles.map((article) => {
    if (article.id !== articleId) {
      return article;
    }

    const nextStatus = transitions[action][article.status];
    if (!nextStatus) {
      return article;
    }

    return {
      ...article,
      status: nextStatus
    };
  });
}

export function applySuggestionAction(
  suggestions: StrategySuggestion[],
  suggestionId: string,
  _action: SuggestionAction
): StrategySuggestion[] {
  return suggestions.filter((suggestion) => suggestion.id !== suggestionId);
}
