<script setup lang="ts">
import type { PluginInfo } from "~/types/strategy";
import type { ActiveIndicator, IndicatorResponse } from "~/types/chart";
import { registerFwbgIndicator } from "~/composables/useChartIndicators";

definePageMeta({ layout: "builder" });

const {
  source,
  symbol,
  timeframe,
  sources,
  currentSymbol,
  availableSymbols,
  availableTimeframes,
  activeIndicators,
  activeDrawingTool,
  setSource,
  setSymbol,
  setTimeframe,
  addIndicator,
  removeIndicator,
  setDrawingTool,
} = useChart();

const { plugins } = usePlugins();

// Filter to indicator-phase plugins only
const indicatorPlugins = computed(
  () => plugins.value?.filter((p) => p.phase === "indicators") ?? []
);

// Indicator panel state
const indicatorPanelOpen = ref(false);

// Chart component ref for direct chart access
const chartCanvas = ref<{ getChart: () => import("klinecharts").Chart | null } | null>(null);

async function handleAddIndicator(
  plugin: PluginInfo,
  params: Record<string, unknown>,
  selectedColumns: string[],
  colors: Record<string, string>
) {
  try {
    // Fetch full data with all bars for the selected columns
    const response = await $fetch<IndicatorResponse>(
      "/api/chart/indicator",
      {
        method: "POST",
        body: {
          symbol: symbol.value,
          timeframe: timeframe.value,
          source: source.value,
          fqn: plugin.fqn,
          params,
        },
      }
    );

    const instanceId = `fwbg_${plugin.name}_${Date.now()}`;

    // Register only user-selected columns
    registerFwbgIndicator(instanceId, response, selectedColumns, colors);

    // Create indicator pane on chart
    const chart = chartCanvas.value?.getChart();
    let paneId = "";
    if (chart) {
      paneId =
        chart.createIndicator({ name: instanceId }, false, {
          height: 150,
        }) ?? "";
    }

    addIndicator({
      id: instanceId,
      fqn: plugin.fqn,
      name: plugin.name,
      params,
      columns: selectedColumns,
      paneId,
    });
  } catch (e) {
    console.error("Failed to add indicator:", e);
  }
}

function handleRemoveIndicator(id: string) {
  const chart = chartCanvas.value?.getChart();
  if (chart) {
    chart.removeIndicator({ name: id });
  }
  removeIndicator(id);
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Chart Toolbar -->
    <ChartToolbar
      :source="source"
      :symbol="symbol"
      :timeframe="timeframe"
      :sources="sources ?? []"
      :available-symbols="availableSymbols"
      :available-timeframes="availableTimeframes"
      :active-indicators="activeIndicators"
      :active-drawing-tool="activeDrawingTool"
      @update:source="setSource"
      @update:symbol="setSymbol"
      @update:timeframe="setTimeframe"
      @update:drawing-tool="setDrawingTool"
      @open-indicators="indicatorPanelOpen = true"
    />

    <!-- Chart Canvas -->
    <div class="flex-1 min-h-0">
      <ClientOnly>
        <ChartCanvas
          ref="chartCanvas"
          :source="source"
          :symbol="symbol"
          :timeframe="timeframe"
          :price-precision="currentSymbol?.point ? Math.max(0, -Math.floor(Math.log10(currentSymbol.point))) : 5"
          :active-drawing-tool="activeDrawingTool"
        />
        <template #fallback>
          <div
            class="h-full flex items-center justify-center text-gray-400"
          >
            Loading chart...
          </div>
        </template>
      </ClientOnly>
    </div>

    <!-- Indicator Panel -->
    <ChartIndicatorPanel
      :open="indicatorPanelOpen"
      :plugins="indicatorPlugins"
      :active-indicators="activeIndicators"
      :source="source"
      :symbol="symbol"
      :timeframe="timeframe"
      @update:open="indicatorPanelOpen = $event"
      @add="handleAddIndicator"
      @remove="handleRemoveIndicator"
    />
  </div>
</template>
