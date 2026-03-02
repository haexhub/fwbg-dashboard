import type { RunDetail } from "~/types/strategy";
import type {
  GridDetail,
  TradeTraceEntry,
  NormalizedTrace,
} from "~/types/grid-detail";
import type {
  PerformanceData,
  EquityPoint,
  EquitySimPoint,
  TradeRecord,
  AssetPerformance,
} from "~/types/performance";

/**
 * Fetches run detail + grid details and aggregates into PerformanceData.
 */
export function useRunPerformance(runId: string) {
  const detail = ref<RunDetail | null>(null);
  const gridDetails = ref<GridDetail[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function load() {
    loading.value = true;
    error.value = null;

    try {
      detail.value = await $fetch<RunDetail>(`/api/runs/${runId}`);

      const filenames = await $fetch<string[]>(
        `/api/runs/${runId}/grid-details`,
      );

      const details = await Promise.all(
        filenames.map((f) =>
          $fetch<GridDetail>(`/api/runs/${runId}/grid-details/${f}`),
        ),
      );
      gridDetails.value = details;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "Failed to load run data";
    } finally {
      loading.value = false;
    }
  }

  const performance = computed<PerformanceData | null>(() => {
    if (!gridDetails.value.length) return null;
    return aggregatePerformance(gridDetails.value);
  });

  return { detail, gridDetails, performance, loading, error, load };
}

function normalizeTrace(entry: TradeTraceEntry): NormalizedTrace {
  if (typeof entry === "number") {
    return { result: entry > 0 ? 1 : -1, pnl: 0, hasPnl: false };
  }
  return {
    result: entry.result > 0 ? 1 : -1,
    pnl: entry.pnl_raw,
    hasPnl: true,
  };
}

function getAssetConfig(d: GridDetail): Record<string, unknown> | undefined {
  return d.selected_config ?? d.best_config;
}

// ── PnL-based Equity Simulation (mirrors fwbg simulate_equity_from_pnl) ──

interface EquitySimResult {
  equityCurve: number[];
  finalEquity: number;
  maxDrawdown: number; // 0-1 fraction
  drawdowns: number[]; // percentage values
  profitPerTrade: number[];
}

/**
 * Convert raw PnL values to Kelly-scaled returns.
 * Mirrors fwbg.simulation.trade.pnl_to_returns:
 * Scales so average loss return = exactly -fk.
 */
function pnlToReturns(pnlRaw: number[], fk: number): number[] {
  const losses = pnlRaw.filter((p) => p < 0).map((p) => Math.abs(p));
  const scale =
    losses.length > 0
      ? losses.reduce((s, v) => s + v, 0) / losses.length
      : pnlRaw.reduce((s, v) => s + Math.abs(v), 0) / pnlRaw.length || 1;
  return pnlRaw.map((p) => (fk * p) / scale);
}

/**
 * Equity simulation using actual PnL values (not binary win/loss).
 * Mirrors fwbg.simulation.equity.simulate_equity_from_pnl.
 */
function simulateEquityFromPnl(
  pnlRaw: number[],
  riskPerTrade: number,
  startEquity = 100.0,
  compoundCap = 1e6,
): EquitySimResult {
  if (!pnlRaw.length) {
    return {
      equityCurve: [startEquity],
      finalEquity: startEquity,
      maxDrawdown: 0,
      drawdowns: [0],
      profitPerTrade: [],
    };
  }

  const returns = pnlToReturns(pnlRaw, riskPerTrade);
  let equity = startEquity;
  const equityCurve = [equity];
  let peak = equity;
  let maxDd = 0;
  const drawdowns = [0];
  const profitPerTrade: number[] = [];

  for (const r of returns) {
    const effectiveEquity = Math.min(equity, compoundCap);
    const prevEquity = equity;
    equity += effectiveEquity * r;

    equityCurve.push(equity);
    profitPerTrade.push(equity - prevEquity);

    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd > maxDd) maxDd = dd;
    drawdowns.push(dd * 100);

    if (equity <= 0) {
      equity = 0;
      maxDd = 1.0;
      break;
    }
  }

  return {
    equityCurve,
    finalEquity: equity,
    maxDrawdown: maxDd,
    drawdowns,
    profitPerTrade,
  };
}

/** Pre-processed fold data for interleaved trade building */
interface PreparedFold {
  symbol: string;
  foldIdx: number;
  traces: NormalizedTrace[];
  hasPnl: boolean;
  winPnl: number;
  lossPnl: number;
  slMult: number | undefined;
  timestamp: string;
  testSize: number;
}

