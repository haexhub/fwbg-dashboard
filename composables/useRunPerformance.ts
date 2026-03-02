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

// ── Equity Simulation (mirrors fwbg simulate_equity) ──

interface EquitySimResult {
  equityCurve: number[];
  finalEquity: number;
  maxDrawdown: number; // 0-1 fraction
  drawdowns: number[]; // percentage values
  profitPerTrade: number[];
}

function simulateEquity(
  tradeResults: number[], // +1 win, -1 loss
  riskPerTrade: number,
  rrr: number,
  startEquity = 100.0,
  compoundCap = 1e6,
): EquitySimResult {
  let equity = startEquity;
  const equityCurve = [equity];
  let peak = equity;
  let maxDd = 0;
  const drawdowns = [0];
  const profitPerTrade: number[] = [];

  for (const result of tradeResults) {
    const effectiveEquity = Math.min(equity, compoundCap);
    const prevEquity = equity;

    if (result > 0) {
      equity += effectiveEquity * riskPerTrade * rrr;
    } else {
      equity -= effectiveEquity * riskPerTrade;
    }

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
  winPnl: number; // price-based per-trade P&L for wins
  lossPnl: number; // price-based per-trade P&L for losses (negative)
  slMult: number | undefined;
  timestamp: string; // fold date or "WF-N" fallback
  testSize: number; // number of bars in test period
}

export function aggregatePerformance(details: GridDetail[]): PerformanceData {
  const assetBreakdown: AssetPerformance[] = [];
  let totalTrades = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let sumSharpe = 0;
  let countSharpe = 0;
  let sumCalmar = 0;
  let countCalmar = 0;
  let sumRisk = 0;
  let sumRrr = 0;
  let countRiskRrr = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let sumAvgWin = 0;
  let sumAvgLoss = 0;
  let countAvgWinLoss = 0;

  // Aggregate unified metrics from all assets
  let sumAnnualReturn = 0;
  let countAnnualReturn = 0;
  let sumMaxDdPct = 0;
  let countMaxDd = 0;
  let totalNetPnl = 0;

  // ── Pass 1: read unified metrics from each asset ──
  const foldsByIndex = new Map<number, PreparedFold[]>();

  for (const d of details) {
    const config = getAssetConfig(d);

    // Read metrics directly from top-level (merged from unified_metrics.json)
    const assetTrades = d.trades ?? d.walk_forward?.total_trades ?? 0;
    const winRate = d.win_rate ?? d.walk_forward?.mean_win_rate ?? 0;
    const pnl = d.pnl ?? d.walk_forward?.mean_pnl ?? 0;
    const sharpe = d.sharpe ?? null;
    const calmar = d.calmar ?? null;
    const assetRrr = d.rrr ?? 1;
    const assetProfitFactor = d.profit_factor ?? null;

    totalTrades += assetTrades;
    totalWins += d.n_wins ?? Math.round(assetTrades * winRate);
    totalLosses += d.n_losses ?? Math.round(assetTrades * (1 - winRate));
    totalNetPnl += pnl;

    if (sharpe != null && sharpe !== 0) { sumSharpe += sharpe; countSharpe++; }
    if (calmar != null && calmar !== 0) { sumCalmar += calmar; countCalmar++; }

    if (d.annual_return != null) {
      sumAnnualReturn += d.annual_return;
      countAnnualReturn++;
    }
    if (d.max_drawdown != null) {
      sumMaxDdPct += d.max_drawdown * 100;
      countMaxDd++;
    }
    if (d.avg_win != null && d.avg_loss != null) {
      sumAvgWin += d.avg_win;
      sumAvgLoss += d.avg_loss;
      countAvgWinLoss++;
    }
    if (d.profit_factor != null) {
      grossProfit += d.avg_win != null && d.n_wins != null ? d.avg_win * d.n_wins : 0;
      grossLoss += d.avg_loss != null && d.n_losses != null ? d.avg_loss * d.n_losses : 0;
    }

    // Collect risk/rrr for equity simulation
    const risk = d.risk_per_trade ?? (config?.risk_per_trade as number) ?? 0.01;
    sumRisk += risk;
    sumRrr += assetRrr;
    countRiskRrr++;

    assetBreakdown.push({
      symbol: d.symbol,
      status: d.status,
      trades: assetTrades,
      winRate: Math.round(winRate * 100 * 10) / 10,
      pnl: Math.round(pnl * 1000) / 1000,
      sharpeRatio: sharpe != null ? Math.round(sharpe * 100) / 100 : null,
      calmarRatio: calmar != null ? Math.round(calmar * 100) / 100 : null,
      profitFactor: assetProfitFactor,
    });

    // Asset spread for price-based P&L conversion (old runs)
    const assetSpread = (config?.spread as number) ?? 0;

    // Prepare fold data grouped by fold index (for equity curve visualization)
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

  // ── Pass 2: build trades from fold data (for equity curve visualization) ──
  const trades: TradeRecord[] = [];
  const equityCurve: EquityPoint[] = [];
  const tradeResults: number[] = [];
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let tradeIdx = 0;

  // Only recompute from folds if unified metrics are missing
  let foldGrossProfit = 0;
  let foldGrossLoss = 0;

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

        if (tradePnl > 0) foldGrossProfit += tradePnl;
        else if (tradePnl < 0) foldGrossLoss += Math.abs(tradePnl);

        tradeResults.push(t.result);

        trades.push({
          timestamp: pf.timestamp,
          symbol: pf.symbol,
          direction: "LONG",
          pnl: Math.round(tradePnl * 1000) / 1000,
          result: t.result === 1 ? "win" : "loss",
          initialRisk: pf.slMult,
        });

        cumulative += tradePnl;
        if (cumulative > peak) peak = cumulative;
        const dd = peak - cumulative;
        if (dd > maxDrawdown) maxDrawdown = dd;
        equityCurve.push({
          index: tradeIdx,
          label: `#${tradeIdx + 1}`,
          value: Math.round(cumulative * 100) / 100,
        });
        tradeIdx++;
      }
    }
  }

  // ── Equity Simulation (for chart visualization) ──
  const avgRisk = countRiskRrr > 0 ? sumRisk / countRiskRrr : 0.01;
  const avgWin = countAvgWinLoss > 0 ? sumAvgWin / countAvgWinLoss : 0;
  const avgLoss = countAvgWinLoss > 0 ? sumAvgLoss / countAvgWinLoss : 0;
  const realizedRrr = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : (countRiskRrr > 0 ? sumRrr / countRiskRrr : 1);

  const sim = simulateEquity(tradeResults, avgRisk, realizedRrr);
  const equitySimulation: EquitySimPoint[] = sim.equityCurve.map((eq, i) => ({
    index: i,
    equity: Math.round(eq * 100) / 100,
    drawdownPct: Math.round((sim.drawdowns[i] ?? 0) * 100) / 100,
  }));

  // ── Use unified metrics as source of truth ──
  const annualReturn = countAnnualReturn > 0
    ? Math.round((sumAnnualReturn / countAnnualReturn) * 10) / 10
    : null;

  const maxDrawdownPct = countMaxDd > 0
    ? Math.round((sumMaxDdPct / countMaxDd) * 10) / 10
    : 0;

  // Profit factor: prefer from unified metrics, fallback to fold computation
  const profitFactor = grossLoss > 0
    ? Math.round((grossProfit / grossLoss) * 100) / 100
    : (foldGrossLoss > 0
        ? Math.round((foldGrossProfit / foldGrossLoss) * 100) / 100
        : 0);

  // Avg win/loss: fallback to fold computation if unified metrics missing
  let finalAvgWin = avgWin;
  let finalAvgLoss = avgLoss;
  if (countAvgWinLoss === 0) {
    const winTrades = trades.filter((t) => t.result === "win");
    const lossTrades = trades.filter((t) => t.result === "loss");
    if (winTrades.length) finalAvgWin = winTrades.reduce((s, t) => s + t.pnl, 0) / winTrades.length;
    if (lossTrades.length) finalAvgLoss = lossTrades.reduce((s, t) => s + t.pnl, 0) / lossTrades.length;
  }

  return {
    totalTrades,
    winRate:
      totalTrades > 0
        ? Math.round((totalWins / totalTrades) * 100 * 10) / 10
        : 0,
    netPnl: Math.round(totalNetPnl * 1000) / 1000,
    profitFactor,
    avgWin: Math.round(finalAvgWin * 1000) / 1000,
    avgLoss: Math.round(finalAvgLoss * 1000) / 1000,
    sharpeRatio:
      countSharpe > 0
        ? Math.round((sumSharpe / countSharpe) * 100) / 100
        : null,
    calmarRatio:
      countCalmar > 0
        ? Math.round((sumCalmar / countCalmar) * 100) / 100
        : null,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxDrawdownPct,
    annualReturn,
    equityCurve,
    equitySimulation,
    profitPerTrade: sim.profitPerTrade.map((p) => Math.round(p * 100) / 100),
    trades,
    assetBreakdown: assetBreakdown.sort((a, b) => b.pnl - a.pnl),
  };
}
