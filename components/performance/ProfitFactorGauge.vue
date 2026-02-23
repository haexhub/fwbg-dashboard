<script setup lang="ts">
const props = defineProps<{
  profitFactor: number;
}>();

const chartRef = ref<HTMLElement | null>(null);
const { setOption } = useEChart(chartRef);

watch(
  () => props.profitFactor,
  (pf) => {
    const clampedValue = Math.min(3, Math.max(0, pf));
    const color = pf >= 1.5 ? "#22c55e" : pf >= 1 ? "#eab308" : "#ef4444";

    setOption({
      series: [
        {
          type: "gauge",
          startAngle: 220,
          endAngle: -40,
          min: 0,
          max: 3,
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
            formatter: (val: number) =>
              (Math.round(pf * 100) / 100).toString(),
            fontSize: 28,
            fontWeight: "bold",
            color,
            offsetCenter: [0, "0%"],
          },
          title: { show: false },
          data: [{ value: clampedValue }],
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
      <span class="text-sm text-gray-400">Profit Factor</span>
      <div ref="chartRef" class="h-40 w-full" />
    </div>
  </UCard>
</template>
