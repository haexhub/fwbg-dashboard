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

  onMounted(() => {
    if (!containerRef.value) return;

    chart = init(containerRef.value, "dark", { renderer: "canvas" });
    chart.setOption({ backgroundColor: "transparent" });

    // Apply any buffered option
    if (pendingOption) {
      chart.setOption(pendingOption, { notMerge: true });
      pendingOption = null;
    }

    observer = new ResizeObserver(() => {
      chart?.resize();
    });
    observer.observe(containerRef.value);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    chart?.dispose();
    chart = null;
  });

  return { setOption };
}
