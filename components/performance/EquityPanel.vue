<script setup lang="ts">
import type { EquitySimPoint } from "~/types/performance";

const props = withDefaults(
  defineProps<{
    simulation: EquitySimPoint[];
    profitPerTrade: number[];
    logScale?: boolean;
  }>(),
  { logScale: true },
);

const chartRef = ref<HTMLElement | null>(null);
const { setOption } = useEChart(chartRef);

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
  return val.toFixed(0);
}

watch(
  () => [props.simulation, props.profitPerTrade],
  () => {
    const sim = props.simulation;
    const ppt = props.profitPerTrade;
    if (sim.length < 2 || !ppt.length) return;

    // Shared X axis: trade indices (skip first equity point which is starting equity)
    const tradeCount = ppt.length;
    const indices = Array.from({ length: tradeCount }, (_, i) => i + 1);

    // Equity data (offset by 1 since sim includes start point at index 0)
    const equityValues = sim.slice(1).map((p) => p.equity);
    const drawdownValues = sim.slice(1).map((p) => p.drawdownPct);
    const maxDd = Math.max(...drawdownValues, 1);

    // Profit per trade avg lines
    const wins = ppt.filter((v) => v > 0);
    const losses = ppt.filter((v) => v < 0);
    const avgWin = wins.length ? wins.reduce((s, v) => s + v, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, v) => s + v, 0) / losses.length : 0;
    const maxAbs = Math.max(
      Math.abs(Math.min(...ppt)),
      Math.abs(Math.max(...ppt)),
      1,
    );

    const markLines: { yAxis: number; label: { formatter: string; position: "insideEndTop" | "insideEndBottom" }; lineStyle: { color: string; type: "dashed" } }[] = [];
    if (avgWin > 0) {
      markLines.push({
        yAxis: avgWin,
        label: { formatter: `Ø Win: ${avgWin.toFixed(1)}`, position: "insideEndTop" as const },
        lineStyle: { color: "#22c55e", type: "dashed" as const },
      });
    }
    if (avgLoss < 0) {
      markLines.push({
        yAxis: avgLoss,
        label: { formatter: `Ø Loss: ${avgLoss.toFixed(1)}`, position: "insideEndBottom" as const },
        lineStyle: { color: "#ef4444", type: "dashed" as const },
      });
    }

    setOption({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", link: [{ xAxisIndex: "all" }] },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || !params.length) return "";
          const idx = (params[0] as { dataIndex: number }).dataIndex;
          let html = `<b>Trade #${idx + 1}</b><br/>`;
          for (const p of params as { seriesName: string; value: number; color: string }[]) {
            const val = p.value;
            if (p.seriesName === "Equity") {
              html += `<span style="color:${p.color}">●</span> Equity: <b>${formatCurrency(val)}</b><br/>`;
            } else if (p.seriesName === "Drawdown") {
              html += `<span style="color:${p.color}">●</span> DD: <b>${val.toFixed(1)}%</b><br/>`;
            } else if (p.seriesName === "P&L") {
              html += `<span style="color:${val > 0 ? "#22c55e" : "#ef4444"}">●</span> P&L: <b>${val > 0 ? "+" : ""}${val.toFixed(1)}</b><br/>`;
            }
          }
          return html;
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
      },
      grid: [
        // Equity curve (top)
        { left: 60, right: 20, top: 30, height: "34%" },
        // Drawdown (middle)
        { left: 60, right: 20, top: "50%", height: "14%" },
        // Profit per trade (bottom, more gap above)
        { left: 60, right: 20, top: "74%", height: "20%" },
      ],
      xAxis: [
        {
          type: "category",
          data: indices,
          gridIndex: 0,
          axisLabel: { show: false },
          axisLine: { lineStyle: { color: "#374151" } },
        },
        {
          type: "category",
          data: indices,
          gridIndex: 1,
          axisLabel: { show: false },
          axisLine: { lineStyle: { color: "#374151" } },
        },
        {
          type: "category",
          data: indices,
          gridIndex: 2,
          axisLabel: {
            show: true,
            interval: Math.max(1, Math.floor(tradeCount / 8)),
            color: "#9ca3af",
            fontSize: 10,
          },
          axisLine: { lineStyle: { color: "#374151" } },
        },
      ],
      yAxis: [
        // Equity (log or linear scale)
        props.logScale
          ? {
              type: "log" as const,
              gridIndex: 0,
              name: "Kapital (log)",
              nameTextStyle: { color: "#9ca3af", fontSize: 10 },
              min: Math.max(1, Math.min(...equityValues) * 0.8),
              splitLine: { lineStyle: { color: "#1f2937" } },
              axisLine: { lineStyle: { color: "#374151" } },
              axisLabel: {
                formatter: (val: number) => formatCurrency(val),
                color: "#9ca3af",
                fontSize: 10,
              },
            }
          : {
              type: "value" as const,
              gridIndex: 0,
              name: "P&L",
              nameTextStyle: { color: "#9ca3af", fontSize: 10 },
              splitLine: { lineStyle: { color: "#1f2937" } },
              axisLine: { lineStyle: { color: "#374151" } },
              axisLabel: {
                formatter: (val: number) => formatCurrency(val),
                color: "#9ca3af",
                fontSize: 10,
              },
            },
        // Drawdown (inverted)
        {
          type: "value",
          gridIndex: 1,
          name: "DD %",
          nameLocation: "start",
          nameTextStyle: { color: "#9ca3af", fontSize: 10 },
          inverse: true,
          min: 0,
          max: Math.ceil(maxDd * 1.1),
          splitLine: { lineStyle: { color: "#1f2937" } },
          axisLine: { lineStyle: { color: "#374151" } },
          axisLabel: {
            formatter: (val: number) => `${val.toFixed(0)}%`,
            color: "#9ca3af",
            fontSize: 10,
          },
        },
        // Profit per trade
        {
          type: "value",
          gridIndex: 2,
          name: "P&L/Trade",
          nameTextStyle: { color: "#9ca3af", fontSize: 10 },
          min: -maxAbs * 1.1,
          max: maxAbs * 1.1,
          splitLine: { lineStyle: { color: "#1f2937" } },
          axisLine: { lineStyle: { color: "#374151" } },
          axisLabel: {
            formatter: (val: number) => val.toFixed(0),
            color: "#9ca3af",
            fontSize: 10,
          },
        },
      ],
      series: [
        // Equity curve
        {
          name: "Equity",
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: equityValues,
          smooth: false,
          symbol: "none",
          lineStyle: { width: 1.5, color: "#3b82f6" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(59, 130, 246, 0.3)" },
                { offset: 1, color: "rgba(59, 130, 246, 0.02)" },
              ],
            },
          },
        },
        // Drawdown
        {
          name: "Drawdown",
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: drawdownValues,
          smooth: false,
          symbol: "none",
          lineStyle: { width: 0 },
          areaStyle: { color: "rgba(239, 68, 68, 0.5)" },
          itemStyle: { color: "#ef4444" },
        },
        // Profit per trade
        {
          name: "P&L",
          type: "bar",
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: ppt.map((v) => ({
            value: v,
            itemStyle: { color: v > 0 ? "#22c55e" : "#ef4444" },
          })),
          barWidth: "100%",
          markLine: markLines.length
            ? {
                silent: true,
                symbol: "none",
                label: { fontSize: 9, color: "#9ca3af" },
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
      <h3 class="text-lg font-semibold text-white">
        Equity · Drawdown · Gewinn pro Trade
      </h3>
    </template>
    <div ref="chartRef" class="h-[500px] w-full" />
  </UCard>
</template>
