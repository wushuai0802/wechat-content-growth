import type { WorkspaceData, WorkspaceStore } from "./workspace-store";
import { parseTrendImport } from "./trend-importer";

export interface TrendImportResult {
  workspace: WorkspaceData;
  importedCount: number;
  generatedTopicCount: number;
}

export function importTrendSignals(
  store: WorkspaceStore,
  content: string,
  options?: { now?: Date }
): TrendImportResult {
  const signals = parseTrendImport(content);
  if (signals.length === 0) {
    throw new Error("Import content is required");
  }

  const beforeTopicCount = store.getWorkspace().topics.length;
  const workspace = store.refreshTrendSignals(signals, { now: options?.now });

  return {
    workspace,
    importedCount: signals.length,
    generatedTopicCount: Math.max(0, workspace.topics.length - beforeTopicCount)
  };
}
