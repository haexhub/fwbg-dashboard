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

/**
 * Symbol → IG Epic mapping (mirrors fwbg Python's SYMBOL_TO_EPIC)
 */
export const SYMBOL_TO_EPIC: Record<string, string> = {
  // Forex Majors
  EURUSD: "CS.D.EURUSD.CFD.IP",
  GBPUSD: "CS.D.GBPUSD.CFD.IP",
  USDJPY: "CS.D.USDJPY.CFD.IP",
  USDCHF: "CS.D.USDCHF.CFD.IP",
  USDCAD: "CS.D.USDCAD.CFD.IP",
  AUDUSD: "CS.D.AUDUSD.CFD.IP",
  NZDUSD: "CS.D.NZDUSD.CFD.IP",
  // Forex Crosses - EUR
  EURCAD: "CS.D.EURCAD.CFD.IP",
  EURCHF: "CS.D.EURCHF.CFD.IP",
  EURGBP: "CS.D.EURGBP.CFD.IP",
  EURJPY: "CS.D.EURJPY.CFD.IP",
  EURAUD: "CS.D.EURAUD.CFD.IP",
  EURNZD: "CS.D.EURNZD.CFD.IP",
  // Forex Crosses - GBP
  GBPAUD: "CS.D.GBPAUD.CFD.IP",
  GBPCAD: "CS.D.GBPCAD.CFD.IP",
  GBPCHF: "CS.D.GBPCHF.CFD.IP",
  GBPJPY: "CS.D.GBPJPY.CFD.IP",
  GBPNZD: "CS.D.GBPNZD.CFD.IP",
  // Forex Crosses - AUD
  AUDCAD: "CS.D.AUDCAD.CFD.IP",
  AUDCHF: "CS.D.AUDCHF.CFD.IP",
  AUDJPY: "CS.D.AUDJPY.CFD.IP",
  AUDNZD: "CS.D.AUDNZD.CFD.IP",
  // Forex Crosses - NZD
  NZDCAD: "CS.D.NZDCAD.CFD.IP",
  NZDCHF: "CS.D.NZDCHF.CFD.IP",
  NZDJPY: "CS.D.NZDJPY.CFD.IP",
  // Forex Crosses - CAD/CHF
  CADCHF: "CS.D.CADCHF.CFD.IP",
  CADJPY: "CS.D.CADJPY.CFD.IP",
  CHFJPY: "CS.D.CHFJPY.CFD.IP",
  // Indices
  DAX: "IX.D.DAX.DAILY.IP",
  DOW30: "IX.D.DOW.DAILY.IP",
  NAS100: "IX.D.NASDAQ.DAILY.IP",
  SPX500: "IX.D.SPTRD.DAILY.IP",
  FTSE100: "IX.D.FTSE.DAILY.IP",
  // Commodities
  XAUUSD: "CS.D.CFDGOLD.CFD.IP",
  XAGUSD: "CS.D.CFDSILVER.CFD.IP",
  BRENT: "CC.D.LCO.UNC.IP",
  WTI: "CC.D.CL.UNC.IP",
  // Crypto
  BTCUSD: "CS.D.BITCOIN.CFD.IP",
  ETHUSD: "CS.D.ETHUSD.CFD.IP",
};

/**
 * Timeframe → IG resolution mapping
 */