export function aggregatePerformance(details: GridDetail[]): PerformanceData {
  const assetBreakdown: AssetPerformance[] = [];

  // Unified metrics that only the backend can compute
  let sumSharpe = 0;
  let countSharpe = 0;
  let sumCalmar = 0;
  let countCalmar = 0;
  let sumAnnualReturn = 0;
  let countAnnualReturn = 0;
  let sumMaxDdPct = 0;
  let countMaxDd = 0;

  // Risk per trade for equity simulation
  let sumRisk = 0;
  let countRisk = 0;

  // ── Pass 1: read backend-only metrics + prepare fold data ──
  const foldsByIndex = new Map<number, PreparedFold[]>();

  for (const d of details) {
    const config = getAssetConfig(d);

    // Backend-only metrics (can't be computed from fold traces)
    const sharpe = d.sharpe ?? null;
    const calmar = d.calmar ?? null;

    if (sharpe != null && sharpe !== 0) { sumSharpe += sharpe; countSharpe++; }
    if (calmar != null && calmar !== 0) { sumCalmar += calmar; countCalmar++; }
    if (d.annual_return != null) { sumAnnualReturn += d.annual_return; countAnnualReturn++; }
    if (d.max_drawdown != null) { sumMaxDdPct += d.max_drawdown * 100; countMaxDd++; }

    const risk = d.risk_per_trade ?? (config?.risk_per_trade as number) ?? 0.01;
    sumRisk += risk;
    countRisk++;

    // Asset spread for price-based P&L conversion (old runs without pnl_raw)
    const assetSpread = (config?.spread as number) ?? 0;

    // Prepare fold data grouped by fold index
    if (d.walk_forward?.fold_details) {
      for (let fi = 0; fi < d.walk_forward.fold_details.length; fi++) {
        const fold = d.walk_forward.fold_details[fi]!;
        const traces = (fold.test_trades_trace ?? []).map(normalizeTrace);
        if (!traces.length) continue;

        const hasPnl = traces[0]!.hasPnl;
        const foldConfig = fold.best_config ?? config;
        const foldTp = (foldConfig?.tp as number) ?? (config?.tp_mult as number) ?? 10;
        const foldSl = (foldConfig?.sl as number) ?? (config?.sl_mult as number) ?? 10;

        const winPnl = hasPnl ? 0 : foldTp * assetSpread;
        const lossPnl = hasPnl ? 0 : -(foldSl * assetSpread);

        let timestamp = `WF-${fi + 1}`;
        if (fold.test_start) {
          const dt = new Date(fold.test_start);
          if (!isNaN(dt.getTime())) {
            timestamp = dt.toISOString().slice(0, 10);
          }
        }

        const bucket = foldsByIndex.get(fi) ?? [];
        bucket.push({
          symbol: d.symbol,
          foldIdx: fi,
          traces,
          hasPnl,
          winPnl,
          lossPnl,
          slMult: foldSl,
          timestamp,
          testSize: fold.test_size ?? 4000,
        });
        foldsByIndex.set(fi, bucket);
      }
    }
  }

  // ── Pass 2: build trades + compute all metrics from fold data ──
  const trades: TradeRecord[] = [];
  const tradePnlValues: number[] = [];
  const equityCurve: EquityPoint[] = [];
  let cumulative = 0;
  let cumulativePeak = 0;
  let absoluteMaxDrawdown = 0;
  let tradeIdx = 0;

  let totalWins = 0;
  let totalLosses = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  // Per-asset accumulators for breakdown
  const assetPnl = new Map<string, number>();
  const assetWins = new Map<string, number>();
  const assetLosses = new Map<string, number>();
  const assetGrossProfit = new Map<string, number>();
  const assetGrossLoss = new Map<string, number>();

  const sortedFoldIndices = [...foldsByIndex.keys()].sort((a, b) => a - b);

  for (const fi of sortedFoldIndices) {
    const folds = foldsByIndex.get(fi)!;
    const maxLen = Math.max(...folds.map((f) => f.traces.length));

    for (let ti = 0; ti < maxLen; ti++) {
      for (let ai = 0; ai < folds.length; ai++) {
        const pf = folds[ai]!;
        if (ti >= pf.traces.length) continue;
        const t = pf.traces[ti]!;

        let tradePnl: number;
        if (pf.hasPnl) {
          tradePnl = t.pnl;
        } else {
          tradePnl = t.result === 1 ? pf.winPnl : pf.lossPnl;
        }

        tradePnlValues.push(tradePnl);

        if (tradePnl > 0) {
          totalWins++;
          grossProfit += tradePnl;
          assetWins.set(pf.symbol, (assetWins.get(pf.symbol) ?? 0) + 1);
          assetGrossProfit.set(pf.symbol, (assetGrossProfit.get(pf.symbol) ?? 0) + tradePnl);
        } else if (tradePnl < 0) {
          totalLosses++;
          grossLoss += Math.abs(tradePnl);
          assetLosses.set(pf.symbol, (assetLosses.get(pf.symbol) ?? 0) + 1);
          assetGrossLoss.set(pf.symbol, (assetGrossLoss.get(pf.symbol) ?? 0) + Math.abs(tradePnl));
        }

        assetPnl.set(pf.symbol, (assetPnl.get(pf.symbol) ?? 0) + tradePnl);

        trades.push({
          timestamp: pf.timestamp,
          symbol: pf.symbol,
          direction: "LONG",
          pnl: Math.round(tradePnl * 1000) / 1000,
          result: t.result === 1 ? "win" : "loss",
          initialRisk: pf.slMult,
        });

        cumulative += tradePnl;
        if (cumulative > cumulativePeak) cumulativePeak = cumulative;
        const dd = cumulativePeak - cumulative;
        if (dd > absoluteMaxDrawdown) absoluteMaxDrawdown = dd;

        equityCurve.push({
          index: tradeIdx,
          label: `#${tradeIdx + 1}`,
          value: Math.round(cumulative * 100) / 100,
        });
        tradeIdx++;
      }
    }
  }

  // ── Compute metrics from trade data (single source of truth) ──
  const totalTrades = trades.length;
  const netPnl = Math.round(cumulative * 1000) / 1000;
  const winRate = totalTrades > 0
    ? Math.round((totalWins / totalTrades) * 100 * 10) / 10
    : 0;
  const profitFactor = grossLoss > 0
    ? Math.round((grossProfit / grossLoss) * 100) / 100
    : 0;
  const avgWin = totalWins > 0
    ? Math.round((grossProfit / totalWins) * 1000) / 1000
    : 0;
  const avgLoss = totalLosses > 0
    ? Math.round((grossLoss / totalLosses) * 1000) / 1000
    : 0;

  // ── Build asset breakdown from trade data ──
  for (const d of details) {
    const sym = d.symbol;
    const aTrades = (assetWins.get(sym) ?? 0) + (assetLosses.get(sym) ?? 0);
    const aWins = assetWins.get(sym) ?? 0;
    const aPnl = assetPnl.get(sym) ?? 0;
    const aGrossProfit = assetGrossProfit.get(sym) ?? 0;
    const aGrossLoss = assetGrossLoss.get(sym) ?? 0;

    assetBreakdown.push({
      symbol: sym,
      status: d.status,
      trades: aTrades,
      winRate: aTrades > 0 ? Math.round((aWins / aTrades) * 100 * 10) / 10 : 0,
      pnl: Math.round(aPnl * 1000) / 1000,
      sharpeRatio: d.sharpe != null ? Math.round(d.sharpe * 100) / 100 : null,
      calmarRatio: d.calmar != null ? Math.round(d.calmar * 100) / 100 : null,
      profitFactor: aGrossLoss > 0 ? Math.round((aGrossProfit / aGrossLoss) * 100) / 100 : null,
    });
  }

  // ── Equity Simulation (PnL-based, mirrors backend) ──
  const avgRisk = countRisk > 0 ? sumRisk / countRisk : 0.01;
  const sim = simulateEquityFromPnl(tradePnlValues, avgRisk);
  const equitySimulation: EquitySimPoint[] = sim.equityCurve.map((eq, i) => ({
    index: i,
    equity: Math.round(eq * 100) / 100,
    drawdownPct: Math.round((sim.drawdowns[i] ?? 0) * 100) / 100,
  }));

  // Max drawdown %: prefer unified_metrics (backend equity sim), fallback to frontend sim
  const maxDrawdownPct = countMaxDd > 0
    ? Math.round((sumMaxDdPct / countMaxDd) * 10) / 10
    : Math.round(sim.maxDrawdown * 100 * 10) / 10;

  // Annual return: only from unified_metrics (requires test_period_years)
  const annualReturn = countAnnualReturn > 0
    ? Math.round((sumAnnualReturn / countAnnualReturn) * 10) / 10
    : null;

  return {
    totalTrades,
    winRate,
    netPnl,
    profitFactor,
    avgWin,
    avgLoss,
    sharpeRatio:
      countSharpe > 0
        ? Math.round((sumSharpe / countSharpe) * 100) / 100
        : null,
    calmarRatio:
      countCalmar > 0
        ? Math.round((sumCalmar / countCalmar) * 100) / 100
        : null,
    maxDrawdown: Math.round(absoluteMaxDrawdown * 100) / 100,
    maxDrawdownPct,
    annualReturn,
    equityCurve,
    equitySimulation,
    profitPerTrade: sim.profitPerTrade.map((p) => Math.round(p * 100) / 100),
    trades,
    assetBreakdown: assetBreakdown.sort((a, b) => b.pnl - a.pnl),
  };
}
