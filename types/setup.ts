// ──────────────────────────────────────────────
// Onboarding / first-run setup status
//
// Aggregated readiness of a fresh instance, shared by the /setup wizard,
// the dashboard checklist card and the redirect middleware.
// ──────────────────────────────────────────────

export interface SetupStatus {
  hasDataSource: boolean;
  hasBroker: boolean;
  hasLlm: boolean;
  /** Minimal viable instance: data to backtest + Claude for the agents. */
  isComplete: boolean;
}

export interface SetupStep {
  key: "data" | "broker" | "llm";
  label: string;
  description: string;
  done: boolean;
  to: string;
  /** Optional steps (broker) don't block `isComplete`. */
  required: boolean;
  icon: string;
}
