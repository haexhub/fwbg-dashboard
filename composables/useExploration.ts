/**
 * Composable for Exploration features — Exit Optimization.
 *
 * Provides reactive list of cached results, detail fetching,
 * and the ability to run new exit optimizations.
 */
import type {
  ExitOptimizationSummary,
  ExitOptimizationResult,
  ExitOptimizationRequest,
} from "~/types/exploration";

export function useExploration() {
  const {
    data: exitOptimizations,
    refresh: refreshExitOptimizations,
    status: exitOptimizationsStatus,
  } = useFetch<ExitOptimizationSummary[]>(
    "/api/exploration/exit-optimization",
    { default: () => [] }
  );

  async function getExitOptimization(
    symbol: string
  ): Promise<ExitOptimizationResult> {
    return $fetch<ExitOptimizationResult>(
      `/api/exploration/exit-optimization/${symbol}`
    );
  }

  const running = ref(false);

  async function runExitOptimization(
    request: ExitOptimizationRequest
  ): Promise<ExitOptimizationResult> {
    running.value = true;
    try {
      const result = await $fetch<ExitOptimizationResult>(
        "/api/exploration/exit-optimization/run",
        { method: "POST", body: request }
      );
      await refreshExitOptimizations();
      return result;
    } finally {
      running.value = false;
    }
  }

  return {
    exitOptimizations,
    exitOptimizationsStatus,
    refreshExitOptimizations,
    getExitOptimization,
    runExitOptimization,
    running,
  };
}
