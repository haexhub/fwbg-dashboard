import type {
  AgentStrategySummary,
  AgentStrategyDetail,
  AgentStrategyState,
  PaperSummary,
  PaperPosition,
  PromoteLiveInput,
} from "~/types/agents";

/**
 * Composable for fwbg-agents strategy listing + detail actions.
 */
export function useAgentStrategies() {
  const stateFilter = ref<AgentStrategyState | undefined>();
  const assetClassFilter = ref<string | undefined>();

  const queryParams = computed(() => ({
    state: stateFilter.value,
    asset_class: assetClassFilter.value,
    limit: 100,
  }));

  const {
    data: raw,
    status,
    refresh,
  } = useFetch<{ strategies: AgentStrategySummary[] }>("/api/agents/strategies", {
    query: queryParams,
    default: () => ({ strategies: [] }),
  });

  const strategies = computed(() => raw.value?.strategies ?? []);

  async function getStrategyDetail(id: number): Promise<AgentStrategyDetail> {
    return $fetch<AgentStrategyDetail>(`/api/agents/strategies/${id}`);
  }

  async function getPaperSummary(id: number): Promise<PaperSummary | null> {
    return $fetch<PaperSummary | null>(`/api/agents/strategies/${id}/paper-summary`);
  }

  async function getPaperPositions(id: number): Promise<PaperPosition[]> {
    return $fetch<PaperPosition[]>(`/api/agents/strategies/${id}/paper-positions`);
  }

  async function runBacktest(
    id: number
  ): Promise<{ strategy_id: number; agent_run_id: number; status: string }> {
    return $fetch<{ strategy_id: number; agent_run_id: number; status: string }>(
      `/api/agents/strategies/${id}/run`,
      { method: "POST" }
    );
  }

  async function analyzeStrategy(
    id: number
  ): Promise<{ strategy_id: number; agent_run_id: number; status: string }> {
    return $fetch<{ strategy_id: number; agent_run_id: number; status: string }>(
      `/api/agents/strategies/${id}/analyze`,
      { method: "POST" }
    );
  }

  async function paperAnalyzeStrategy(
    id: number
  ): Promise<{ agent_run_id: number; status: string }> {
    return $fetch<{ agent_run_id: number; status: string }>(
      `/api/agents/strategies/${id}/paper-analyze`,
      { method: "POST" }
    );
  }

  async function promoteLive(
    id: number,
    input: PromoteLiveInput
  ): Promise<{ strategy_id: number; new_state: string; agent_run_id: number }> {
    return $fetch<{ strategy_id: number; new_state: string; agent_run_id: number }>(
      `/api/agents/strategies/${id}/promote-live`,
      { method: "POST", body: input }
    );
  }

  return {
    strategies,
    status,
    refresh,
    stateFilter,
    assetClassFilter,
    getStrategyDetail,
    getPaperSummary,
    getPaperPositions,
    runBacktest,
    analyzeStrategy,
    paperAnalyzeStrategy,
    promoteLive,
  };
}
