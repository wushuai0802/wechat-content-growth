export function clampHotScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeExternalText(value: unknown, maxLength = 120): string {
  const normalized = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(normalized).slice(0, maxLength).join("");
}

export function hotTitleSlug(value: string): string {
  const normalized = value.trim().toLowerCase();
  const known = new Map<string, string>([
    ["ai", "ai"],
    ["搜索", "search"],
    ["产品", "product"],
    ["更新", "update"],
    ["国内", "domestic"],
    ["油价", "oil-price"],
    ["将", ""],
    ["调整", "adjustment"]
  ]);
  const translated = Array.from(known.entries()).reduce(
    (result, [source, target]) => result.replaceAll(source, target ? ` ${target} ` : " "),
    normalized
  );
  const ascii = translated
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (ascii) return ascii;

  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

export function hotKeywordList(title: string, description = ""): string[] {
  const safeDescription = normalizeExternalText(description, 240);
  const asciiWords = title.match(/[A-Za-z][A-Za-z0-9+#-]*/g) ?? [];
  const chineseTokens = title.match(/[\u4e00-\u9fa5]{2}/g) ?? [];
  const descriptionTokens = safeDescription.match(/[\u4e00-\u9fa5]{2,4}/g) ?? [];
  const titleTokens = Array.from(new Set([...asciiWords, ...chineseTokens]));
  if (titleTokens.length >= 3) return titleTokens.slice(0, 5);
  return Array.from(new Set([...titleTokens, ...descriptionTokens])).slice(0, 5);
}

export function finiteHotNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function normalizedHeat(value: unknown, maxValue: number): number {
  const number = finiteHotNumber(value);
  return clampHotScore((number / Math.max(1, maxValue)) * 100);
}

export function growthFromRank(index: number): number {
  if (index < 5) return 20;
  if (index < 15) return 14;
  if (index < 30) return 8;
  return 4;
}

export function competitionFromRank(index: number): number {
  return clampHotScore(32 + index * 2);
}

export function allowlistedHttpsUrl(value: unknown, allowedHosts: string[], fallback: string): string {
  try {
    const url = new URL(String(value ?? ""));
    const host = url.hostname.toLowerCase();
    const allowed = allowedHosts.some((item) => host === item || host.endsWith(`.${item}`));
    return url.protocol === "https:" && allowed ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}
