import type {
  PerformanceData,
  EquityPoint,
  EquitySimPoint,
  TradeRecord,
  AssetPerformance,
} from "~/types/performance";
import type { Trade } from "~/types/dashboard";

interface LivePerformanceResponse {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  profitFactor: number;
  maxDrawdown: number;
  equityCurve: number[];
}

/**
 * Wraps the existing /api/performance + /api/trades endpoints
 * into the unified PerformanceData interface.
 */
export function useLivePerformance(accountId: Ref<string>) {
  const query = computed(() =>
    accountId.value && accountId.value !== "all"
      ? { accountId: accountId.value }
      : {},
  );

  const { data: perfData, refresh: refreshPerf } =
    useFetch<LivePerformanceResponse>("/api/performance", {
      query,
      watch: [accountId],
    });

  const { data: tradesData, refresh: refreshTrades } = useFetch<{
    trades: Trade[];
  }>("/api/trades", {
    query: computed(() => ({
      limit: 100,
      ...query.value,
    })),
    watch: [accountId],
  });

  const performance = computed<PerformanceData | null>(() => {
    if (!perfData.value) return null;

    const perf = perfData.value;
    const rawTrades = tradesData.value?.trades ?? [];

    // Map trades to unified TradeRecord
    const trades: TradeRecord[] = rawTrades
      .filter((t) => t.pnl !== 0)
      .map((t) => ({
        timestamp: t.timestamp,
        symbol: t.epic,
        direction: t.signal === "BUY" ? ("LONG" as const) : ("SHORT" as const),
        pnl: t.pnl,
        result: t.pnl > 0 ? ("win" as const) : ("loss" as const),
        size: t.size,
      }));

    // Build equity curve from API response
    const equityCurve: EquityPoint[] = perf.equityCurve.map((v, i) => ({
      index: i,
      label: `#${i + 1}`,
      value: v,
    }));

    // Group trades by symbol for asset breakdown
    const bySymbol = new Map<string, Trade[]>();
    for (const t of rawTrades.filter((t) => t.pnl !== 0)) {
      const existing = bySymbol.get(t.epic) ?? [];
      existing.push(t);
      bySymbol.set(t.epic, existing);
    }

    const assetBreakdown: AssetPerformance[] = [];
    for (const [symbol, symbolTrades] of bySymbol) {
      const wins = symbolTrades.filter((t) => t.pnl > 0);
      const losses = symbolTrades.filter((t) => t.pnl < 0);
      const pnl = symbolTrades.reduce((s, t) => s + t.pnl, 0);
      const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
      const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

      assetBreakdown.push({
        symbol,
        status: pnl >= 0 ? "ok" : "loss",
        trades: symbolTrades.length,
        winRate:
          symbolTrades.length > 0
            ? Math.round((wins.length / symbolTrades.length) * 100 * 10) / 10
            : 0,
        pnl: Math.round(pnl * 100) / 100,
        sharpeRatio: null,
        calmarRatio: null,
        profitFactor:
          grossLoss > 0
            ? Math.round((grossProfit / grossLoss) * 100) / 100
            : null,
      });
    }
    assetBreakdown.sort((a, b) => b.pnl - a.pnl);

    // Compute avg win / avg loss
    const winTrades = rawTrades.filter((t) => t.pnl > 0);
    const lossTrades = rawTrades.filter((t) => t.pnl < 0);
    const avgWin =
      winTrades.length > 0
        ? winTrades.reduce((s, t) => s + t.pnl, 0) / winTrades.length
        : 0;
    const avgLoss =
      lossTrades.length > 0
        ? lossTrades.reduce((s, t) => s + t.pnl, 0) / lossTrades.length
        : 0;

    // Build equity simulation + drawdown from cumulative trade P&L
    const equitySimulation: EquitySimPoint[] = [];
    const profitPerTrade: number[] = [];
    let cumPnl = 0;
    let peak = 0;
    let maxDdPct = 0;

    // Starting point
    equitySimulation.push({ index: 0, equity: 0, drawdownPct: 0 });

    for (let i = 0; i < trades.length; i++) {
      cumPnl += trades[i]!.pnl;
      profitPerTrade.push(Math.round(trades[i]!.pnl * 100) / 100);
      if (cumPnl > peak) peak = cumPnl;
      const dd = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
      if (dd > maxDdPct) maxDdPct = dd;
      equitySimulation.push({
        index: i + 1,
        equity: Math.round(cumPnl * 100) / 100,
        drawdownPct: Math.round(dd * 100) / 100,
      });
    }

    return {
      totalTrades: perf.closedTrades,
      winRate: perf.winRate,
      netPnl: perf.totalPnl,
      profitFactor: perf.profitFactor,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      sharpeRatio: null,
      calmarRatio: null,
      dsr: null,
      nTrials: null,
      maxDrawdown: perf.maxDrawdown,
      maxDrawdownPct: Math.round(maxDdPct * 10) / 10,
      annualReturn: null,
      equityCurve,
      equitySimulation,
      profitPerTrade,
      trades,
      assetBreakdown,
    };
  });

  function refresh() {
    refreshPerf();
    refreshTrades();
  }

  return { performance, refresh };
}
