<script setup lang="ts">
import type { EquitySimPoint } from "~/types/performance";

const props = defineProps<{
  points: EquitySimPoint[];
}>();

const chartRef = ref<HTMLElement | null>(null);
const { setOption } = useEChart(chartRef);

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
  return val.toFixed(0);
}

watch(
  () => props.points,
  (points) => {
    if (points.length < 2) return;

    const indices = points.map((p) => p.index);
    const values = points.map((p) => p.equity);

    setOption({
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params;
          const data = p as { dataIndex: number; value: number };
          return `Trade #${data.dataIndex}<br/>Equity: <b>${formatCurrency(data.value)}</b>`;
        },
      },
      grid: {
        left: 65,
        right: 20,
        top: 20,
        bottom: 30,
      },
      xAxis: {
        type: "category",
        data: indices,
        axisLabel: { show: false },
        axisLine: { lineStyle: { color: "#374151" } },
      },
      yAxis: {
        type: "log",
        min: Math.max(1, Math.min(...values) * 0.8),
        splitLine: { lineStyle: { color: "#1f2937" } },
        axisLine: { lineStyle: { color: "#374151" } },
        axisLabel: {
          formatter: (val: number) => formatCurrency(val),
          color: "#9ca3af",
        },
      },
      series: [
        {
          type: "line",
          data: values,
          smooth: false,
          symbol: "none",
          lineStyle: { width: 1.5, color: "#3b82f6" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(59, 130, 246, 0.3)" },
                { offset: 1, color: "rgba(59, 130, 246, 0.02)" },
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
    <template #header>
      <h3 class="text-lg font-semibold text-white">Equity Curve (log)</h3>
    </template>
    <div ref="chartRef" class="h-64 w-full" />
  </UCard>
</template>
