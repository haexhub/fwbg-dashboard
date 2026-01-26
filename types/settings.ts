export interface AccountInfo {
  credentials: {
    api_key: string;
    username: string;
    password: string;
    env: "DEMO" | "LIVE";
  };
  money_management: {
    max_margin_usage: number;
    min_lot_size: number;
    emergency_stop_pct: number;
  };
  metadata: {
    account_name: string;
    currency: string;
    is_active: boolean;
  };
}

export interface EnsembleModel {
  tp_mult: number;
  sl_mult: number;
  conf_thresh: number;
  weight: number;
}

export interface AssetConfig {
  kelly_risk: number;
  point_value: number;
  spread: number;
  tp_mult: number;
  sl_mult: number;
  conf_thresh: number;
  features: string[];
  good_hours: number[];
  ensemble: EnsembleModel[];
  dd_scaling: Record<string, number>;
}

export type AssetsConfig = Record<string, AssetConfig>;

export interface MarketInfo {
  epic: string;
  instrumentName: string;
  instrumentType: string;
  expiry: string;
}

export const currencyOptions = [
  { label: "EUR", value: "EUR" },
  { label: "USD", value: "USD" },
  { label: "GBP", value: "GBP" },
  { label: "CHF", value: "CHF" },
  { label: "JPY", value: "JPY" },
];

export const envOptions = [
  { label: "DEMO", value: "DEMO" },
  { label: "LIVE", value: "LIVE" },
];

export const defaultAssetConfig: AssetConfig = {
  kelly_risk: 0.02,
  point_value: 1.0,
  spread: 1.0,
  tp_mult: 50,
  sl_mult: 50,
  conf_thresh: 0.55,
  features: [],
  good_hours: Array.from({ length: 24 }, (_, i) => i),
  ensemble: [],
  dd_scaling: { "10": 0.5, "20": 0.25 },
};

export const defaultAccountInfo: AccountInfo = {
  credentials: {
    api_key: "",
    username: "",
    password: "",
    env: "DEMO",
  },
  money_management: {
    max_margin_usage: 0.9,
    min_lot_size: 0.1,
    emergency_stop_pct: 0.15,
  },
  metadata: {
    account_name: "",
    currency: "EUR",
    is_active: false,
  },
};
