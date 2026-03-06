import { init, type ECharts, type EChartsOption } from "echarts";

/**
 * Composable for managing an ECharts instance lifecycle.
 *
 * - Initializes chart on mounted with dark theme
 * - Buffers setOption calls made before mount
 * - Auto-resizes via ResizeObserver
 * - Disposes on unmount
 */
export function useEChart(containerRef: Ref<HTMLElement | null>) {
  let chart: ECharts | null = null;
  let observer: ResizeObserver | null = null;
  let pendingOption: EChartsOption | null = null;

  function setOption(option: EChartsOption) {
    if (!chart) {
      // Buffer until chart is initialized
      pendingOption = option;
      return;
    }
    chart.setOption(option, { notMerge: true });
  }

  function tryInit() {
    if (chart || !containerRef.value) return;

    chart = init(containerRef.value, "dark", { renderer: "canvas" });
    chart.setOption({ backgroundColor: "transparent" });

    if (pendingOption) {
      chart.setOption(pendingOption, { notMerge: true });
      pendingOption = null;
    }

    observer = new ResizeObserver(() => {
      chart?.resize();
    });
    observer.observe(containerRef.value);
  }

  onMounted(tryInit);

  // Re-try init when ref appears (e.g. inside v-if that flips after mount)
  watch(containerRef, (el) => {
    if (el && !chart) tryInit();
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    chart?.dispose();
    chart = null;
  });

  return { setOption };
}
