import type { Chart } from "klinecharts";
import type { ActiveIndicator } from "~/types/chart";

export function useChartPanes(
  getChart: () => Chart | null,
  activeIndicators: Ref<ActiveIndicator[]>,
  chartWrapperRef: Ref<HTMLElement | null>,
) {
  const collapsedPanes = ref<Record<string, boolean>>({});

  function toggleOverlay(id: string) {
    const indicator = activeIndicators.value.find((i) => i.id === id);
    if (!indicator || indicator.isSignal) return;
    const chart = getChart();
    if (!chart) return;

    chart.removeIndicator({ name: id });
    delete collapsedPanes.value[id];

    if (indicator.paneId === "candle_pane") {
      chart.createIndicator({ name: id }, false, { height: 150 });
      const inds = chart.getIndicators({ name: id });
      indicator.paneId = (inds[0] as any)?.paneId ?? "";
    } else {
      chart.createIndicator({ name: id }, true, { id: "candle_pane" });
      indicator.paneId = "candle_pane";
    }
    nextTick(adjustLayout);
  }

  function togglePaneCollapse(id: string) {
    const indicator = activeIndicators.value.find((i) => i.id === id);
    if (!indicator) return;
    const chart = getChart();
    if (!chart) return;

    if (collapsedPanes.value[id]) {
      delete collapsedPanes.value[id];
      const height = indicator.isSignal ? 80 : 120;
      chart.createIndicator({ name: id }, false, { height });
      indicator.paneId = (chart.getIndicators({ name: id })[0] as any)?.paneId ?? "";
      adjustLayout();
    } else {
      collapsedPanes.value[id] = true;
      chart.removeIndicator({ name: id });
      adjustLayout();
    }
  }

  function collapseAllPanes() {
    const chart = getChart();
    if (!chart) return;
    for (const ind of activeIndicators.value) {
      if (ind.paneId && !collapsedPanes.value[ind.id]) {
        chart.removeIndicator({ name: ind.id });
        collapsedPanes.value[ind.id] = true;
      }
    }
  }

  function expandAllPanes() {
    const chart = getChart();
    if (!chart) return;
    for (const ind of activeIndicators.value) {
      if (collapsedPanes.value[ind.id]) {
        const height = ind.isSignal ? 80 : 120;
        chart.createIndicator({ name: ind.id }, false, { height });
        ind.paneId = (chart.getIndicators({ name: ind.id })[0] as any)?.paneId ?? "";
      }
    }
    collapsedPanes.value = {};
    adjustLayout();
  }

  function adjustLayout() {
    const chart = getChart();
    const wrapper = chartWrapperRef.value;
    if (!chart || !wrapper) return;

    const totalHeight = wrapper.clientHeight;
    if (totalHeight <= 0) return;

    const visibleIndicators = activeIndicators.value.filter(
      (i) => i.paneId && !collapsedPanes.value[i.id],
    );
    if (visibleIndicators.length === 0) return;

    const candleHeight = Math.floor(totalHeight * 0.5);
    chart.setPaneOptions({ id: "candle_pane", height: candleHeight });

    const oscillatorHeight = Math.floor(
      (totalHeight - candleHeight) / visibleIndicators.length,
    );
    for (const ind of visibleIndicators) {
      chart.setPaneOptions({
        id: ind.paneId,
        height: Math.max(30, oscillatorHeight),
      });
    }
  }

  let resizeObserver: ResizeObserver | undefined;
  onMounted(() => {
    resizeObserver = new ResizeObserver(() => {
      nextTick(adjustLayout);
    });
    if (chartWrapperRef.value) resizeObserver.observe(chartWrapperRef.value);
  });
  watch(chartWrapperRef, (el) => {
    if (el) resizeObserver?.observe(el);
  });
  onBeforeUnmount(() => resizeObserver?.disconnect());

  return {
    collapsedPanes,
    toggleOverlay,
    togglePaneCollapse,
    collapseAllPanes,
    expandAllPanes,
    adjustLayout,
  };
}
