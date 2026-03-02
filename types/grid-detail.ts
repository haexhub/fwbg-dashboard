// ──────────────────────────────────────────────
// Grid Detail — Backtest-specific data from fwbg backend
// ──────────────────────────────────────────────

export interface GridDetail {
  symbol: string;
  status: string;
  total_combinations: number;
  selected_config?: Record<string, unknown>;
  best_config?: Record<string, unknown>; // used for not_significant assets
  walk_forward?: WalkForwardResult;
  monte_carlo?: MonteCarloResult;

  // Unified metrics (top-level, merged from unified_metrics.json)
  pnl?: number;
  win_rate?: number;
  rrr?: number;
  sharpe?: number;
  calmar?: number;
  trades?: number;
  annual_return?: number;
  test_period_years?: number;
  max_drawdown?: number;
  final_equity?: number;
  risk_per_trade?: number;
  profit_factor?: number;
  avg_win?: number;
  avg_loss?: number;
  n_wins?: number;
  n_losses?: number;
  n_long?: number;
  n_short?: number;
}

export interface WalkForwardResult {
  n_folds: number;
  successful_folds: number;
  mean_win_rate: number;
  mean_pnl: number;
  total_trades: number;
  fold_details: FoldDetail[];
}

/** Dict format (newer runs): { result: 1|-1, pnl_raw: number } */
export interface TradeTraceDict {
  result: number;
  pnl_raw: number;
}

/** Trace entries can be plain numbers (1/-1, older runs) or dicts (newer runs) */
export type TradeTraceEntry = number | TradeTraceDict;

/** Normalized trace used internally after parsing both formats */
export interface NormalizedTrace {
  result: 1 | -1;
  pnl: number; // actual P&L if available, 0 otherwise
  hasPnl: boolean; // true if pnl_raw was available
}

export interface FoldDetail {
  fold_id: number;
  test_pnl: number;
  test_win_rate: number;
  test_trades: number;
  test_size?: number; // number of bars in test period
  test_trades_trace: TradeTraceEntry[];
  best_config?: Record<string, unknown>;
  test_start?: string;
  test_end?: string;
}

export interface MonteCarloResult {
  p_value: number;
  is_significant: string;
  percentile: number;
  equity_median: number;
  equity_p5: number;
  equity_p95: number;
  bankruptcy_rate: number;
}
