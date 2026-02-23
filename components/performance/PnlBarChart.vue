<script setup lang="ts">
import type { AssetPerformance } from "~/types/performance";

const props = defineProps<{
  assets: AssetPerformance[];
}>();

const chartRef = ref<HTMLElement | null>(null);
const { setOption } = useEChart(chartRef);

watch(
  () => props.assets,
  (assets) => {
    if (!assets.length) return;

    const sorted = [...assets].sort((a, b) => a.pnl - b.pnl);
    const symbols = sorted.map((a) => a.symbol);
    const values = sorted.map((a) => a.pnl);
    const colors = sorted.map((a) =>
      a.pnl >= 0 ? "#22c55e" : "#ef4444",
    );

    setOption({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params;
          const data = p as { name: string; value: number };
          return `${data.name}<br/>P&L: <b>${data.value > 0 ? "+" : ""}${data.value.toFixed(3)}</b>`;
        },
      },
      grid: {
        left: 100,
        right: 30,
        top: 10,
        bottom: 10,
      },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#1f2937" } },
        axisLine: { lineStyle: { color: "#374151" } },
      },
      yAxis: {
        type: "category",
        data: symbols,
        axisLabel: {
          color: "#9ca3af",
          fontSize: 11,
          fontFamily: "monospace",
        },
        axisLine: { lineStyle: { color: "#374151" } },
      },
      series: [
        {
          type: "bar",
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i] },
          })),
          barMaxWidth: 20,
        },
      ],
    });
  },
  { immediate: true },
);

const chartHeight = computed(() => {
  const h = Math.max(200, props.assets.length * 28);
  return `${h}px`;
});
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-lg font-semibold text-white">P&L pro Asset</h3>
    </template>
    <div ref="chartRef" class="w-full" :style="{ height: chartHeight }" />
  </UCard>
</template>
