import { NextResponse } from "next/server";
import { getLocalCpaConfig, listCpaModels } from "@/lib/local-cpa-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getLocalCpaConfig();

  if (!config) {
    return NextResponse.json({
      ok: false,
      error: "CPA config missing"
    }, { status: 503 });
  }

  try {
    const models = await listCpaModels(config);
    return NextResponse.json({
      ok: true,
      baseUrl: config.baseUrl,
      model: config.model,
      modelCount: models.length,
      sampleModels: models.slice(0, 8)
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "CPA provider check failed"
    }, { status: 502 });
  }
}
