<script setup lang="ts">
const props = defineProps<{
  values: number[];
}>();

const chartRef = ref<HTMLElement | null>(null);
const { setOption } = useEChart(chartRef);

watch(
  () => props.values,
  (values) => {
    if (!values.length) return;

    const colors = values.map((v) => (v > 0 ? "#22c55e" : "#ef4444"));
    const indices = values.map((_, i) => i + 1);

    const wins = values.filter((v) => v > 0);
    const losses = values.filter((v) => v < 0);
    const avgWin = wins.length ? wins.reduce((s, v) => s + v, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, v) => s + v, 0) / losses.length : 0;

    // Symmetric Y-axis
    const maxAbs = Math.max(
      Math.abs(Math.min(...values)),
      Math.abs(Math.max(...values)),
    );

    const markLines: { yAxis: number; label: { formatter: string; position: "insideEndTop" | "insideEndBottom" }; lineStyle: { color: string; type: "dashed" } }[] = [];
    if (avgWin > 0) {
      markLines.push({
        yAxis: avgWin,
        label: {
          formatter: `Ø Win: ${avgWin.toFixed(1)}`,
          position: "insideEndTop" as const,
        },
        lineStyle: { color: "#22c55e", type: "dashed" as const },
      });
    }
    if (avgLoss < 0) {
      markLines.push({
        yAxis: avgLoss,
        label: {
          formatter: `Ø Loss: ${avgLoss.toFixed(1)}`,
          position: "insideEndBottom" as const,
        },
        lineStyle: { color: "#ef4444", type: "dashed" as const },
      });
    }

    setOption({
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params;
          const data = p as { dataIndex: number; value: number };
          return `Trade #${data.dataIndex + 1}<br/>P&L: <b>${data.value > 0 ? "+" : ""}${data.value.toFixed(1)}</b>`;
        },
      },
      grid: {
        left: 55,
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
        min: -maxAbs * 1.1,
        max: maxAbs * 1.1,
        splitLine: { lineStyle: { color: "#1f2937" } },
        axisLine: { lineStyle: { color: "#374151" } },
        axisLabel: {
          formatter: (val: number) => val.toFixed(0),
          color: "#9ca3af",
        },
      },
      series: [
        {
          type: "bar",
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i] },
          })),
          barWidth: "100%",
          markLine: markLines.length
            ? {
                silent: true,
                symbol: "none",
                label: {
                  fontSize: 10,
                  color: "#9ca3af",
                },
                data: markLines,
              }
            : undefined,
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
      <h3 class="text-lg font-semibold text-white">Gewinn pro Trade</h3>
    </template>
    <div ref="chartRef" class="h-40 w-full" />
  </UCard>
</template>
