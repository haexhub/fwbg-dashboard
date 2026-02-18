import type { StrategySummary, StrategyConfig } from "~/types/strategy";

/**
 * Composable for strategy CRUD operations.
 */
export function useStrategies() {
  const {
    data: strategies,
    status,
    refresh,
  } = useFetch<StrategySummary[]>("/api/strategy/strategies", {
    default: () => [],
  });

  async function loadStrategy(filename: string): Promise<StrategyConfig> {
    return $fetch<StrategyConfig>(
      `/api/strategy/strategies/${filename}`
    );
  }

  async function saveStrategy(
    filename: string,
    data: StrategyConfig
  ): Promise<void> {
    await $fetch(`/api/strategy/strategies/${filename}`, {
      method: "PUT",
      body: data,
    });
    await refresh();
  }

  async function createStrategy(
    name: string,
    data: Partial<StrategyConfig>
  ): Promise<{ filename: string }> {
    const result = await $fetch<{ filename: string }>(
      "/api/strategy/strategies",
      {
        method: "POST",
        body: { name, data },
      }
    );
    await refresh();
    return result;
  }

  async function deleteStrategy(filename: string): Promise<void> {
    await $fetch(`/api/strategy/strategies/${filename}`, {
      method: "DELETE",
    });
    await refresh();
  }

  return {
    strategies,
    status,
    refresh,
    loadStrategy,
    saveStrategy,
    createStrategy,
    deleteStrategy,
  };
}
