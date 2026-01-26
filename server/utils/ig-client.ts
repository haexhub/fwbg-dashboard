/**
 * IG Markets API Client
 * Handles authentication and API calls to IG trading platform
 * Supports multiple accounts with individual configurations
 *
 * Account structure: ACCOUNTS_PATH/[accountName]/account_info.json
 */

import { readFile, writeFile, readdir, stat } from "fs/promises";
import { join } from "path";
import type { AccountInfo, AssetsConfig } from "./settings-types";
import { getAccountsPath } from "./accounts-path";

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
  pairs: Record<string, { epic: string }>;
  _folder_path?: string;
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

  /**
   * Invalidate cached session (call when API returns 401/403)
   */
  public invalidateSession(): void {
    sessionCache.delete(this.accountId);
  }

  private async getAuthHeaders(forceRefresh = false): Promise<Record<string, string>> {
    const cached = sessionCache.get(this.accountId);

    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return {
        "X-IG-API-KEY": this.apiKey,
        CST: cached.cst,
        "X-SECURITY-TOKEN": cached.securityToken,
      };
    }

    // Clear old session before requesting new one
    sessionCache.delete(this.accountId);

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
    let headers = await this.getAuthHeaders();

    let response = await fetch(`${this.apiUrl}/positions`, {
      headers: {
        ...headers,
        VERSION: "2",
      },
    });

    // Retry with fresh session on auth failure
    if (response.status === 401 || response.status === 403) {
      this.invalidateSession();
      headers = await this.getAuthHeaders(true);
      response = await fetch(`${this.apiUrl}/positions`, {
        headers: {
          ...headers,
          VERSION: "2",
        },
      });
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch positions: ${response.statusText}`);
    }

    const data = await response.json();
    return data.positions || [];
  }

  async getTransactionHistory(days: number = 30) {
    let headers = await this.getAuthHeaders();

    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const url = `${this.apiUrl}/history/transactions?from=${fromDate.toISOString()}&to=${toDate.toISOString()}&type=ALL`;

    let response = await fetch(url, {
      headers: {
        ...headers,
        VERSION: "2",
      },
    });

    // Retry with fresh session on auth failure
    if (response.status === 401 || response.status === 403) {
      this.invalidateSession();
      headers = await this.getAuthHeaders(true);
      response = await fetch(url, {
        headers: {
          ...headers,
          VERSION: "2",
        },
      });
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch transaction history: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.transactions || [];
  }

  async getAccountInfo() {
    let headers = await this.getAuthHeaders();

    let response = await fetch(`${this.apiUrl}/accounts`, {
      headers: {
        ...headers,
        VERSION: "1",
      },
    });

    // Retry with fresh session on auth failure
    if (response.status === 401 || response.status === 403) {
      this.invalidateSession();
      headers = await this.getAuthHeaders(true);
      response = await fetch(`${this.apiUrl}/accounts`, {
        headers: {
          ...headers,
          VERSION: "1",
        },
      });
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch account info: ${response.statusText}`);
    }

    const data = await response.json();
    const cfdAccount = data.accounts?.find(
      (acc: any) => acc.accountType === "CFD"
    );
    return cfdAccount || null;
  }

  /**
   * Close a single position by deal ID
   */
  async closePosition(dealId: string, direction: string, size: number) {
    const headers = await this.getAuthHeaders();

    // For closing, direction needs to be opposite
    const closeDirection = direction === "BUY" ? "SELL" : "BUY";

    const response = await fetch(`${this.apiUrl}/positions/otc`, {
      method: "DELETE",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        VERSION: "1",
        _method: "DELETE",
      },
      body: JSON.stringify({
        dealId,
        direction: closeDirection,
        size: String(size),
        orderType: "MARKET",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to close position ${dealId}: ${error}`);
    }

    return await response.json();
  }

  /**
   * Close all open positions (emergency stop)
   */
  async closeAllPositions(): Promise<{ closed: number; errors: string[] }> {
    const positions = await this.getOpenPositions();
    const errors: string[] = [];
    let closed = 0;

    for (const pos of positions) {
      try {
        await this.closePosition(
          pos.position.dealId,
          pos.position.direction,
          pos.position.size
        );
        closed++;
      } catch (error) {
        errors.push(
          `${pos.market.instrumentName}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return { closed, errors };
  }

  /**
   * Get market navigation tree (for browsing available markets)
   * @param nodeId - Optional node ID to get children of (root if not provided)
   */
  async getMarketNavigation(nodeId?: string): Promise<{
    nodes: Array<{ id: string; name: string }>;
    markets: Array<{ epic: string; instrumentName: string; expiry: string; instrumentType: string }>;
  }> {
    const headers = await this.getAuthHeaders();

    const url = nodeId
      ? `${this.apiUrl}/marketnavigation/${nodeId}`
      : `${this.apiUrl}/marketnavigation`;

    const response = await fetch(url, {
      headers: {
        ...headers,
        VERSION: "1",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch market navigation: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      nodes: data.nodes || [],
      markets: data.markets || [],
    };
  }

  /**
   * Search for markets by term
   * @param searchTerm - Search term (e.g., "EUR", "GOLD", "DAX")
   */
  async searchMarkets(searchTerm: string): Promise<Array<{
    epic: string;
    instrumentName: string;
    instrumentType: string;
    expiry: string;
    high: number;
    low: number;
    percentageChange: number;
    netChange: number;
    bid: number;
    offer: number;
    scalingFactor: number;
  }>> {
    let headers = await this.getAuthHeaders();

    const url = `${this.apiUrl}/markets?searchTerm=${encodeURIComponent(searchTerm)}`;

    let response = await fetch(url, {
      headers: {
        ...headers,
        VERSION: "1",
      },
    });

    // Retry with fresh session on auth failure
    if (response.status === 401 || response.status === 403) {
      this.invalidateSession();
      headers = await this.getAuthHeaders(true);
      response = await fetch(url, {
        headers: {
          ...headers,
          VERSION: "1",
        },
      });
    }

    if (!response.ok) {
      throw new Error(`Failed to search markets: ${response.statusText}`);
    }

    const data = await response.json();
    return data.markets || [];
  }

  /**
   * Get watchlists (user's saved market lists)
   */
  async getWatchlists(): Promise<Array<{
    id: string;
    name: string;
    editable: boolean;
    deleteable: boolean;
    defaultSystemWatchlist: boolean;
  }>> {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${this.apiUrl}/watchlists`, {
      headers: {
        ...headers,
        VERSION: "1",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch watchlists: ${response.statusText}`);
    }

    const data = await response.json();
    return data.watchlists || [];
  }

  /**
   * Get markets in a watchlist
   */
  async getWatchlistMarkets(watchlistId: string): Promise<Array<{
    epic: string;
    instrumentName: string;
    instrumentType: string;
    expiry: string;
    high: number;
    low: number;
    bid: number;
    offer: number;
    scalingFactor: number;
  }>> {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${this.apiUrl}/watchlists/${watchlistId}`, {
      headers: {
        ...headers,
        VERSION: "1",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch watchlist markets: ${response.statusText}`);
    }

    const data = await response.json();
    return data.markets || [];
  }
}


