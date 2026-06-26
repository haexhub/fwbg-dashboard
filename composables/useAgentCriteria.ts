import type {
  CriteriaListResponse,
  CriteriaDetailResponse,
  CriteriaUpdateResponse,
} from "~/types/agents";

/**
 * Composable for fwbg-agents per-asset-class criteria (success thresholds).
 */
export function useAgentCriteria() {
  const {
    data: criteriaList,
    status,
    refresh,
  } = useFetch<CriteriaListResponse>("/api/agents/criteria", {
    default: () => ({ asset_classes: [], baseline: null }),
  });

  async function getCriteria(assetClass: string): Promise<CriteriaDetailResponse> {
    return $fetch<CriteriaDetailResponse>(`/api/agents/criteria/${assetClass}`);
  }

  async function updateCriteria(
    assetClass: string,
    body: { yaml_text: string }
  ): Promise<CriteriaUpdateResponse> {
    return $fetch<CriteriaUpdateResponse>(`/api/agents/criteria/${assetClass}`, {
      method: "PUT",
      body,
    });
  }

  return { criteriaList, status, refresh, getCriteria, updateCriteria };
}