export const TIMEFRAME_TO_IG_RESOLUTION: Record<string, string> = {
  MINUTE_1: "MINUTE",
  MINUTE_5: "MINUTE_5",
  MINUTE_15: "MINUTE_15",
  MINUTE_30: "MINUTE_30",
  HOUR: "HOUR",
  DAY: "DAY",
};

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

  /**
   * Fetch current market snapshot from /markets/{epic}.
   * Does NOT count against the historical data allowance.
   *
   * Price handling differs by instrument type:
   * - CURRENCIES (Forex): bid/offer are in "points", real price is in
   *   instrument.currencies[0].baseExchangeRate
   * - Other types (Indices, Commodities): bid/offer are already real prices
   */
  async fetchMarketSnapshot(epic: string): Promise<{
    mid: number;
    bid: number;
    offer: number;
    updateTime: string;
  }> {
    let headers = await this.getAuthHeaders();
    const url = `${this.apiUrl}/markets/${epic}`;

    let response = await fetch(url, {
      headers: {
        ...headers,
        VERSION: "3",
      },
    });

    if (response.status === 401 || response.status === 403) {
      this.invalidateSession();
      headers = await this.getAuthHeaders(true);
      response = await fetch(url, {
        headers: {
          ...headers,
          VERSION: "3",
        },
      });
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch market snapshot for ${epic}: ${response.statusText}`);
    }

    const data = await response.json();
    const snap = data.snapshot;
    const instrument = data.instrument;

    let bid: number;
    let offer: number;
    let mid: number;

    if (instrument?.type === "CURRENCIES") {
      // Forex: snapshot.bid/offer are in points, not real prices.
      // The real mid-price is in currencies[0].baseExchangeRate.
      const currencies = instrument.currencies || [];
      const baseRate = currencies[0]?.baseExchangeRate;

      if (baseRate) {
        mid = Number(baseRate);
        // Derive bid/offer from spread in points using scalingFactor
        const sf = snap.scalingFactor || 10000;
        const spreadReal = (snap.offer - snap.bid) / sf;
        bid = mid - spreadReal / 2;
        offer = mid + spreadReal / 2;
      } else {
        // Fallback: divide by scalingFactor
        const sf = snap.scalingFactor || 10000;
        bid = snap.bid / sf;
        offer = snap.offer / sf;
        mid = (bid + offer) / 2;
      }
    } else {
      // Indices, Commodities, Crypto: bid/offer are already real prices
      bid = snap.bid;
      offer = snap.offer;
      mid = (bid + offer) / 2;
    }

    return { mid, bid, offer, updateTime: snap.updateTime };
  }

  /**
   * Fetch latest price bars for an epic from IG historical prices API.
   * Returns OHLC candle data with bid/ask midpoint prices.
   * NOTE: Counts against the IG historical data allowance!
   */
  async fetchLatestPrices(
    epic: string,
    resolution: string,
    numPoints: number = 2
  ): Promise<Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }>> {
    let headers = await this.getAuthHeaders();

    // V1 URL format: /prices/{epic}/{resolution}/{numPoints}
    const url = `${this.apiUrl}/prices/${epic}/${resolution}/${numPoints}`;

    let response = await fetch(url, {
      headers: {
        ...headers,
        VERSION: "1",
      },
    });

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
      throw new Error(`Failed to fetch prices for ${epic}: ${response.statusText}`);
    }

    const data = await response.json();
    const prices = data.prices || [];

    return prices.map((p: any) => {
      const snap = p.snapshotTimeUTC || p.snapshotTime;
      const o = (p.openPrice.bid + p.openPrice.ask) / 2;
      const h = (p.highPrice.bid + p.highPrice.ask) / 2;
      const l = (p.lowPrice.bid + p.lowPrice.ask) / 2;
      const c = (p.closePrice.bid + p.closePrice.ask) / 2;
      return {
        timestamp: new Date(snap).getTime(),
        open: o,
        high: h,
        low: l,
        close: c,
      };
    });
  }
}


/**
 * Load all account configurations from accounts/[accountName]/account_info.json
 */
export async function loadAccounts(): Promise<IGAccountConfig[]> {
  const accountsDir = getAccountsPath();
  const accounts: IGAccountConfig[] = [];

  try {
    await stat(accountsDir);
  } catch {
    return accounts;
  }

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
            api_key: info.credentials.api_key ?? "",
            username: info.credentials.username ?? "",
            password: info.credentials.password ?? "",
            acc_type: (info.metadata.env as "DEMO" | "LIVE") ?? "DEMO",
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

  // Load existing info to preserve money_management and other fields
  let existing: AccountInfo | null = null;
  try {
    const content = await readFile(filePath, "utf-8");
    existing = JSON.parse(content) as AccountInfo;
  } catch {
    // File doesn't exist yet
  }

  // Convert back to AccountInfo format
  const info: AccountInfo = {
    broker_type: existing?.broker_type ?? "ig",
    credentials: {
      api_key: account.credentials.api_key,
      username: account.credentials.username,
      password: account.credentials.password,
    },
    money_management: existing?.money_management ?? {
      max_margin_usage: 0.9,
      min_lot_size: 0.1,
      emergency_stop_pct: 0.15,
    },
    metadata: {
      account_name: account.name,
      currency: existing?.metadata.currency ?? "EUR",
      env: account.credentials.acc_type,
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
