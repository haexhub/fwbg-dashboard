import { readFile } from "fs/promises";
import { join } from "path";
import { loadAccounts } from "../utils/ig-client";

interface BotStatus {
  last_heartbeat: string;
  status: string;
  active_pairs_count: number;
  active_epics: string[];
  account_id?: string;
  account_mode: string;
}

interface AccountStatus extends BotStatus {
  accountId: string;
  accountName: string;
  isAlive: boolean;
  lastHeartbeatAgo: number;
}

/**
 * GET /api/status
 * Returns bot status for all accounts or a specific account
 * Query params:
 *   - accountId: Filter by specific account
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const accountIdFilter = query.accountId as string | undefined;

  const accounts = await loadAccounts();
  const statuses: AccountStatus[] = [];

  // Filter accounts if specific one requested
  const accountsToQuery = accountIdFilter
    ? accounts.filter((a) => a.id === accountIdFilter)
    : accounts;

  for (const account of accountsToQuery) {
    const statusPath = join(
      config.dataPath,
      "stats_export",
      account.id,
      "bot_status.json"
    );

    try {
      const content = await readFile(statusPath, "utf-8");
      const status: BotStatus = JSON.parse(content);

      // Calculate if bot is alive (heartbeat within last 10 minutes)
      const lastHeartbeat = new Date(status.last_heartbeat);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastHeartbeat.getTime()) / 1000 / 60;
      const isAlive = diffMinutes < 10;

      statuses.push({
        ...status,
        accountId: account.id,
        accountName: account.name,
        isAlive,
        lastHeartbeatAgo: Math.round(diffMinutes),
      });
    } catch {
      // No status file for this account yet
      statuses.push({
        accountId: account.id,
        accountName: account.name,
        status: "OFFLINE",
        isAlive: false,
        lastHeartbeatAgo: -1,
        last_heartbeat: "",
        active_pairs_count: 0,
        active_epics: [],
        account_mode: account.isDemo ? "DEMO" : "LIVE",
      });
    }
  }

  // If no accounts configured, try legacy location
  if (accounts.length === 0) {
    const legacyPath = join(config.dataPath, "stats_export", "bot_status.json");

    try {
      const content = await readFile(legacyPath, "utf-8");
      const status: BotStatus = JSON.parse(content);

      const lastHeartbeat = new Date(status.last_heartbeat);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastHeartbeat.getTime()) / 1000 / 60;
      const isAlive = diffMinutes < 10;

      statuses.push({
        ...status,
        accountId: "legacy",
        accountName: "Default Account",
        isAlive,
        lastHeartbeatAgo: Math.round(diffMinutes),
      });
    } catch {
      statuses.push({
        accountId: "legacy",
        accountName: "Default Account",
        status: "OFFLINE",
        isAlive: false,
        lastHeartbeatAgo: -1,
        last_heartbeat: "",
        active_pairs_count: 0,
        active_epics: [],
        account_mode: "unknown",
      });
    }
  }

  // If single account requested, return just that status
  if (accountIdFilter && statuses.length === 1) {
    return statuses[0];
  }

  return {
    accounts: statuses,
    summary: {
      total: statuses.length,
      online: statuses.filter((s) => s.isAlive).length,
      offline: statuses.filter((s) => !s.isAlive).length,
    },
  };
});
