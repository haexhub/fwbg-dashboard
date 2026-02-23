<script setup lang="ts">
import type { EquityPoint } from "~/types/performance";

const props = defineProps<{
  points: EquityPoint[];
}>();

const chartRef = ref<HTMLElement | null>(null);
const { setOption } = useEChart(chartRef);

watch(
  () => props.points,
  (points) => {
    if (!points.length) return;

    const labels = points.map((p) => p.label);
    const values = points.map((p) => p.value);

    setOption({
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params;
          const data = (p as { name: string; value: number });
          return `${data.name}<br/>P&L: <b>${data.value > 0 ? "+" : ""}${data.value}</b>`;
        },
      },
      grid: {
        left: 50,
        right: 20,
        top: 20,
        bottom: 30,
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: {
          show: false,
        },
        axisLine: { lineStyle: { color: "#374151" } },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#1f2937" } },
        axisLine: { lineStyle: { color: "#374151" } },
      },
      series: [
        {
          type: "line",
          data: values,
          smooth: true,
          symbol: "none",
          lineStyle: { width: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: "rgba(34, 197, 94, 0.4)",
                },
                {
                  offset: 1,
                  color: "rgba(34, 197, 94, 0.05)",
                },
              ],
            },
          },
          itemStyle: {
            color: "#22c55e",
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
      <h3 class="text-lg font-semibold text-white">Equity Curve</h3>
    </template>
    <div ref="chartRef" class="h-64 w-full" />
  </UCard>
</template>
