// ──────────────────────────────────────────────
// Parameter Schema (from fwbg_sdk)
// ──────────────────────────────────────────────

export type ParamType =
  | "int"
  | "float"
  | "bool"
  | "string"
  | "list[int]"
  | "list[float]"
  | "list[string]"
  | "choice";

export interface ParamSchema {
  type: ParamType;
  default: unknown;
  description: string;
  min?: number;
  max?: number;
  step?: number;
  choices?: string[];
  required?: boolean;
}

// ──────────────────────────────────────────────
// Pipeline Phases
// ──────────────────────────────────────────────

export type PipelinePhase =
  | "data_loading"
  | "preprocessing"
  | "indicators"
  | "feature_selection"
  | "exit_strategies"
  | "risk_management"
  | "model"
  | "labeling";

/** Phases shown as kanban lanes in the pipeline editor */
export const PIPELINE_PHASES: PipelinePhase[] = [
  "data_loading",
  "preprocessing",
  "indicators",
  "feature_selection",
  "exit_strategies",
  "risk_management",
];

export const PHASE_LABELS: Record<PipelinePhase, string> = {
  data_loading: "Data Loading",
  preprocessing: "Preprocessing",
  indicators: "Indicators",
  feature_selection: "Feature Selection",
  exit_strategies: "Exit Strategies",
  risk_management: "Risk Management",
  model: "Model",
  labeling: "Labeling",
};

export const PHASE_ICONS: Record<PipelinePhase, string> = {
  data_loading: "i-heroicons-circle-stack",
  preprocessing: "i-heroicons-funnel",
  indicators: "i-heroicons-chart-bar",
  feature_selection: "i-heroicons-adjustments-horizontal",
  exit_strategies: "i-heroicons-arrow-right-on-rectangle",
  risk_management: "i-heroicons-shield-check",
  model: "i-heroicons-cpu-chip",
  labeling: "i-heroicons-tag",
};

export const PHASE_COLORS: Record<PipelinePhase, string> = {
  data_loading: "info",
  preprocessing: "warning",
  indicators: "success",
  feature_selection: "primary",
  exit_strategies: "error",
  risk_management: "neutral",
  model: "primary",
  labeling: "warning",
};

// ──────────────────────────────────────────────
// Plugin Info (from fwbg API)
// ──────────────────────────────────────────────

export interface PluginInfo {
  fqn: string;
  name: string;
  namespace: string;
  phase: PipelinePhase;
  version: string;
  description: string;
  stateful: boolean;
  cacheable: boolean;
  param_schema: Record<string, ParamSchema>;
  defaults: Record<string, unknown>;
  feature_columns?: string[];
  signal_columns?: string[];
  plot_columns?: string[];
}

// ──────────────────────────────────────────────
// Configured Plugin Instance (in pipeline)
// ──────────────────────────────────────────────

export interface PluginInstance {
  id: string;
  fqn: string;
  name: string;
  phase: PipelinePhase;
  params: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// Strategy Config (matches fwbg JSON format)
// ──────────────────────────────────────────────

export interface PipelineEntry {
  name: string;
  params: Record<string, unknown>;
  source?: string;
}

export interface StrategyConfig {
  _refs?: import("~/types/preset").StrategyRefs;
  name: string;
  description?: string;
  tags?: string[];
  hypothesis?: string;
  expected_outcome?: string;
  datasource?: string;
  pipeline: {
    indicators?: PipelineEntry[];
    preprocessing?: PipelineEntry[];
    feature_selection?: PipelineEntry[];
    data_loading?: PipelineEntry[];
  };
  exit_strategy: string;
  exit_params: Record<string, unknown>;
  risk_management?: string;
  risk_params?: Record<string, unknown>;
  model: {
    type: string;
    architecture: string;
    trade_directions: string[];
    hyperparameters: Record<string, unknown>;
  };
  grids: Record<
    string,
    {
      tp: number[];
      sl: number[];
      ct: number[];
      timeout_bars?: (number | null)[];
      long_ct?: number[];
      short_ct?: number[];
      regime_filter_grid?: unknown;
    }
  >;
  assets?: {
    filter?: string[];
    exclude?: string[];
  };
  validation: Record<string, unknown>;
  filters: Record<string, unknown>;
  resources: Record<string, unknown>;
}

export interface StrategySummary {
  filename: string;
  name: string;
  description: string;
  tags: string[];
}

// ──────────────────────────────────────────────
// Run / Job Types
// ──────────────────────────────────────────────

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface RunSummary {
  run_id: string;
  status: JobStatus;
  strategy_name?: string;
  description?: string;
  timestamp?: string;
  started_at?: string;
  timeframe?: string;
  tags?: string[];
  asset_count?: number;
  profitable_count?: number;
  is_active?: boolean;
}

export interface WalkForwardSummary {
  n_folds?: number;
  successful_folds?: number;
  mean_win_rate?: number;
  mean_pnl?: number;
  total_trades?: number;
}

export interface AssetResult {
  symbol: string;
  status: string;
  total_combinations: number;
  walk_forward: WalkForwardSummary;
}

export interface RunDetail {
  run_id: string;
  status: string;
  config?: Record<string, unknown>;
  strategy?: StrategyConfig;
  assets?: Record<string, AssetResult>;
}

// ──────────────────────────────────────────────
// Plugin Test Result
// ──────────────────────────────────────────────

export interface PluginTestResult {
  fqn: string;
  has_tests: boolean;
  status: "passed" | "failed" | "no_tests";
  returncode?: number;
  stdout?: string;
  stderr?: string;
  message?: string;
}

// ──────────────────────────────────────────────
// Utility functions
// ──────────────────────────────────────────────

export function phaseLabel(phase: PipelinePhase): string {
  return PHASE_LABELS[phase] ?? phase;
}

export function statusColor(
  status: JobStatus | string
): "success" | "error" | "warning" | "info" | "neutral" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "running":
    case "pending":
      return "warning";
    case "cancelled":
      return "neutral";
    default:
      return "info";
  }
}

export function formatWinRate(rate?: number): string {
  if (rate == null) return "-";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatPnl(pnl?: number): string {
  if (pnl == null) return "-";
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(1)}`;
}
