// ──────────────────────────────────────────────
// fwbg-agents domain types (port 8421)
//
// Namespaced Agent*/agents end-to-end — separate domain from types/strategy.ts
// (StrategySummary/RunSummary are for the manual backtest bot on port 8420).
// ──────────────────────────────────────────────

export type AgentStrategyState =
  | "proposed"
  | "backtested"
  | "paper_trading"
  | "live_trading"
  | "abandoned";

export interface AgentStrategySummary {
  id: number;
  slug: string;
  current_state: AgentStrategyState;
  iteration_count: number;
  parent_strategy_id: number | null;
  asset_class: string;
  strategy_family: string;
  hypothesis_path: string | null;
  spec_path: string | null;
  post_mortem_path: string | null;
  tags: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface AgentStrategyTransition {
  id: number;
  entity_type: "strategy" | "plugin";
  entity_id: number;
  from_state: string | null;
  to_state: string;
  reason: string;
  payload: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface AgentStrategyDetail {
  strategy: AgentStrategySummary;
  transitions: AgentStrategyTransition[];
}

export interface PaperSummary {
  strategy_slug: string;
  sharpe_paper: number;
  max_dd_paper: number;
  trades_total: number;
  trades_today: number;
  days_in_paper: number;
  win_rate: number;
  last_trade_at: string | null;
  current_equity: number;
  starting_equity: number;
  equity_curve_sample: Record<string, unknown>[];
}

export interface PaperPosition {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  entry_price: number;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  unrealised_pnl_pct: number | null;
  opened_at: string;
}

export type AgentPluginState =
  | "specified"
  | "authored"
  | "verified"
  | "adopted_in_fwbg"
  | "abandoned";

export type AgentPluginKind =
  | "indicator"
  | "model"
  | "exit_strategy"
  | "risk_management"
  | "entry_modifier"
  | "preprocessing"
  | "feature_selection"
  | "data_loading";

export interface AgentPluginSummary {
  id: number;
  slug: string;
  current_state: AgentPluginState;
  kind: AgentPluginKind;
  spec_path: string | null;
  contract_path: string | null;
  post_mortem_path: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AgentPluginDetail {
  plugin: AgentPluginSummary;
  transitions: AgentStrategyTransition[];
}

export interface VerificationRun {
  id: number;
  plugin_id: number;
  status: string;
  scenarios_run: number;
  scenarios_passed: number;
  error_log_path: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string | null;
}

export type AgentRunStatus = "pending" | "running" | "done" | "failed";

export type AgentName =
  | "runner"
  | "analyst"
  | "paper_analyst"
  | "promote_live"
  | "research_flow";

export interface AgentRun {
  id: number;
  agent_name: AgentName;
  status: AgentRunStatus;
  strategy_id: number | null;
  plugin_id: number | null;
  input_artifact_path: string | null;
  output_artifact_path: string | null;
  error: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface ResearchBriefInput {
  asset_class: string;
  strategy_family_hint?: string;
  free_text_brief?: string;
}

export interface ResearchBriefResponse {
  agent_run_id: number;
  status: string;
  message: string;
}

export interface Hypothesis {
  id: number;
  slug: string;
  current_state: AgentStrategyState;
  asset_class: string;
  strategy_family: string;
  iteration_count: number;
  parent_strategy_id: number | null;
  hypothesis_path: string | null;
  spec_path: string | null;
  created_at: string | null;
}

export interface CriteriaSection {
  required_all?: unknown[];
  required_any?: unknown[];
  hard_blockers?: unknown[];
  [key: string]: unknown;
}

export interface CriteriaDoc {
  backtest_to_paper: CriteriaSection;
  paper_to_live: CriteriaSection;
  [key: string]: unknown;
}

export interface CriteriaListResponse {
  asset_classes: string[];
  baseline: Record<string, unknown> | null;
}

export interface CriteriaDetailResponse {
  asset_class: string;
  criteria: CriteriaDoc;
  yaml_text: string;
  path: string;
}

export interface CriteriaUpdateResponse {
  asset_class: string;
  path: string;
  ok: boolean;
}

export interface PromoteLiveInput {
  human_approval: true;
  operator_note: string;
}

// ──────────────────────────────────────────────
// Badge-color helpers (mirroring statusColor() in types/strategy.ts)
// ──────────────────────────────────────────────

type BadgeColor = "success" | "error" | "warning" | "info" | "neutral" | "primary";

export function agentStrategyStateColor(state: AgentStrategyState | string): BadgeColor {
  switch (state) {
    case "proposed":
      return "info";
    case "backtested":
      return "primary";
    case "paper_trading":
      return "warning";
    case "live_trading":
      return "error";
    case "abandoned":
      return "neutral";
    default:
      return "neutral";
  }
}

export function agentPluginStateColor(state: AgentPluginState | string): BadgeColor {
  switch (state) {
    case "specified":
      return "info";
    case "authored":
      return "primary";
    case "verified":
    case "adopted_in_fwbg":
      return "success";
    case "abandoned":
      return "neutral";
    default:
      return "neutral";
  }
}

export function agentRunStatusColor(status: AgentRunStatus | string): BadgeColor {
  switch (status) {
    case "done":
      return "success";
    case "failed":
      return "error";
    case "running":
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}
