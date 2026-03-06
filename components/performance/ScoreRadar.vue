<script setup lang="ts">
import type { PerformanceData } from "~/types/performance";

const props = defineProps<{
  data: PerformanceData;
}>();

const chartRef = ref<HTMLElement | null>(null);
const { setOption } = useEChart(chartRef);

function normalize(value: number, max: number): number {
  return Math.min(100, Math.max(0, (value / max) * 100));
}

watch(
  () => props.data,
  (data) => {
    if (!data) return;

    const profitableAssets = data.assetBreakdown.filter(
      (a) => a.pnl > 0,
    ).length;
    const consistency =
      data.assetBreakdown.length > 0
        ? (profitableAssets / data.assetBreakdown.length) * 100
        : 0;

    const values = [
      normalize(data.winRate, 100),
      normalize(data.sharpeRatio ?? 0, 3),
      normalize(data.calmarRatio ?? 0, 3),
      normalize(data.profitFactor, 3),
      normalize(consistency, 100),
    ];

    // Overall score (weighted average)
    const score = Math.round(
      values.reduce((s, v) => s + v, 0) / values.length,
    );

    setOption({
      tooltip: {
        trigger: "item",
      },
      radar: {
        indicator: [
          { name: "Win Rate", max: 100 },
          { name: "Sharpe", max: 100 },
          { name: "Calmar", max: 100 },
          { name: "Profit Factor", max: 100 },
          { name: "Consistency", max: 100 },
        ],
        shape: "polygon",
        splitNumber: 5,
        axisName: {
          color: "#9ca3af",
          fontSize: 11,
        },
        splitArea: {
          areaStyle: {
            color: ["transparent"],
          },
        },
        splitLine: {
          lineStyle: { color: "#374151" },
        },
        axisLine: {
          lineStyle: { color: "#374151" },
        },
      },
      graphic: {
        type: "text",
        left: "center",
        top: "center",
        style: {
          text: `${score}`,
          fontSize: 28,
          fontWeight: "bold",
          fill: score >= 60 ? "#22c55e" : score >= 40 ? "#eab308" : "#ef4444",
        } as Record<string, unknown>,
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: values,
              name: "Score",
              areaStyle: {
                color: "rgba(34, 197, 94, 0.2)",
              },
              lineStyle: {
                color: "#22c55e",
                width: 2,
              },
              itemStyle: {
                color: "#22c55e",
              },
            },
          ],
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
      <h3 class="text-lg font-semibold text-white">Strategy Score</h3>
    </template>
    <div ref="chartRef" class="h-64 w-full" />
  </UCard>
</template>
