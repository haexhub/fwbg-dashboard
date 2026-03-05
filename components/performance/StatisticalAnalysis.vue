<script setup lang="ts">
interface QualityMetrics {
  expectancy: number;
  payoff_ratio: number;
  sqn: number;
  kelly_pct: number;
}

interface StreakData {
  max_consecutive_wins: number;
  max_consecutive_losses: number;
}

interface DrawdownData {
  max_drawdown: number;
  longest_drawdown_trades: number;
}

interface BarsHeldData {
  avg: number;
  median: number;
  min: number;
  max: number;
}

interface HourlyData {
  hour: number;
  count: number;
  win_rate: number;
  avg_pnl: number;
  total_pnl: number;
}

interface DirectionDetail {
  count: number;
  win_rate: number;
  avg_pnl: number;
  total_pnl: number;
  quality: QualityMetrics;
  streaks: StreakData;
  drawdown: DrawdownData;
  bars_held: BarsHeldData;
  equity_curve: number[];
  hourly: HourlyData[];
}

interface SignificanceTest {
  t_stat: number;
  p_value: number;
  significant: boolean;
  n: number;
}

interface FoldData {
  fold_id: number;
  count: number;
  win_rate: number;
  avg_pnl: number;
  total_pnl: number;
  profit_factor: number;
}

interface AnalysisData {
  total_trades: number;
  direction: { long: DirectionDetail; short: DirectionDetail };
  quality: QualityMetrics;
  streaks: StreakData;
  drawdown: DrawdownData;
  significance: SignificanceTest;
  bars_held: BarsHeldData;
  equity_curve: number[];
  hourly: HourlyData[];
  fold_stability: FoldData[];
}

const props = defineProps<{
  runId: string;
  symbol: string;
}>();

const { data: analysis, status } = useFetch<AnalysisData>(
  () => `/api/runs/${props.runId}/analysis/${props.symbol}`,
  { watch: [() => props.symbol] },
);

// Charts
const equityChartRef = ref<HTMLElement | null>(null);
const { setOption: setEquityOption } = useEChart(equityChartRef);

const hourlyChartRef = ref<HTMLElement | null>(null);
const { setOption: setHourlyOption } = useEChart(hourlyChartRef);

const foldChartRef = ref<HTMLElement | null>(null);
const { setOption: setFoldOption } = useEChart(foldChartRef);

function fmt(v: number, decimals = 2): string {
  return v.toFixed(decimals);
}

function pnlColor(v: number): string {
  return v > 0 ? "text-green-500" : v < 0 ? "text-red-500" : "text-gray-400";
}

