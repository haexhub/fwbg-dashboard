import type {
  AgentPluginSummary,
  AgentPluginDetail,
  AgentPluginState,
  AgentPluginKind,
  VerificationRun,
} from "~/types/agents";

/**
 * Composable for fwbg-agents plugin listing + detail. Read-only — no actions.
 */
export function useAgentPlugins() {
  const stateFilter = ref<AgentPluginState | undefined>();
  const kindFilter = ref<AgentPluginKind | undefined>();

  const queryParams = computed(() => ({
    state: stateFilter.value,
    kind: kindFilter.value,
    limit: 100,
  }));

  const {
    data: raw,
    status,
    refresh,
  } = useFetch<{ plugins: AgentPluginSummary[] }>("/api/agents/plugins", {
    query: queryParams,
    default: () => ({ plugins: [] }),
  });

  const plugins = computed(() => raw.value?.plugins ?? []);

  async function getPluginDetail(id: number): Promise<AgentPluginDetail> {
    return $fetch<AgentPluginDetail>(`/api/agents/plugins/${id}`);
  }

  async function getVerificationRuns(id: number): Promise<VerificationRun[]> {
    const result = await $fetch<{ verification_runs: VerificationRun[] }>(
      `/api/agents/plugins/${id}/verification-runs`
    );
    return result.verification_runs;
  }

  return {
    plugins,
    status,
    refresh,
    stateFilter,
    kindFilter,
    getPluginDetail,
    getVerificationRuns,
  };
}
