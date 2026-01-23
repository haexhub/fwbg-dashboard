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
  profitAndLoss: string;
  size: string;
}

function parseIGTransaction(tx: IGTransaction, accountId?: string, accountName?: string): Trade {
  const pnlMatch = tx.profitAndLoss?.match(/[+-]?[\d.]+/);
  const pnl = pnlMatch ? parseFloat(pnlMatch[0]) : 0;
  const sizeNum = parseFloat(tx.size) || 0;

  return {
    timestamp: tx.date || "",
    epic: tx.instrumentName || "",
    deal_id: tx.reference || "",
    signal: sizeNum < 0 ? "SELL" : "BUY",
    size: Math.abs(sizeNum),
    pnl,
    accountId,
    accountName,
  };
}

/**
 * GET /api/performance
 * Returns performance metrics for all accounts or a specific account
 * Query params:
 *   - accountId: Filter by specific account
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
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

  // If no accounts configured, try legacy location
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

  // Only consider trades with P&L (closed trades)
  const closedTrades = allTrades.filter((t) => t.pnl !== 0);

  if (closedTrades.length === 0) {
    return {
      totalTrades: allTrades.length,
      closedTrades: 0,
      openTrades: allTrades.filter((t) => t.pnl === 0).length,
      winRate: 0,
      totalPnl: 0,
      avgPnl: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      equityCurve: [],
    };
  }

  const wins = closedTrades.filter((t) => t.pnl > 0);
  const losses = closedTrades.filter((t) => t.pnl < 0);

  const totalPnl = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

  // Calculate equity curve and max drawdown
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const equityCurve: number[] = [];

  // Sort by timestamp
  closedTrades.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const trade of closedTrades) {
    equity += trade.pnl;
    equityCurve.push(equity);

    if (equity > peak) {
      peak = equity;
    }

    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return {
    totalTrades: allTrades.length,
    closedTrades: closedTrades.length,
    openTrades: allTrades.filter((t) => t.pnl === 0).length,
    winRate: Math.round((wins.length / closedTrades.length) * 100 * 100) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
    avgPnl: Math.round((totalPnl / closedTrades.length) * 100) / 100,
    profitFactor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : 0,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    equityCurve,
  };
});
