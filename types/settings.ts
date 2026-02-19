// ── Broker Definitions ──

export interface BrokerCredentialField {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder?: string;
  required?: boolean;
}

export interface BrokerDefinition {
  type: string;
  label: string;
  credentialFields: BrokerCredentialField[];
  envOptions?: { label: string; value: string }[];
}

export const BROKER_DEFINITIONS: BrokerDefinition[] = [
  {
    type: "ig",
    label: "IG Markets",
    credentialFields: [
      { key: "api_key", label: "API Key", type: "text", placeholder: "API Key", required: true },
      { key: "username", label: "Username", type: "text", placeholder: "Username", required: true },
      { key: "password", label: "Password", type: "password", placeholder: "Password", required: true },
    ],
    envOptions: [
      { label: "Demo", value: "DEMO" },
      { label: "Live", value: "LIVE" },
    ],
  },
];

// ── Account Info (account_info.json) ──

export interface MoneyManagement {
  max_margin_usage: number;
  min_lot_size: number;
  emergency_stop_pct: number;
}

export interface AccountMetadata {
  account_name: string;
  currency: string;
  env: string;
  is_active: boolean;
}

export interface AccountInfo {
  broker_type: string;
  credentials: Record<string, string>;
  money_management: MoneyManagement;
  metadata: AccountMetadata;
}

// ── Assets ──

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

// ── Options ──

export const currencyOptions = [
  { label: "EUR", value: "EUR" },
  { label: "USD", value: "USD" },
  { label: "GBP", value: "GBP" },
  { label: "CHF", value: "CHF" },
  { label: "JPY", value: "JPY" },
];

// ── Defaults ──

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

export const defaultMoneyManagement: MoneyManagement = {
  max_margin_usage: 0.9,
  min_lot_size: 0.1,
  emergency_stop_pct: 0.15,
};

export const defaultAccountInfo: AccountInfo = {
  broker_type: "ig",
  credentials: {},
  money_management: { ...defaultMoneyManagement },
  metadata: {
    account_name: "",
    currency: "EUR",
    env: "DEMO",
    is_active: false,
  },
};
