import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { createIGClient, loadAccounts } from "../utils/ig-client";

interface SyncResult {
  accountId: string;
  accountName: string;
  success: boolean;
  error?: string;
  openPositions?: number;
  transactions?: number;
  account?: Record<string, any>;
}

/**
 * POST /api/sync
 * Synchronizes data from IG API for all configured accounts
 * Optional query param: ?accountId=xxx to sync only one account
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const dataPath = config.dataPath || "/app/data";
  const query = getQuery(event);
  const specificAccountId = query.accountId as string | undefined;

  const accounts = await loadAccounts();

  if (accounts.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No accounts configured. Create accounts.json in data directory.",
    });
  }

  // Filter to specific account if requested
  const accountsToSync = specificAccountId
    ? accounts.filter((a) => a.id === specificAccountId)
    : accounts;

  if (specificAccountId && accountsToSync.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: `Account not found: ${specificAccountId}`,
    });
  }

  const results: SyncResult[] = [];

  for (const account of accountsToSync) {
    const result: SyncResult = {
      accountId: account.id,
      accountName: account.name,
      success: false,
    };

    try {
      const client = await createIGClient(account.id);

      // Ensure account-specific stats_export directory exists
      const statsDir = join(dataPath, "stats_export", account.id);
      await mkdir(statsDir, { recursive: true });

      // 1. Fetch and save open positions
      console.log(`[${account.name}] Fetching open positions...`);
      const positions = await client.getOpenPositions();
      const openPositions = positions.map((p: any) => ({
        dealId: p.position?.dealId || "",
        epic: p.market?.epic || "",
        instrumentName: p.market?.instrumentName || "",
        direction: p.position?.direction || "",
        size: parseFloat(p.position?.size || 0),
        openLevel: parseFloat(p.position?.level || 0),
        currentLevel:
          p.position?.direction === "SELL"
            ? parseFloat(p.market?.bid || 0)
            : parseFloat(p.market?.offer || 0),
        profitLoss: parseFloat(
          p.position?.profitAndLoss?.replace(/[^0-9.-]/g, "") || 0
        ),
        currency: p.position?.currency || "EUR",
        createdDate: p.position?.createdDate || "",
      }));

      await writeFile(
        join(statsDir, "open_positions.json"),
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            accountId: account.id,
            accountName: account.name,
            positions: openPositions,
          },
          null,
          2
        )
      );
      result.openPositions = openPositions.length;

      // 2. Fetch and save transaction history
      console.log(`[${account.name}] Fetching transaction history...`);
      const transactions = await client.getTransactionHistory(30);

      // Filter to only trades (not funding adjustments)
      const trades = transactions
        .filter((t: any) => t.transactionType === "TRADE")
        .map((t: any) => ({
          date: t.date || "",
          reference: t.reference || "",
          instrumentName: t.instrumentName || "",
          period: t.period || "",
          profitAndLoss: t.profitAndLoss || "",
          transactionType: t.transactionType || "",
          openLevel: t.openLevel || "",
          closeLevel: t.closeLevel || "",
          size: t.size || "",
          currency: t.currency || "EUR",
        }));

      await writeFile(
        join(statsDir, "transaction_history.json"),
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            accountId: account.id,
            accountName: account.name,
            transactions: trades,
          },
          null,
          2
        )
      );
      result.transactions = trades.length;

      // 3. Fetch and save account info
      console.log(`[${account.name}] Fetching account info...`);
      const accountInfo = await client.getAccountInfo();

      if (accountInfo) {
        const info = {
          balance: parseFloat(accountInfo.balance?.balance || 0),
          available: parseFloat(accountInfo.balance?.available || 0),
          profitLoss: parseFloat(accountInfo.balance?.profitLoss || 0),
          deposit: parseFloat(accountInfo.balance?.deposit || 0),
        };

        await writeFile(
          join(statsDir, "account_info.json"),
          JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              accountId: account.id,
              accountName: account.name,
              account: info,
            },
            null,
            2
          )
        );
        result.account = info;
      }

      console.log(`[${account.name}] Sync completed!`);
      result.success = true;
    } catch (error: any) {
      console.error(`[${account.name}] Sync failed:`, error.message);
      result.error = error.message;
    }

    results.push(result);
  }

  const allSuccess = results.every((r) => r.success);
  const anySuccess = results.some((r) => r.success);

  return {
    success: anySuccess,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    },
  };
});