watch(
  analysis,
  (data) => {
    if (!data) return;

    // Equity curves (All / Long / Short)
    const allEq = data.equity_curve;
    const longEq = data.direction.long.equity_curve;
    const shortEq = data.direction.short.equity_curve;
    if (allEq.length > 0) {
      setEquityOption({
        tooltip: {
          trigger: "axis",
          formatter: (params: { seriesName: string; value: number }[]) =>
            params
              .map((p) => `${p.seriesName}: ${fmt(p.value, 1)}`)
              .join("<br/>"),
        },
        legend: {
          data: ["Gesamt", "Long", "Short"],
          textStyle: { color: "#9ca3af", fontSize: 11 },
          top: 0,
        },
        xAxis: {
          type: "category",
          show: false,
          data: allEq.map((_, i) => String(i + 1)),
        },
        yAxis: {
          type: "value",
          axisLabel: { color: "#9ca3af", fontSize: 10 },
          splitLine: { lineStyle: { color: "#1f2937" } },
        },
        grid: { left: 55, right: 15, top: 30, bottom: 10 },
        series: [
          {
            name: "Gesamt",
            type: "line",
            data: allEq,
            lineStyle: { color: "#60a5fa", width: 2 },
            itemStyle: { color: "#60a5fa" },
            showSymbol: false,
          },
          {
            name: "Long",
            type: "line",
            data: longEq,
            lineStyle: { color: "#22c55e", width: 1.5 },
            itemStyle: { color: "#22c55e" },
            showSymbol: false,
          },
          {
            name: "Short",
            type: "line",
            data: shortEq,
            lineStyle: { color: "#ef4444", width: 1.5 },
            itemStyle: { color: "#ef4444" },
            showSymbol: false,
          },
        ],
      });
    }

    // Hourly distribution: grouped bars (Long + Short)
    if (data.hourly.length > 0) {
      const allHours = new Set<number>();
      data.hourly.forEach((h) => allHours.add(h.hour));
      data.direction.long.hourly.forEach((h) => allHours.add(h.hour));
      data.direction.short.hourly.forEach((h) => allHours.add(h.hour));
      const hours = [...allHours].sort((a, b) => a - b);

      const longMap = new Map(data.direction.long.hourly.map((h) => [h.hour, h]));
      const shortMap = new Map(data.direction.short.hourly.map((h) => [h.hour, h]));

      setHourlyOption({
        tooltip: {
          trigger: "axis",
          formatter: (params: { seriesName: string; value: number; name: string }[]) => {
            const h = Number(params[0].name);
            let html = `<b>${String(h).padStart(2, "0")}:00</b>`;
            for (const p of params) {
              const color = p.seriesName === "Long" ? "#22c55e" : "#ef4444";
              html += `<br/><span style="color:${color}">${p.seriesName}:</span> ${fmt(p.value, 1)}`;
            }
            const lh = longMap.get(h);
            const sh = shortMap.get(h);
            if (lh) html += `<br/>Long Trades: ${lh.count} (${lh.win_rate}% WR)`;
            if (sh) html += `<br/>Short Trades: ${sh.count} (${sh.win_rate}% WR)`;
            return html;
          },
        },
        legend: {
          data: ["Long", "Short"],
          textStyle: { color: "#9ca3af", fontSize: 11 },
          top: 0,
        },
        xAxis: {
          type: "category",
          data: hours.map((h) => String(h)),
          axisLabel: { color: "#9ca3af", fontSize: 10 },
          axisLine: { lineStyle: { color: "#374151" } },
        },
        yAxis: {
          type: "value",
          axisLabel: { color: "#9ca3af", fontSize: 10 },
          splitLine: { lineStyle: { color: "#1f2937" } },
        },
        grid: { left: 50, right: 15, top: 30, bottom: 30 },
        series: [
          {
            name: "Long",
            type: "bar",
            data: hours.map((h) => longMap.get(h)?.total_pnl ?? 0),
            itemStyle: { color: "#22c55e" },
          },
          {
            name: "Short",
            type: "bar",
            data: hours.map((h) => shortMap.get(h)?.total_pnl ?? 0),
            itemStyle: { color: "#ef4444" },
          },
        ],
      });
    }

    // Fold stability chart
    if (data.fold_stability.length > 0) {
      setFoldOption({
        tooltip: {
          trigger: "axis",
          formatter: (params: { name: string; value: number; seriesName: string }[]) => {
            const fold = data.fold_stability[Number(params[0].name.replace("F", ""))];
            if (!fold) return "";
            return `<b>Fold ${fold.fold_id}</b><br/>Trades: ${fold.count}<br/>Win Rate: ${fold.win_rate}%<br/>PF: ${fold.profit_factor}<br/>Total PnL: ${fmt(fold.total_pnl, 2)}`;
          },
        },
        xAxis: {
          type: "category",
          data: data.fold_stability.map((f) => `F${f.fold_id}`),
          axisLabel: { color: "#9ca3af" },
          axisLine: { lineStyle: { color: "#374151" } },
        },
        yAxis: [
          {
            type: "value",
            name: "PnL",
            axisLabel: { color: "#9ca3af", fontSize: 10 },
            splitLine: { lineStyle: { color: "#1f2937" } },
          },
          {
            type: "value",
            name: "Win %",
            min: 0,
            max: 100,
            axisLabel: { color: "#9ca3af", fontSize: 10, formatter: "{value}%" },
            splitLine: { show: false },
          },
        ],
        grid: { left: 55, right: 55, top: 25, bottom: 30 },
        series: [
          {
            type: "bar",
            name: "Total PnL",
            data: data.fold_stability.map((f) => ({
              value: f.total_pnl,
              itemStyle: {
                color: f.total_pnl >= 0 ? "#22c55e" : "#ef4444",
              },
            })),
          },
          {
            type: "line",
            name: "Win Rate",
            yAxisIndex: 1,
            data: data.fold_stability.map((f) => f.win_rate),
            lineStyle: { color: "#60a5fa", width: 2 },
            itemStyle: { color: "#60a5fa" },
            symbol: "circle",
            symbolSize: 6,
          },
        ],
      });
    }
  },
  { immediate: true },
);

