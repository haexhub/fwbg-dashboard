<script setup lang="ts">
import type { EquitySimPoint } from "~/types/performance";

const props = defineProps<{
  points: EquitySimPoint[];
}>();

const chartRef = ref<HTMLElement | null>(null);
const { setOption } = useEChart(chartRef);

watch(
  () => props.points,
  (points) => {
    if (points.length < 2) return;

    const indices = points.map((p) => p.index);
    const values = points.map((p) => p.drawdownPct);
    const maxDd = Math.max(...values);

    setOption({
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params;
          const data = p as { dataIndex: number; value: number };
          return `Trade #${data.dataIndex}<br/>Drawdown: <b>${data.value.toFixed(1)}%</b>`;
        },
      },
      grid: {
        left: 50,
        right: 20,
        top: 10,
        bottom: 30,
      },
      xAxis: {
        type: "category",
        data: indices,
        axisLabel: { show: false },
        axisLine: { lineStyle: { color: "#374151" } },
      },
      yAxis: {
        type: "value",
        inverse: true,
        min: 0,
        max: Math.ceil(maxDd * 1.1) || 1,
        splitLine: { lineStyle: { color: "#1f2937" } },
        axisLine: { lineStyle: { color: "#374151" } },
        axisLabel: {
          formatter: (val: number) => `${val.toFixed(0)}%`,
          color: "#9ca3af",
        },
      },
      series: [
        {
          type: "line",
          data: values,
          smooth: false,
          symbol: "none",
          lineStyle: { width: 0 },
          areaStyle: {
            color: "rgba(239, 68, 68, 0.5)",
          },
          itemStyle: { color: "#ef4444" },
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
      <h3 class="text-lg font-semibold text-white">Drawdown %</h3>
    </template>
    <div ref="chartRef" class="h-40 w-full" />
  </UCard>
</template>
