/**
 * IG Markets API Client
 * Handles authentication and API calls to IG trading platform
 * Supports multiple accounts with individual configurations
 */

import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";

export interface IGAccountConfig {
  id: string;
  name: string;
  isActive: boolean;
  credentials: {
    api_key: string;
    username: string;
    password: string;
    acc_type: "DEMO" | "LIVE";
  };
  bot: {
    resolution: string;
    lookback: number;
    data_source: string;
    risk_size: number;
    log_file: string;
  };
  xgb_settings: {
    n_estimators: number;
    max_depth: number;
    learning_rate: number;
    n_jobs: number;
    random_state: number;
  };
  money_management: {
    max_risk_pct: number;
    kelly_multiplier: number;
  };
  strategy: {
    conf_thresh: number;
    adx_thresh: number;
    sl_atr_mult: number;
    tp_atr_mult: number;
  };
  pairs: Record<
    string,
    {
      epic: string;
      conf_thresh?: number;
      adx_thresh?: number;
      sl_atr_mult?: number;
      tp_atr_mult?: number;
      stability?: number;
    }
  >;
  _config_file?: string;
}

interface IGSession {
  cst: string;
  securityToken: string;
  expiresAt: number;
}

// Cache sessions per account ID
const sessionCache = new Map<string, IGSession>();

export class IGClient {
  private accountId: string;
  private apiKey: string;
  private username: string;
  private password: string;
  private apiUrl: string;

  constructor(account: IGAccountConfig) {
    this.accountId = account.id;
    this.apiKey = account.credentials.api_key;
    this.username = account.credentials.username;
    this.password = account.credentials.password;
    this.apiUrl =
      account.credentials.acc_type === "DEMO"
        ? "https://demo-api.ig.com/gateway/deal"
        : "https://api.ig.com/gateway/deal";
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const cached = sessionCache.get(this.accountId);

    if (cached && cached.expiresAt > Date.now()) {
      return {
        "X-IG-API-KEY": this.apiKey,
        CST: cached.cst,
        "X-SECURITY-TOKEN": cached.securityToken,
      };
    }

    const response = await fetch(`${this.apiUrl}/session`, {
      method: "POST",
      headers: {
        "X-IG-API-KEY": this.apiKey,
        "Content-Type": "application/json",
        VERSION: "2",
      },
      body: JSON.stringify({
        identifier: this.username,
        password: this.password,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`IG Login failed: ${error}`);
    }

    const cst = response.headers.get("CST");
    const securityToken = response.headers.get("X-SECURITY-TOKEN");

    if (!cst || !securityToken) {
      throw new Error("IG Login failed: Missing authentication tokens");
    }

    sessionCache.set(this.accountId, {
      cst,
      securityToken,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    return {
      "X-IG-API-KEY": this.apiKey,
      CST: cst,
      "X-SECURITY-TOKEN": securityToken,
    };
  }

  async getOpenPositions() {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${this.apiUrl}/positions`, {
      headers: {
        ...headers,
        VERSION: "2",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch positions: ${response.statusText}`);
    }

    const data = await response.json();
    return data.positions || [];
  }

  async getTransactionHistory(days: number = 30) {
    const headers = await this.getAuthHeaders();

    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const response = await fetch(
      `${this.apiUrl}/history/transactions?from=${fromDate.toISOString()}&to=${toDate.toISOString()}&type=ALL`,
      {
        headers: {
          ...headers,
          VERSION: "2",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch transaction history: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.transactions || [];
  }

  async getAccountInfo() {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${this.apiUrl}/accounts`, {
      headers: {
        ...headers,
        VERSION: "1",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch account info: ${response.statusText}`);
    }

    const data = await response.json();
    const cfdAccount = data.accounts?.find(
      (acc: any) => acc.accountType === "CFD"
    );
    return cfdAccount || null;
  }
}

/**
 * Get accounts directory path
 */
function getAccountsDir(): string {
  const config = useRuntimeConfig();
  const dataPath = config.dataPath || "/app/data";
  return join(dataPath, "accounts");
}

/**
 * Load all account configurations from accounts/*.json files
 */
export async function loadAccounts(): Promise<IGAccountConfig[]> {
  const accountsDir = getAccountsDir();
  const accounts: IGAccountConfig[] = [];

  try {
    const files = await readdir(accountsDir);

    for (const file of files) {
      // Skip non-JSON and example files
      if (!file.endsWith(".json") || file.includes(".example.")) {
        continue;
      }

      try {
        const filePath = join(accountsDir, file);
        const content = await readFile(filePath, "utf-8");
        const config = JSON.parse(content) as IGAccountConfig;
        config._config_file = filePath;
        accounts.push(config);
      } catch (e) {
        console.error(`Error loading ${file}:`, e);
      }
    }
  } catch {
    // accounts directory doesn't exist yet
  }

  return accounts;
}

/**
 * Load only active accounts
 */
export async function loadActiveAccounts(): Promise<IGAccountConfig[]> {
  const accounts = await loadAccounts();
  return accounts.filter((a) => a.isActive);
}

/**
 * Get a specific account by ID
 */
export async function getAccount(
  accountId: string
): Promise<IGAccountConfig | null> {
  const accounts = await loadAccounts();
  return accounts.find((a) => a.id === accountId) || null;
}

/**
 * Save account configuration
 */
export async function saveAccount(account: IGAccountConfig): Promise<void> {
  const accountsDir = getAccountsDir();
  const filePath = account._config_file || join(accountsDir, `${account.id}.json`);

  // Remove internal field before saving
  const { _config_file, ...accountData } = account;

  await writeFile(filePath, JSON.stringify(accountData, null, 2), "utf-8");
}

/**
 * Toggle account active state
 */
export async function toggleAccountActive(
  accountId: string,
  isActive: boolean
): Promise<IGAccountConfig | null> {
  const account = await getAccount(accountId);

  if (!account) {
    return null;
  }

  account.isActive = isActive;
  await saveAccount(account);
  return account;
}

/**
 * Create IG client for a specific account
 */
export async function createIGClient(accountId: string): Promise<IGClient> {
  const account = await getAccount(accountId);

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  return new IGClient(account);
}
