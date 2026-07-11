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

/**
 * One entry in the Researcher's asset recommendation. `scope="asset_class"`
 * covers the whole class; `scope="symbol"` pins to one instrument.
 * (Mirrors fwbg-agents' SuggestedUniverse pydantic model.)
 */
export interface SuggestedUniverseEntry {
  scope: "symbol" | "asset_class";
  value: string;
  timeframe: string | null;
  rationale: string;
}

export interface AgentStrategySummary {
  id: number;
  slug: string;
  current_state: AgentStrategyState;
  iteration_count: number;
  parent_strategy_id: number | null;
  // Null = asset-agnostic (strategy-first research finds edges without pinning
  // to a class up front). Rendered as "agnostic" in the UI.
  asset_class: string | null;
  strategy_family: string;
  hypothesis_path: string | null;
  spec_path: string | null;
  post_mortem_path: string | null;
  suggested_universe: SuggestedUniverseEntry[] | null;
  model_knowledge_only: boolean;
  // fwbg filename once the strategy was published into fwbg (research flow
  // or runner) — links to /strategy/<name>. Null until first publish.
  fwbg_strategy_name: string | null;
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

export type AgentRunStatus = "pending" | "running" | "done" | "failed" | "cancelled";

export type AgentName =
  | "runner"
  | "analyst"
  | "paper_analyst"
  | "promote_live"
  | "research_flow"
  | "researcher"
  | "reiterate";

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

/**
 * One entry on a run's timeline (`GET /agents/runs/:id/events`, live SSE).
 * `type` is the event kind (agent_run_started, research_search, llm_tool_call,
 * backtest_submitted, …); the remaining keys are the event-specific payload,
 * so the interface stays open. `seq` de-dupes backfill against live events.
 */
export interface AgentRunEvent {
  seq: number;
  ts: string;
  type: string;
  agent_run_id?: number;
  [key: string]: unknown;
}

/** One LLM round-trip's token/latency telemetry (from `llm_call` rows). */
export interface LlmCallSummary {
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number | null;
  created_at: string | null;
}

export interface TranscriptRound {
  round: number;
  size: number;
}

export interface ArtifactInfo {
  kind: "input" | "output";
  path: string | null;
  exists: boolean;
  size: number | null;
}

/** Enriched detail (`GET /agents/runs/:id`) — additive over the flat AgentRun row. */
export interface AgentRunDetail extends AgentRun {
  llm_calls: LlmCallSummary[];
  total_input_tokens: number;
  total_output_tokens: number;
  transcripts: TranscriptRound[];
  artifacts: ArtifactInfo[];
}

/** Text content of a run artifact (`GET /agents/runs/:id/artifact`). */
export interface ArtifactContent {
  kind: string;
  path: string;
  suffix: string;
  size: number;
  truncated: boolean;
  content: string;
}

export interface ResearchBriefInput {
  // Optional: omitted = asset-agnostic research (the strategy-first default).
  // When set, must be a value from fwbg's asset registry (/api/assets/classes),
  // which the backend re-validates at intake.
  asset_class?: string;
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
  asset_class: string | null;
  strategy_family: string;
  iteration_count: number;
  parent_strategy_id: number | null;
  hypothesis_path: string | null;
  spec_path: string | null;
  suggested_universe: SuggestedUniverseEntry[] | null;
  model_knowledge_only: boolean;
  created_at: string | null;
}

/** fwbg asset registry — controlled vocabulary + known symbols per class. */
export interface AssetClassesResponse {
  classes: string[];
  by_class: Record<string, string[]>;
}

/** A first-class citation backing a hypothesis (fwbg-agents' Source model). */
export interface HypothesisSource {
  url: string;
  title: string;
  why_relevant: string;
  key_points: string[];
}

/** The researcher hypothesis JSON stored on disk (read back for the detail view). */
export interface HypothesisContent {
  title: string;
  asset_class: string | null;
  strategy_family: string;
  hypothesis: string;
  expected_edge_explanation: string;
  key_indicators: string[];
  tags: string[];
  sources: HypothesisSource[];
  suggested_universe: SuggestedUniverseEntry[];
  model_knowledge_only: boolean;
  differentiates_from: string[];
}

export interface HypothesisContentResponse {
  strategy_id: number;
  slug: string;
  hypothesis: HypothesisContent;
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
    case "cancelled":
      return "neutral";
    case "running":
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}

/** Human-readable labels for every agent_name the backend emits. */
export const AGENT_LABELS: Record<string, string> = {
  research_flow: "Research",
  researcher: "Researcher",
  runner: "Runner",
  analyst: "Analyst",
  paper_analyst: "Paper-Analyst",
  promote_live: "Promote Live",
  reiterate: "Reiterate",
  translator: "Translator",
  plugin_planner: "Plugin-Planner",
  plugin_implementer: "Plugin-Implementer",
  plugin_author_flow: "Plugin-Autor",
  plugin_evaluator_flow: "Plugin-Evaluator",
  translator_reiterate_flow: "Reiterate (Plugin)",
};

export function agentLabel(name: string): string {
  return AGENT_LABELS[name] ?? name;
}

// ──────────────────────────────────────────────
// Per-agent configuration (model + persona/system-prompt)
//
// Mirrors fwbg-agents' /agents/config. The configurable set is the LLM-driven
// roles only (not the deterministic Runner/Calibrator) — see that backend.
// ──────────────────────────────────────────────

export interface AgentConfig {
  name: string;
  model: string;
  default_model: string;
  has_model_override: boolean;
  prompt: string;
  default_prompt: string;
  has_prompt_override: boolean;
}

export interface AgentConfigListResponse {
  agents: AgentConfig[];
  available_models: string[];
}

export interface AgentConfigUpdate {
  model?: string | null;
  prompt?: string | null;
}

export const CONFIGURABLE_AGENT_LABELS: Record<string, string> = {
  researcher: "Researcher",
  translator: "Translator",
  analyst: "Analyst",
  paper_analyst: "Paper-Analyst",
  plugin_planner: "Plugin-Planner",
  plugin_implementer: "Plugin-Implementer",
};
