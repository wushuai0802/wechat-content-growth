import type { TrendSignal } from "./domain";

const allowedSources = new Set<TrendSignal["source"]>(["manual", "mock_hot_source", "weibo", "baidu", "toutiao", "zhihu", "news", "wechat_public"]);

function slugify(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ai/g, "ai")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ascii ? `${ascii}-${hash.toString(36)}` : hash.toString(36);
}

function clamp(value: unknown, fallback: number): number {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(number)));
}

function optionalScore(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return clamp(value, 0);
}

function optionalPositiveNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : undefined;
}

function parseKeywords(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  return String(value ?? "")
    .split(/[|,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsv(input: string): Record<string, string>[] {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }
  const headers = lines[0].split(",").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function normalizeSource(value: unknown): TrendSignal["source"] {
  const source = String(value || "manual") as TrendSignal["source"];
  return allowedSources.has(source) ? source : "manual";
}

function normalizeRow(row: Record<string, unknown>, index: number): TrendSignal {
  const title = String(row.title ?? "").trim();
  if (!title) {
    throw new Error(`第 ${index + 1} 行缺少 title`);
  }

  const category = String(row.category ?? "未分类").trim() || "未分类";
  const keywords = parseKeywords(row.keywords);
  const evidenceReadiness = row.evidenceReadiness === "ready" || row.evidenceReadiness === "needs_research"
    ? row.evidenceReadiness
    : undefined;
  const evidenceNotes = parseKeywords(row.evidenceNotes);

  return {
    id: String(row.id ?? `trend-${slugify(title)}`).trim(),
    title,
    source: normalizeSource(row.source),
    url: row.url ? String(row.url).trim() : undefined,
    heat: clamp(row.heat, 50),
    growth: clamp(row.growth, 0),
    competition: clamp(row.competition, 50),
    category,
    keywords: keywords.length ? keywords : [title, category],
    observedAt: row.observedAt ? String(row.observedAt) : new Date().toISOString(),
    growthRate: optionalScore(row.growthRate),
    remainingHalfLifeHours: optionalPositiveNumber(row.remainingHalfLifeHours),
    audienceOverlap: optionalScore(row.audienceOverlap),
    contentSupplyGap: optionalScore(row.contentSupplyGap),
    monetizationIntent: optionalScore(row.monetizationIntent),
    sharePotential: optionalScore(row.sharePotential),
    productionLatencyHours: optionalPositiveNumber(row.productionLatencyHours),
    policyRisk: optionalScore(row.policyRisk),
    confidence: optionalScore(row.confidence),
    evidenceReadiness,
    evidenceNotes: evidenceNotes.length ? evidenceNotes : undefined
  };
}

export function parseTrendImport(input: string): TrendSignal[] {
  const trimmed = input.trim().replace(/^\uFEFF/, "");
  if (!trimmed) {
    return [];
  }

  const rows = trimmed.startsWith("[") || trimmed.startsWith("{")
    ? JSON.parse(trimmed)
    : parseCsv(trimmed);
  const normalizedRows = Array.isArray(rows) ? rows : [rows];

  return normalizedRows.map((row, index) => normalizeRow(row as Record<string, unknown>, index));
}
