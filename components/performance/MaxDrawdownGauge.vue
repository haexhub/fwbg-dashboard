<script setup lang="ts">
import { formatNumber } from "~/types/dashboard";

const props = defineProps<{
  maxDrawdown: number;
  maxDrawdownPct: number;
}>();

const chartRef = ref<HTMLElement | null>(null);
const { setOption } = useEChart(chartRef);

watch(
  () => props.maxDrawdownPct,
  (pct) => {
    const displayValue = Math.min(100, Math.max(0, pct));
    const color =
      pct <= 10 ? "#22c55e" : pct <= 25 ? "#eab308" : "#ef4444";

    setOption({
      series: [
        {
          type: "gauge",
          startAngle: 220,
          endAngle: -40,
          min: 0,
          max: 100,
          pointer: { show: false },
          progress: {
            show: true,
            width: 14,
            roundCap: true,
            itemStyle: { color },
          },
          axisLine: {
            lineStyle: {
              width: 14,
              color: [[1, "#374151"]],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            valueAnimation: true,
            formatter: "{value}",
            fontSize: 28,
            fontWeight: "bold",
            color,
            offsetCenter: [0, "0%"],
          },
          title: { show: false },
          data: [
            {
              value: Math.round(displayValue * 10) / 10,
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
    <div class="flex flex-col gap-1">
      <span class="text-sm text-gray-400">Max Drawdown %</span>
      <div ref="chartRef" class="h-40 w-full" />
      <p class="text-center text-sm font-mono text-red-400">
        {{ formatNumber(maxDrawdown, 2) }} absolut
      </p>
    </div>
  </UCard>
</template>
