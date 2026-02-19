/**
 * TypeScript interfaces for account settings
 * Based on fwbg accounts/[accountName]/ structure
 */

// account_info.json structure
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

// assets.json structure
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

// Combined account settings
export interface AccountSettings {
  accountName: string;
  info: AccountInfo;
  assets: AssetsConfig;
}

// API response types
export interface AccountListResponse {
  accounts: string[];
}

export interface AccountInfoResponse extends AccountInfo {}

export interface AssetsResponse extends AssetsConfig {}
