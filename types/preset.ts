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

export interface StrategyRefs {
  pipeline?: string;
  exit_params?: string;
  model?: string;
  validation?: string;
  filters?: string;
  resources?: string;
  risk_params?: string;
}
