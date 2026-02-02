export interface Account {
  id: string;
  name: string;
  isActive: boolean;
  accType: "DEMO" | "LIVE" | "UNKNOWN";
  pairsCount: number;
}

export interface SlippageWarning {
  symbol: string;
  timestamp: string;
  expected_price: number;
  actual_price: number;
  slippage_pct: number;
  direction: string;
}

export interface AccountStatus {
  accountId: string;
  accountName: string;
  isAlive: boolean;
  lastHeartbeatAgo: number;
  status: string;
  active_pairs_count: number;
  active_epics: string[];
  account_mode: string;
  slippage_warnings: SlippageWarning[];
}

export interface Trade {
  timestamp: string;
  epic: string;
  signal: string;
  size: number;
  pnl: number;
  accountId?: string;
  accountName?: string;
}

export interface Performance {
  winRate: number;
  totalPnl: number;
  closedTrades: number;
  maxDrawdown: number;
}

export interface Position {
  dealId: string;
  epic: string;
  instrumentName: string;
  direction: string;
  size: number;
  openLevel: number;
  currentLevel: number;
  stopLevel: number | null;
  limitLevel: number | null;
  profitLoss: number;
  currency: string;
  createdDate: string;
  accountId?: string;
  accountName?: string;
}

export interface AccountData {
  balance: number;
  available: number;
  profitLoss: number;
  deposit: number;
}

export interface StatusSummary {
  total: number;
  online: number;
  offline: number;
}

export interface LogsData {
  logs: string[];
  fileSize?: number;
  totalLines?: number;
}

// Utility functions
export const formatEpic = (epic: string): string => {
  const match = epic.match(/CS\.D\.(\w{3})(\w{3})/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return epic;
};

export const formatNumber = (value: number, decimals: number = 2): string => {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatPnL = (value: number, currency: string): string => {
  const symbol =
    currency === "JPY"
      ? "¥"
      : currency === "GBP"
        ? "£"
        : currency === "CHF"
          ? "CHF"
          : currency === "USD"
            ? "$"
            : "€";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value)} ${symbol}`;
};
