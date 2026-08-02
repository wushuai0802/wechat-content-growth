import { deliverablesRoot, getRuntimeDataDir } from "./paths";

export interface CpaAction {
  id: string;
  method: "GET" | "POST";
  path: string;
  description: string;
  bodySchema?: Record<string, unknown>;
}

export interface CpaManifest {
  schemaVersion: "1.0";
  name: string;
  title: string;
  description: string;
  baseUrl: string;
  actions: CpaAction[];
}

export function buildCpaManifest(baseUrl: string): CpaManifest {
  return {
    schemaVersion: "1.0",
    name: "wechat-content-growth",
    title: "微信公众号内容增长系统",
    description: "本地可用的公众号选题、草稿生成、审阅、收益复盘和周报导出服务。",
    baseUrl,
    actions: [
      {
        id: "workspace.get",
        method: "GET",
        path: "/api/workspace",
        description: "读取当前本地工作区状态。"
      },
      {
        id: "workspace.reset",
        method: "POST",
        path: "/api/workspace/reset",
        description: "把本地工作区恢复到种子模拟数据。"
      },
      {
        id: "topic.generateDraft",
        method: "POST",
        path: "/api/topics/{topicId}/generate",
        description: "根据选题生成 Markdown 草稿并写入本地 deliverables 目录。"
      },
      {
        id: "article.applyAction",
        method: "POST",
        path: "/api/articles/{articleId}/action",
        description: "执行文章状态动作。",
        bodySchema: {
          action: ["approve", "create_wechat_draft", "publish", "archive"]
        }
      },
      {
        id: "suggestion.applyAction",
        method: "POST",
        path: "/api/suggestions/{suggestionId}/action",
        description: "采纳或忽略策略建议。",
        bodySchema: {
          action: ["accept", "dismiss"]
        }
      },
      {
        id: "report.generateWeekly",
        method: "POST",
        path: "/api/reports/weekly",
      description: "生成当前工作区周报并写入本地 reports 目录。"
      }
    ]
  };
}

export function buildCpaHealth() {
  return {
    ok: true,
    service: "wechat-content-growth",
    checkedAt: new Date().toISOString(),
    storage: {
      runtimeData: getRuntimeDataDir(),
      deliverables: deliverablesRoot
    }
  };
}
