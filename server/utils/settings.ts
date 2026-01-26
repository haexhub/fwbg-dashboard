/**
 * Settings utility functions for loading and saving account configurations
 * Reads from fwbg accounts/[accountName]/ structure
 */

import { readFile, writeFile, readdir, stat, mkdir } from "fs/promises";
import { join } from "path";
import type { AccountInfo, AssetsConfig } from "./settings-types";
import { getAccountsPath } from "./accounts-path";

// Re-export for convenience
export { getAccountsPath } from "./accounts-path";

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
 * Create a new account folder with account_info.json and empty assets.json
 */
export async function createAccount(
  folderName: string,
  info: AccountInfo
): Promise<boolean> {
  const accountsPath = getAccountsPath();
  const folderPath = join(accountsPath, folderName);

  try {
    // Check if folder already exists
    if (await accountExists(folderName)) {
      throw new Error(`Account folder "${folderName}" already exists`);
    }

    // Create folder
    await mkdir(folderPath, { recursive: true });

    // Save account_info.json
    const infoPath = join(folderPath, "account_info.json");
    await writeFile(infoPath, JSON.stringify(info, null, 2), "utf-8");

    // Create empty assets.json
    const assetsPath = join(folderPath, "assets.json");
    await writeFile(assetsPath, JSON.stringify({}, null, 4), "utf-8");

    return true;
  } catch (error) {
    console.error(`Error creating account ${folderName}:`, error);
    throw error;
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

// Re-export IGClient from ig-client.ts for convenience
export { IGClient, createIGClient } from "./ig-client";
