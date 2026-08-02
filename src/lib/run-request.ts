import type { AutoLoopConfig } from "./domain";

export type RunRequestBody = Partial<Pick<AutoLoopConfig,
  | "enabled"
  | "autoPublishEnabled"
  | "dailyArticleLimit"
  | "dailyCostCapCny"
  | "minQualityScore"
  | "maxRiskScore"
>> & {
  autoDecideDailyArticleLimit?: boolean;
};

export function extractAutoLoopConfigPatch(body: RunRequestBody): Partial<Pick<AutoLoopConfig,
  | "enabled"
  | "autoPublishEnabled"
  | "dailyArticleLimit"
  | "dailyCostCapCny"
  | "minQualityScore"
  | "maxRiskScore"
>> {
  const configPatch: Partial<Pick<AutoLoopConfig,
    | "enabled"
    | "autoPublishEnabled"
    | "dailyArticleLimit"
    | "dailyCostCapCny"
    | "minQualityScore"
    | "maxRiskScore"
  >> = {};

  for (const key of ["enabled", "autoPublishEnabled", "dailyArticleLimit", "dailyCostCapCny", "minQualityScore", "maxRiskScore"] as const) {
    if (body[key] !== undefined) {
      configPatch[key] = body[key] as never;
    }
  }

  return configPatch;
}

export function shouldAutoDecideDailyArticleLimit(body: RunRequestBody): boolean {
  return body.autoDecideDailyArticleLimit === true || body.dailyArticleLimit === undefined;
}
