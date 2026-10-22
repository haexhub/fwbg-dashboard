// ──────────────────────────────────────────────
// fwbg research register types (port 8420, /api/research and run starts)
//
// Mirror fwbg's JSON: the card summary of GET /api/research, the card of
// POST /api/research and the research gate's denials.
// ──────────────────────────────────────────────

export type ResearchStatus = "active" | "parked" | "rejected" | "candidate";

/** The card's best ranked result: fwbg ranks only a numeric sharpe, other metrics may be null. */
export interface ResearchBest {
  trial: string;
  symbol: string;
  metrics: { sharpe: number } & Record<string, number | null>;
}

export interface ResearchCardSummary {
  id: string;
  title: string;
  status: ResearchStatus;
  tags: string[];
  created: string;
  holdout_cutoff: string;
  trials: number;
  best: ResearchBest | null;
  holdout_used: boolean;
  /** Live runs of the card; null when fwbg cannot read its pending runs. */
  running: number | null;
}

/** A card whose file fwbg could not load; listed with the reason. */
export interface UnreadableResearchCard {
  id: string;
  error: string;
}

export interface ResearchCardList {
  cards: (ResearchCardSummary | UnreadableResearchCard)[];
  pending_error: string | null;
}

export interface CriteriaAmendment {
  date: string;
  reason: string;
  criteria_hash: string;
}

export interface ResearchCard {
  id: string;
  title: string;
  status: ResearchStatus;
  tags: string[];
  created: string;
  holdout_cutoff: string;
  holdout_contaminated: boolean;
  success_criteria: Record<string, number>;
  registered_criteria_hash: string;
  criteria_amendments: CriteriaAmendment[];
  body: string;
}

export interface NewResearchCardInput {
  title: string;
  tags: string[];
  hypothesis: string;
  mechanism: string;
  /** ISO date (YYYY-MM-DD); fwbg picks the holdout cutoff when absent. */
  cutoff?: string;
}

/** A `warning` means the card was written but not committed: it exists, never retry. */
export interface NewResearchCardResponse {
  card: ResearchCard;
  warning?: string;
}

export interface GateDenial {
  code: string;
  status: number;
  message: string;
}

export interface RunStartBody {
  strategy_name: string;
  assets?: string[];
  asset_classes?: string[];
  description?: string;
  research_id: string;
  /** Single line, non-blank: what this run tries. */
  note: string;
  /** Only for a deliberate repeat (a duplicate config or a second holdout look). */
  reason?: string;
  /** Develop up to the card's cutoff and evaluate once after it. */
  holdout?: boolean;
}
