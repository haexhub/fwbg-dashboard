<script setup lang="ts">
import type { EquityPoint } from "~/types/performance";
import { formatNumber } from "~/types/dashboard";

const props = defineProps<{
  netPnl: number;
  totalTrades: number;
  equityCurve: EquityPoint[];
}>();

const chartRef = ref<HTMLElement | null>(null);
const { setOption } = useEChart(chartRef);

watch(
  () => props.equityCurve,
  (points) => {
    if (!points.length) return;

    const values = points.map((p) => p.value);

    setOption({
      grid: { left: 0, right: 0, top: 5, bottom: 0 },
      xAxis: {
        type: "category",
        show: false,
        data: points.map((p) => p.label),
      },
      yAxis: { type: "value", show: false },
      tooltip: { show: false },
      series: [
        {
          type: "line",
          data: values,
          smooth: true,
          symbol: "none",
          lineStyle: { width: 2, color: "#22c55e" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(34, 197, 94, 0.3)" },
                { offset: 1, color: "rgba(34, 197, 94, 0.02)" },
              ],
            },
          },
        },
      ],
    });
  },
  { immediate: true },
);
</script>

<template>
  <UCard>
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-400">Net Cumulative P&L</span>
        <UBadge variant="subtle" color="neutral" size="xs">
          {{ totalTrades }}
        </UBadge>
      </div>
      <p
        :class="[
          'text-2xl font-bold',
          netPnl >= 0 ? 'text-green-500' : 'text-red-500',
        ]"
      >
        {{ netPnl >= 0 ? "+" : "" }}{{ formatNumber(netPnl, 2) }}
      </p>
      <div ref="chartRef" class="h-20 w-full" />
    </div>
  </UCard>
</template>
