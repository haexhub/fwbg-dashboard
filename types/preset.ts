export interface PresetMeta {
  name: string;
  description?: string;
  version: number;
}

export interface PresetItem {
  id: string;                    // filename without .json (used for API calls and _refs)
  meta: PresetMeta;
  content: Record<string, unknown>;
}

export interface GridPresetRef {
  name: string;
  /** Cached preset base content for override computation at save time */
  base?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
}

export interface StrategyRefs {
  pipeline?: string;
  exit_params?: string;
  model?: string;
  validation?: string;
  filters?: string;
  resources?: string;
  risk_params?: string;
  grids?: Record<string, GridPresetRef | null>;
  grids_regime_filter?: string | null;
}
