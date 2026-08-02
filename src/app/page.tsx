import { DashboardClient } from "./dashboard-client";
import { decideDailyArticleLimit } from "@/lib/daily-run-planner";
import { workspaceStore } from "@/lib/workspace-store";

export const dynamic = "force-dynamic";

export default function Home() {
  const workspace = workspaceStore.getWorkspace();
  const dailyPlan = decideDailyArticleLimit({ workspace });

  return (
    <DashboardClient
      initialWorkspace={workspace}
      initialDailyPlan={dailyPlan}
    />
  );
}
