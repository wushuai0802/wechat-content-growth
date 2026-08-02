import { NextResponse } from "next/server";
import {
  getLocalCpaConfig,
  listCpaModels,
  updateLocalCpaConfig
} from "@/lib/local-cpa-client";

export const dynamic = "force-dynamic";

function toSafeConfig(config: ReturnType<typeof getLocalCpaConfig>, models: string[] = []) {
  return {
    configured: Boolean(config),
    baseUrl: config?.baseUrl ?? "",
    model: config?.model ?? "",
    keyConfigured: Boolean(config?.apiKey),
    models
  };
}

export async function GET() {
  const config = getLocalCpaConfig();

  if (!config) {
    return NextResponse.json(toSafeConfig(config));
  }

  try {
    const models = await listCpaModels(config);
    return NextResponse.json(toSafeConfig(config, models));
  } catch {
    return NextResponse.json(toSafeConfig(config));
  }
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  };

  try {
    const updated = updateLocalCpaConfig({
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      model: body.model
    });
    const models = await listCpaModels(updated).catch(() => []);
    return NextResponse.json(toSafeConfig(updated, models));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "保存 CPA 配置失败"
      },
      { status: 400 }
    );
  }
}
