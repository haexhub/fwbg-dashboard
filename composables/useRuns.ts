import type { RunSummary, RunDetail } from "~/types/strategy";

/**
 * Composable for run management.
 */
export function useRuns() {
  const {
    data: runs,
    status,
    refresh,
  } = useFetch<RunSummary[]>("/api/runs", {
    default: () => [],
  });

  async function getRunDetail(runId: string): Promise<RunDetail> {
    return $fetch<RunDetail>(`/api/runs/${runId}`);
  }

  async function startRun(opts: {
    strategy_name: string;
    assets?: string[];
    asset_classes?: string[];
    description?: string;
  }): Promise<{ job_id: string; status: string }> {
    const result = await $fetch<{ job_id: string; status: string }>(
      "/api/runs/start",
      {
        method: "POST",
        body: opts,
      }
    );
    await refresh();
    return result;
  }

  async function cancelRun(
    runId: string
  ): Promise<{ status: string }> {
    const result = await $fetch<{ status: string }>(
      `/api/runs/${runId}/cancel`,
      { method: "POST" }
    );
    await refresh();
    return result;
  }

  return {
    runs,
    status,
    refresh,
    getRunDetail,
    startRun,
    cancelRun,
  };
}
