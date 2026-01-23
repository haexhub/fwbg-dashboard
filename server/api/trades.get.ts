import { readFile } from "fs/promises";
import { join } from "path";
import { loadAccounts } from "../utils/ig-client";

interface Trade {
  timestamp: string;
  epic: string;
  deal_id: string;
  signal: "BUY" | "SELL";
  size: number;
  pnl: number;
  accountId?: string;
  accountName?: string;
}

interface IGTransaction {
  date: string;
  reference: string;
  instrumentName: string;
  period: string;
  profitAndLoss: string;
  transactionType: string;
  openLevel: string;
  closeLevel: string;
  size: string;
  currency: string;
}

function parseIGTransaction(tx: IGTransaction, accountId?: string, accountName?: string): Trade {
  // Parse P&L from string like "E-3.78" or "E40.82"
  const pnlMatch = tx.profitAndLoss?.match(/[+-]?[\d.]+/);
  const pnl = pnlMatch ? parseFloat(pnlMatch[0]) : 0;

  // Determine signal from size (negative = SELL, positive = BUY)
  const sizeNum = parseFloat(tx.size) || 0;
  const signal = sizeNum < 0 ? "SELL" : "BUY";

  return {
    timestamp: tx.date || "",
    epic: tx.instrumentName || "",
    deal_id: tx.reference || "",
    signal,
    size: Math.abs(sizeNum),
    pnl,
    accountId,
    accountName,
  };
}

/**
 * GET /api/trades
 * Returns trades from all accounts or a specific account
 * Query params:
 *   - accountId: Filter by specific account
 *   - limit: Number of trades to return (default 50)
 *   - offset: Pagination offset (default 0)
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const limit = parseInt(query.limit as string) || 50;
  const offset = parseInt(query.offset as string) || 0;
  const accountIdFilter = query.accountId as string | undefined;

  let allTrades: Trade[] = [];

  // Get all configured accounts
  const accounts = await loadAccounts();

  // Filter accounts if specific one requested
  const accountsToQuery = accountIdFilter
    ? accounts.filter((a) => a.id === accountIdFilter)
    : accounts;

  // Read transactions from each account
  for (const account of accountsToQuery) {
    const txHistoryPath = join(
      config.dataPath,
      "stats_export",
      account.id,
      "transaction_history.json"
    );

    try {
      const txContent = await readFile(txHistoryPath, "utf-8");
      const txData = JSON.parse(txContent);

      if (txData.transactions && Array.isArray(txData.transactions)) {
        const accountTrades = txData.transactions.map((tx: IGTransaction) =>
          parseIGTransaction(tx, account.id, account.name)
        );
        allTrades.push(...accountTrades);
      }
    } catch {
      // No transaction data for this account yet
    }
  }

  // If no accounts configured, try legacy location (backwards compatibility)
  if (accounts.length === 0) {
    const legacyPath = join(
      config.dataPath,
      "stats_export",
      "transaction_history.json"
    );

    try {
      const txContent = await readFile(legacyPath, "utf-8");
      const txData = JSON.parse(txContent);

      if (txData.transactions && Array.isArray(txData.transactions)) {
        allTrades = txData.transactions.map((tx: IGTransaction) =>
          parseIGTransaction(tx)
        );
      }
    } catch {
      // No legacy data either
    }
  }

  // Sort by timestamp descending (newest first)
  allTrades.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const trades = allTrades.slice(offset, offset + limit);

  return {
    trades,
    total: allTrades.length,
    limit,
    offset,
  };
});
