import type { AssetsResponse } from "~/types/datasource";

export function useDataSourceAssets() {
  const { data, status, refresh } = useFetch<AssetsResponse>("/api/datasources/assets", {
    default: () => ({ assets: [], by_source: {} }),
  });

  const availableSymbols = computed(() => [
    ...new Set(data.value?.assets.map((a) => a.symbol) ?? []),
  ]);

  return { data, status, refresh, availableSymbols };
}
