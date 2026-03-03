// ──────────────────────────────────────────────
// Run Progress (from GET /api/runs/{id}/progress)
// ──────────────────────────────────────────────

export type RunProgressStatus =
  | "initializing"
  | "running"
  | "completed"
  | "failed";

export type AssetStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type StageName =
  | "data_loading"
  | "indicators"
  | "grid_search"
  | "model_training"
  | "evaluation";

export interface StageProgress {
  stage_name: StageName;
  status: string;
  description: string;
  progress_fraction: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number;
  details: {
    grid_pos?: number;
    grid_total?: number;
    fold?: number;
    total_folds?: number;
  };
}

export interface AssetProgress {
  symbol: string;
  status: AssetStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number;
  result_summary: string;
  stages?: StageProgress[];
}

export interface RunProgress {
  run_id: string;
  status: RunProgressStatus;
  started_at: string;
  updated_at: string | null;
  elapsed_seconds: number;
  estimated_remaining_seconds: number | null;
  overall_progress_fraction: number;
  total_assets: number;
  completed_assets: number;
  failed_assets: number;
  active_assets: number;
  pending_assets: number;
  strategy_name: string;
  error_message: string | null;
  assets: Record<string, AssetProgress>;
}

// ──────────────────────────────────────────────
// Run Logs (from GET /api/runs/{id}/logs)
// ──────────────────────────────────────────────

export type LogLevel = "info" | "debug" | "warning" | "error";

export interface RunLogEntry {
  timestamp: string;
  level: LogLevel;
  symbol: string;
  stage: string;
  message: string;
  data?: Record<string, unknown>;
}
