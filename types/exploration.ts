/** Types for the Exploration feature — Exit Optimization (MFE/MAE analysis). */

export interface ExitOptimizationSummary {
  symbol: string;
  timeframe: string;
  exit_strategy: string;
  analyzed_at: string;
  bars_analyzed: number;
  suggested_grid: SuggestedExitGrid;
}

export interface ExitOptimizationResult extends ExitOptimizationSummary {
  data_file: string;
  max_bars_forward: number;
  exit_params: Record<string, unknown>;
  mfe_mae: {
    long: DirectionPercentiles;
    short: DirectionPercentiles;
  };
  capture_matrix: CaptureEntry[];
}

export interface DirectionPercentiles {
  mfe_percentiles: Record<string, number>;
  mae_percentiles: Record<string, number>;
}

export interface CaptureEntry {
  tp: number;
  sl: number;
  rrr: number;
  win_rate_long: number;
  win_rate_short: number;
  edge_long: number;
  edge_short: number;
  resolved_trades: number;
}

export interface SuggestedExitGrid {
  tp: number[];
  sl: number[];
  reasoning: string;
}

export interface ExitOptimizationRequest {
  asset: string;
  exit_strategy?: string;
  exit_params?: Record<string, unknown>;
  max_bars?: number;
}
