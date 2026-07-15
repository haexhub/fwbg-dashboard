// ──────────────────────────────────────────────
// Unified Performance Data Model
// Used by both backtest runs and live trading dashboards
// ──────────────────────────────────────────────

export interface PerformanceData {
  totalTrades: number;
  winRate: number; // 0-100 percentage
  netPnl: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  sharpeRatio: number | null;
  calmarRatio: number | null;
  /** Deflated Sharpe Ratio (Bailey/López de Prado 2014), 0-1 probability.
   * Null when the global trial census is unavailable or too small to
   * estimate cross-trial variance from — never a fabricated value. */
  dsr: number | null;
  nTrials: number | null;
  maxDrawdown: number;
  maxDrawdownPct: number; // percentage of peak equity
  annualReturn: number | null; // percentage, e.g. 12.5 = 12.5%
  equityCurve: EquityPoint[];
  equitySimulation: EquitySimPoint[]; // compounded equity from $100
  profitPerTrade: number[]; // per-trade P&L in equity terms (compounded)
  trades: TradeRecord[];
  assetBreakdown: AssetPerformance[];
}

export interface EquitySimPoint {
  index: number;
  equity: number;
  drawdownPct: number; // 0-100 percentage of peak
}

export interface EquityPoint {
  index: number;
  label: string;
  value: number;
}

export interface TradeRecord {
  timestamp: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  pnl: number;
  result: "win" | "loss";
  initialRisk?: number; // SL multiplier from config
  size?: number;
  entryPrice?: number;
  exitPrice?: number;
  barsHeld?: number;
  exitReason?: string;
}

export interface AssetPerformance {
  symbol: string;
  status: string;
  trades: number;
  winRate: number;
  pnl: number;
  sharpeRatio: number | null;
  calmarRatio: number | null;
  profitFactor: number | null;
}
