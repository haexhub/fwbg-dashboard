import type { AssetClassesResponse } from "~/types/agents";

/**
 * Controlled asset-class vocabulary from fwbg's registry (single source of
 * truth). Used by the research brief form so its dropdown can never drift from
 * the backend, which re-validates the value at intake.
 */
export function useAssetClasses() {
  const { data, status, refresh } = useFetch<AssetClassesResponse>(
    "/api/assets-classes",
    { default: () => ({ classes: [], by_class: {} }) },
  );

  const classes = computed(() => data.value?.classes ?? []);

  return { data, status, refresh, classes };
}
