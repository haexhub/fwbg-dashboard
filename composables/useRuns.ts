import type { RunSummary, RunDetail } from "~/types/strategy";

interface PaginatedRuns {
  items: RunSummary[];
  total: number;
}

/**
 * Composable for run management with pagination.
 */
export function useRuns(pageSize = 20) {
  const page = ref(1);
  const total = ref(0);

  const queryParams = computed(() => ({
    limit: pageSize,
    offset: (page.value - 1) * pageSize,
  }));

  const {
    data: raw,
    status,
    refresh,
  } = useFetch<PaginatedRuns>("/api/runs", {
    query: queryParams,
    default: () => ({ items: [], total: 0 }),
  });

  const runs = computed(() => raw.value?.items ?? []);

  watch(raw, (v) => {
    if (v) total.value = v.total;
  });

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

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
      },
    );
    await refresh();
    return result;
  }

  async function cancelRun(
    runId: string,
  ): Promise<{ status: string }> {
    const result = await $fetch<{ status: string }>(
      `/api/runs/${runId}/cancel`,
      { method: "POST" },
    );
    await refresh();
    return result;
  }

  return {
    runs,
    total,
    totalPages,
    page,
    status,
    refresh,
    getRunDetail,
    startRun,
    cancelRun,
  };
}
