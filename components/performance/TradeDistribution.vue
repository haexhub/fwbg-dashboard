<script setup lang="ts">
import type { PerformanceData } from "~/types/performance";

const props = defineProps<{
  data: PerformanceData;
}>();

const chartRef = ref<HTMLElement | null>(null);
const { setOption } = useEChart(chartRef);

watch(
  () => props.data,
  (data) => {
    if (!data) return;

    const wins = data.trades.filter((t) => t.result === "win").length;
    const losses = data.trades.filter((t) => t.result === "loss").length;

    setOption({
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
      series: [
        {
          type: "pie",
          radius: ["45%", "70%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: "#111827",
            borderWidth: 2,
          },
          label: {
            color: "#9ca3af",
            fontSize: 12,
          },
          data: [
            {
              value: wins,
              name: "Wins",
              itemStyle: { color: "#22c55e" },
            },
            {
              value: losses,
              name: "Losses",
              itemStyle: { color: "#ef4444" },
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
      <h3 class="text-lg font-semibold text-white">Trade-Verteilung</h3>
    </template>
    <div ref="chartRef" class="h-64 w-full" />
  </UCard>
</template>