const sqnLabel = computed(() => {
  const sqn = analysis.value?.quality.sqn ?? 0;
  if (sqn >= 3) return "Excellent";
  if (sqn >= 2) return "Good";
  if (sqn >= 1.5) return "Above Average";
  if (sqn >= 0.7) return "Average";
  return "Poor";
});

const sqnColor = computed(() => {
  const sqn = analysis.value?.quality.sqn ?? 0;
  if (sqn >= 2) return "text-green-500";
  if (sqn >= 1) return "text-yellow-500";
  return "text-red-500";
});

// Helper to build comparison rows for the direction detail table
interface MetricRow {
  label: string;
  long: string;
  short: string;
  longColor?: string;
  shortColor?: string;
}

const directionMetrics = computed<MetricRow[]>(() => {
  if (!analysis.value) return [];
  const l = analysis.value.direction.long;
  const s = analysis.value.direction.short;
  return [
    { label: "Trades", long: String(l.count), short: String(s.count) },
    { label: "Win Rate", long: `${l.win_rate}%`, short: `${s.win_rate}%` },
    {
      label: "Total PnL",
      long: fmt(l.total_pnl, 1),
      short: fmt(s.total_pnl, 1),
      longColor: pnlColor(l.total_pnl),
      shortColor: pnlColor(s.total_pnl),
    },
    {
      label: "Avg PnL",
      long: fmt(l.avg_pnl),
      short: fmt(s.avg_pnl),
      longColor: pnlColor(l.avg_pnl),
      shortColor: pnlColor(s.avg_pnl),
    },
    {
      label: "Expectancy",
      long: fmt(l.quality.expectancy),
      short: fmt(s.quality.expectancy),
      longColor: pnlColor(l.quality.expectancy),
      shortColor: pnlColor(s.quality.expectancy),
    },
    { label: "Payoff Ratio", long: fmt(l.quality.payoff_ratio), short: fmt(s.quality.payoff_ratio) },
    {
      label: "Profit Factor",
      long: l.quality.payoff_ratio > 0 ? fmt(l.win_rate / 100 * l.quality.payoff_ratio / ((1 - l.win_rate / 100) || 0.01), 2) : "0.00",
      short: s.quality.payoff_ratio > 0 ? fmt(s.win_rate / 100 * s.quality.payoff_ratio / ((1 - s.win_rate / 100) || 0.01), 2) : "0.00",
    },
    {
      label: "SQN",
      long: fmt(l.quality.sqn),
      short: fmt(s.quality.sqn),
      longColor: l.quality.sqn >= 2 ? "text-green-500" : l.quality.sqn >= 1 ? "text-yellow-500" : "text-red-500",
      shortColor: s.quality.sqn >= 2 ? "text-green-500" : s.quality.sqn >= 1 ? "text-yellow-500" : "text-red-500",
    },
    { label: "Kelly %", long: `${fmt(l.quality.kelly_pct, 1)}%`, short: `${fmt(s.quality.kelly_pct, 1)}%` },
    {
      label: "Max DD",
      long: fmt(l.drawdown.max_drawdown, 1),
      short: fmt(s.drawdown.max_drawdown, 1),
      longColor: "text-red-500",
      shortColor: "text-red-500",
    },
    { label: "Max Gewinnserie", long: String(l.streaks.max_consecutive_wins), short: String(s.streaks.max_consecutive_wins) },
    { label: "Max Verlustserie", long: String(l.streaks.max_consecutive_losses), short: String(s.streaks.max_consecutive_losses) },
    { label: "Ø Dauer (Bars)", long: fmt(l.bars_held.avg, 0), short: fmt(s.bars_held.avg, 0) },
    { label: "Median Dauer", long: String(l.bars_held.median), short: String(s.bars_held.median) },
  ];
});
</script>

