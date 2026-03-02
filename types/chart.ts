// ── Data Sources ──

export interface ChartSource {
  name: string;
  type: "csv" | "broker";
  description: string;
  symbols: ChartSymbol[];
  broker_type?: string;
  account_id?: string;
}

export interface ChartSymbol {
  symbol: string;
  timeframes: string[];
  asset_class?: string;
  point?: number;
  spread?: number;
}

// ── Timeframe display labels ──

export const TIMEFRAME_LABELS: Record<string, string> = {
  MINUTE_1: "1m",
  MINUTE_5: "5m",
  MINUTE_15: "15m",
  MINUTE_30: "30m",
  HOUR: "1H",
  HOUR_4: "4H",
  DAY: "1D",
};

// ── OHLCV API response ──

export interface OhlcvResponse {
  symbol: string;
  timeframe: string;
  total: number;
  count: number;
  data: OhlcvBar[];
}

export interface OhlcvBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// ── Indicator API response ──

export interface RangeZone {
  start_ts: number;
  end_ts: number;
  high: number;
  low: number;
  session: string;
}

export interface IndicatorResponse {
  fqn: string;
  columns: string[];
  plot_columns: string[];
  signal_columns: string[];
  timestamps: number[];
  data: Record<string, (number | null)[]>;
  range_zones?: RangeZone[];
}

// ── Active indicator on chart ──

export interface ActiveIndicator {
  id: string;
  fqn: string;
  name: string;
  params: Record<string, unknown>;
  columns: string[];
  paneId: string;
  isSignal?: boolean;
  signalTimestamps?: number[];
  /** Maps signal timestamp → value at that transition (e.g. -1, 0, 1) */
  signalValueMap?: Map<number, number>;
}
