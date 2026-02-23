<script setup lang="ts">
const props = defineProps<{
  winRate: number;
  totalTrades: number;
}>();

const wins = computed(() =>
  Math.round((props.winRate / 100) * props.totalTrades),
);
const losses = computed(() => props.totalTrades - wins.value);

const chartRef = ref<HTMLElement | null>(null);
const { setOption } = useEChart(chartRef);

watch(
  () => [props.winRate, props.totalTrades],
  () => {
    const wr = props.winRate;
    const color = wr >= 60 ? "#22c55e" : wr >= 50 ? "#eab308" : "#ef4444";

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
              value: Math.round(wr * 10) / 10,
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
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-400">Win %</span>
        <UBadge variant="subtle" color="success" size="xs">
          {{ wins }}
        </UBadge>
        <UBadge variant="subtle" color="error" size="xs">
          {{ losses }}
        </UBadge>
      </div>
      <div ref="chartRef" class="h-40 w-full" />
    </div>
  </UCard>
</template>