<template>
  <div v-if="status === 'pending'" class="py-8 text-center text-gray-400">
    Berechne statistische Analyse...
  </div>

  <div v-else-if="analysis" class="space-y-4">
    <!-- Trade Quality & Significance -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
      <UCard>
        <div class="text-center">
          <p class="text-xs text-gray-400">Expectancy</p>
          <p :class="['text-xl font-bold', pnlColor(analysis.quality.expectancy)]">
            {{ fmt(analysis.quality.expectancy) }}
          </p>
          <p class="text-xs text-gray-500">Ø pro Trade</p>
        </div>
      </UCard>

      <UCard>
        <div class="text-center">
          <p class="text-xs text-gray-400">Payoff Ratio</p>
          <p class="text-xl font-bold text-white">
            {{ fmt(analysis.quality.payoff_ratio) }}
          </p>
          <p class="text-xs text-gray-500">Avg Win / Avg Loss</p>
        </div>
      </UCard>

      <UCard>
        <div class="text-center">
          <p class="text-xs text-gray-400">SQN</p>
          <p :class="['text-xl font-bold', sqnColor]">
            {{ fmt(analysis.quality.sqn) }}
          </p>
          <p class="text-xs text-gray-500">{{ sqnLabel }}</p>
        </div>
      </UCard>

      <UCard>
        <div class="text-center">
          <p class="text-xs text-gray-400">Kelly %</p>
          <p class="text-xl font-bold text-white">
            {{ fmt(analysis.quality.kelly_pct, 1) }}%
          </p>
          <p class="text-xs text-gray-500">Optimale Positionsgr.</p>
        </div>
      </UCard>

      <UCard>
        <div class="text-center">
          <p class="text-xs text-gray-400">p-Wert</p>
          <p :class="['text-xl font-bold', analysis.significance.significant ? 'text-green-500' : 'text-red-500']">
            {{ fmt(analysis.significance.p_value, 4) }}
          </p>
          <p class="text-xs text-gray-500">
            {{ analysis.significance.significant ? "Signifikant" : "Nicht signifikant" }}
          </p>
        </div>
      </UCard>

      <UCard>
        <div class="text-center">
          <p class="text-xs text-gray-400">t-Statistik</p>
          <p class="text-xl font-bold text-white">
            {{ fmt(analysis.significance.t_stat, 3) }}
          </p>
          <p class="text-xs text-gray-500">n={{ analysis.significance.n }}</p>
        </div>
      </UCard>
    </div>

    <!-- Equity Curves: All / Long / Short -->
    <UCard>
      <template #header>
        <h3 class="text-sm font-semibold text-white">Equity-Kurven (Gesamt / Long / Short)</h3>
      </template>
      <div ref="equityChartRef" class="h-72 w-full" />
    </UCard>

    <!-- Long vs Short Comparison Table -->
    <UCard>
      <template #header>
        <h3 class="text-sm font-semibold text-white">Long vs Short Vergleich</h3>
      </template>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700 text-gray-400">
              <th class="px-3 py-2 text-left">Metrik</th>
              <th class="px-3 py-2 text-right text-green-500">Long</th>
              <th class="px-3 py-2 text-right text-red-500">Short</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in directionMetrics"
              :key="row.label"
              class="border-b border-gray-800"
            >
              <td class="px-3 py-1.5 text-gray-400">{{ row.label }}</td>
              <td :class="['px-3 py-1.5 text-right font-mono', row.longColor ?? 'text-white']">
                {{ row.long }}
              </td>
              <td :class="['px-3 py-1.5 text-right font-mono', row.shortColor ?? 'text-white']">
                {{ row.short }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Direction bias bar -->
      <div class="mt-3 px-3 pb-1">
        <div class="h-2 w-full overflow-hidden rounded-full bg-gray-700">
          <div
            class="h-full bg-blue-500"
            :style="{ width: `${analysis.total_trades > 0 ? (analysis.direction.long.count / analysis.total_trades) * 100 : 50}%` }"
          />
        </div>
        <p class="mt-1 text-center text-xs text-gray-500">
          Long {{ Math.round(analysis.direction.long.count / analysis.total_trades * 100) }}%
          / Short {{ Math.round(analysis.direction.short.count / analysis.total_trades * 100) }}%
        </p>
      </div>
    </UCard>

    <!-- Streaks + Drawdown + Duration -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <UCard>
        <template #header>
          <h3 class="text-sm font-semibold text-white">Streaks & Drawdown</h3>
        </template>
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-sm text-gray-400">Max Gewinnserie</span>
            <span class="font-mono text-sm font-bold text-green-500">
              {{ analysis.streaks.max_consecutive_wins }}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-400">Max Verlustserie</span>
            <span class="font-mono text-sm font-bold text-red-500">
              {{ analysis.streaks.max_consecutive_losses }}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-400">Max Drawdown</span>
            <span class="font-mono text-sm font-bold text-red-500">
              {{ fmt(analysis.drawdown.max_drawdown, 1) }}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-400">Längster DD</span>
            <span class="font-mono text-sm text-white">
              {{ analysis.drawdown.longest_drawdown_trades }} Trades
            </span>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="text-sm font-semibold text-white">Trade-Dauer (Bars)</h3>
        </template>
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-sm text-gray-400">Durchschnitt</span>
            <span class="font-mono text-sm text-white">{{ fmt(analysis.bars_held.avg, 0) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-400">Median</span>
            <span class="font-mono text-sm text-white">{{ analysis.bars_held.median }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-400">Min / Max</span>
            <span class="font-mono text-sm text-white">{{ analysis.bars_held.min }} / {{ analysis.bars_held.max }}</span>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="text-sm font-semibold text-white">Signifikanztest</h3>
        </template>
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-sm text-gray-400">t-Statistik</span>
            <span class="font-mono text-sm text-white">{{ fmt(analysis.significance.t_stat, 3) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-400">p-Wert</span>
            <span :class="['font-mono text-sm font-bold', analysis.significance.significant ? 'text-green-500' : 'text-red-500']">
              {{ fmt(analysis.significance.p_value, 4) }}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-400">Stichprobe</span>
            <span class="font-mono text-sm text-white">n={{ analysis.significance.n }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-400">Ergebnis</span>
            <span :class="['text-sm font-bold', analysis.significance.significant ? 'text-green-500' : 'text-red-500']">
              {{ analysis.significance.significant ? "Signifikant (p < 0.05)" : "Nicht signifikant" }}
            </span>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Charts: Hourly (Long/Short) + Fold Stability -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <UCard>
        <template #header>
          <h3 class="text-sm font-semibold text-white">PnL nach Stunde (Long / Short)</h3>
        </template>
        <div ref="hourlyChartRef" class="h-64 w-full" />
      </UCard>

      <UCard>
        <template #header>
          <h3 class="text-sm font-semibold text-white">Fold-Stabilität</h3>
        </template>
        <div ref="foldChartRef" class="h-64 w-full" />
      </UCard>
    </div>

    <!-- Fold Table -->
    <UCard>
      <template #header>
        <h3 class="text-sm font-semibold text-white">Walk-Forward Folds</h3>
      </template>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700 text-gray-400">
              <th class="px-3 py-2 text-left">Fold</th>
              <th class="px-3 py-2 text-right">Trades</th>
              <th class="px-3 py-2 text-right">Win Rate</th>
              <th class="px-3 py-2 text-right">Profit Factor</th>
              <th class="px-3 py-2 text-right">Avg PnL</th>
              <th class="px-3 py-2 text-right">Total PnL</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="fold in analysis.fold_stability"
              :key="fold.fold_id"
              class="border-b border-gray-800"
            >
              <td class="px-3 py-2 font-mono text-white">{{ fold.fold_id }}</td>
              <td class="px-3 py-2 text-right text-gray-300">{{ fold.count }}</td>
              <td class="px-3 py-2 text-right text-gray-300">{{ fold.win_rate }}%</td>
              <td :class="['px-3 py-2 text-right font-mono', fold.profit_factor >= 1 ? 'text-green-500' : 'text-red-500']">
                {{ fmt(fold.profit_factor) }}
              </td>
              <td :class="['px-3 py-2 text-right font-mono', pnlColor(fold.avg_pnl)]">
                {{ fmt(fold.avg_pnl) }}
              </td>
              <td :class="['px-3 py-2 text-right font-mono font-bold', pnlColor(fold.total_pnl)]">
                {{ fmt(fold.total_pnl, 1) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