/**
 * Load all account configurations from accounts/[accountName]/account_info.json
 */
export async function loadAccounts(): Promise<IGAccountConfig[]> {
  const accountsDir = getAccountsPath();
  const accounts: IGAccountConfig[] = [];

  try {
    const entries = await readdir(accountsDir);

    for (const entry of entries) {
      const entryPath = join(accountsDir, entry);

      try {
        const entryStat = await stat(entryPath);
        if (!entryStat.isDirectory()) continue;

        // Try to load account_info.json from folder
        const infoPath = join(entryPath, "account_info.json");
        const content = await readFile(infoPath, "utf-8");
        const info = JSON.parse(content) as AccountInfo;

        // Load assets.json for pairs
        let pairs: Record<string, { epic: string }> = {};
        try {
          const assetsPath = join(entryPath, "assets.json");
          const assetsContent = await readFile(assetsPath, "utf-8");
          const assets = JSON.parse(assetsContent) as AssetsConfig;
          // Convert assets to pairs format (epic is the asset key)
          for (const assetName of Object.keys(assets)) {
            pairs[assetName] = { epic: assetName };
          }
        } catch {
          // No assets.json yet
        }

        // Convert to IGAccountConfig format
        const config: IGAccountConfig = {
          id: entry,
          name: info.metadata.account_name || entry,
          isActive: info.metadata.is_active ?? true,
          credentials: {
            api_key: info.credentials.api_key,
            username: info.credentials.username,
            password: info.credentials.password,
            acc_type: info.credentials.env,
          },
          pairs,
          _folder_path: entryPath,
        };

        accounts.push(config);
      } catch (e) {
        // Skip folders without valid account_info.json
        console.error(`Error loading account from ${entry}:`, e);
      }
    }
  } catch (e) {
    // accounts directory doesn't exist yet
    console.error("Error reading accounts directory:", e);
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
 * Save account configuration (saves to account_info.json)
 */
export async function saveAccount(account: IGAccountConfig): Promise<void> {
  const accountsDir = getAccountsPath();
  const folderPath = account._folder_path || join(accountsDir, account.id);
  const filePath = join(folderPath, "account_info.json");

  // Convert back to AccountInfo format
  const info: AccountInfo = {
    credentials: {
      api_key: account.credentials.api_key,
      username: account.credentials.username,
      password: account.credentials.password,
      env: account.credentials.acc_type,
    },
    money_management: {
      max_margin_usage: 0.9,
      min_lot_size: 0.1,
      emergency_stop_pct: 0.15,
    },
    metadata: {
      account_name: account.name,
      currency: "EUR",
      is_active: account.isActive,
    },
  };

  await writeFile(filePath, JSON.stringify(info, null, 2), "utf-8");
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

  // Load and update account_info.json directly
  const accountsDir = getAccountsPath();
  const infoPath = join(accountsDir, accountId, "account_info.json");

  try {
    const content = await readFile(infoPath, "utf-8");
    const info = JSON.parse(content) as AccountInfo;
    info.metadata.is_active = isActive;
    await writeFile(infoPath, JSON.stringify(info, null, 2), "utf-8");

    account.isActive = isActive;
    return account;
  } catch (e) {
    console.error(`Error toggling account ${accountId}:`, e);
    return null;
  }
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
