/**
 * Settings utility functions for loading and saving account configurations
 * Reads from fwbg accounts/[accountName]/ structure
 */

import { readFile, writeFile, readdir, stat } from "fs/promises";
import { join } from "path";
import type { AccountInfo, AssetsConfig } from "./settings-types";

/**
 * Get the accounts directory path from runtime config
 */
function getAccountsPath(): string {
  try {
    const config = useRuntimeConfig();
    return config.accountsPath || "/app/accounts";
  } catch {
    return process.env.ACCOUNTS_PATH || "/app/accounts";
  }
}

/**
 * List all account folders in the accounts directory
 * Only returns directories that contain account_info.json
 */
export async function listAccountFolders(): Promise<string[]> {
  const accountsPath = getAccountsPath();
  const accounts: string[] = [];

  try {
    const entries = await readdir(accountsPath);

    for (const entry of entries) {
      const entryPath = join(accountsPath, entry);
      const entryStat = await stat(entryPath);

      if (entryStat.isDirectory()) {
        // Check if this directory contains account_info.json
        const infoPath = join(entryPath, "account_info.json");
        try {
          await stat(infoPath);
          accounts.push(entry);
        } catch {
          // account_info.json doesn't exist, skip this folder
        }
      }
    }
  } catch (error) {
    console.error("Error listing account folders:", error);
  }

  return accounts;
}

/**
 * Load account_info.json for a specific account
 */
export async function loadAccountInfo(
  accountName: string
): Promise<AccountInfo | null> {
  const accountsPath = getAccountsPath();
  const filePath = join(accountsPath, accountName, "account_info.json");

  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as AccountInfo;
  } catch (error) {
    console.error(`Error loading account info for ${accountName}:`, error);
    return null;
  }
}

/**
 * Save account_info.json for a specific account
 */
export async function saveAccountInfo(
  accountName: string,
  data: AccountInfo
): Promise<boolean> {
  const accountsPath = getAccountsPath();
  const filePath = join(accountsPath, accountName, "account_info.json");

  try {
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error(`Error saving account info for ${accountName}:`, error);
    return false;
  }
}

/**
 * Load assets.json for a specific account
 */
export async function loadAssets(
  accountName: string
): Promise<AssetsConfig | null> {
  const accountsPath = getAccountsPath();
  const filePath = join(accountsPath, accountName, "assets.json");

  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as AssetsConfig;
  } catch (error) {
    console.error(`Error loading assets for ${accountName}:`, error);
    return null;
  }
}

/**
 * Save assets.json for a specific account
 */
export async function saveAssets(
  accountName: string,
  data: AssetsConfig
): Promise<boolean> {
  const accountsPath = getAccountsPath();
  const filePath = join(accountsPath, accountName, "assets.json");

  try {
    await writeFile(filePath, JSON.stringify(data, null, 4), "utf-8");
    return true;
  } catch (error) {
    console.error(`Error saving assets for ${accountName}:`, error);
    return false;
  }
}

/**
 * Check if an account folder exists
 */
export async function accountExists(accountName: string): Promise<boolean> {
  const accountsPath = getAccountsPath();
  const folderPath = join(accountsPath, accountName);

  try {
    const folderStat = await stat(folderPath);
    return folderStat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Set account active state
 */
export async function setAccountActive(
  accountName: string,
  isActive: boolean
): Promise<boolean> {
  const info = await loadAccountInfo(accountName);
  if (!info) return false;

  // Ensure metadata.is_active exists
  if (info.metadata.is_active === undefined) {
    info.metadata.is_active = true;
  }

  info.metadata.is_active = isActive;
  return await saveAccountInfo(accountName, info);
}

/**
 * IG Client for new account_info.json structure
 */
export class SettingsIGClient {
  private apiKey: string;
  private username: string;
  private password: string;
  private apiUrl: string;
  private accountName: string;
  private cst: string | null = null;
  private securityToken: string | null = null;
  private sessionExpiresAt: number = 0;

  constructor(info: AccountInfo, accountName: string) {
    this.accountName = accountName;
    this.apiKey = info.credentials.api_key;
    this.username = info.credentials.username;
    this.password = info.credentials.password;
    this.apiUrl =
      info.credentials.env === "DEMO"
        ? "https://demo-api.ig.com/gateway/deal"
        : "https://api.ig.com/gateway/deal";
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (this.cst && this.securityToken && this.sessionExpiresAt > Date.now()) {
      return {
        "X-IG-API-KEY": this.apiKey,
        CST: this.cst,
        "X-SECURITY-TOKEN": this.securityToken,
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

    this.cst = response.headers.get("CST");
    this.securityToken = response.headers.get("X-SECURITY-TOKEN");

    if (!this.cst || !this.securityToken) {
      throw new Error("IG Login failed: Missing authentication tokens");
    }

    this.sessionExpiresAt = Date.now() + 60 * 60 * 1000;

    return {
      "X-IG-API-KEY": this.apiKey,
      CST: this.cst,
      "X-SECURITY-TOKEN": this.securityToken,
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

  async closePosition(dealId: string, direction: string, size: number) {
    const headers = await this.getAuthHeaders();
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

  async closeAllPositions(): Promise<{
    closed: number;
    failed: number;
    errors: string[];
  }> {
    const positions = await this.getOpenPositions();
    const errors: string[] = [];
    let closed = 0;
    let failed = 0;

    for (const pos of positions) {
      try {
        await this.closePosition(
          pos.position.dealId,
          pos.position.direction,
          pos.position.size
        );
        closed++;
      } catch (error) {
        failed++;
        errors.push(
          `${pos.market?.instrumentName || pos.position.dealId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return { closed, failed, errors };
  }
}

/**
 * Create IG client from account_info.json
 */
export async function createSettingsIGClient(
  accountName: string
): Promise<SettingsIGClient | null> {
  const info = await loadAccountInfo(accountName);
  if (!info) return null;

  return new SettingsIGClient(info, accountName);
}
