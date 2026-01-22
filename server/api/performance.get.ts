import { readFile } from "fs/promises";
import { join } from "path";

interface Trade {
  timestamp: string;
  epic: string;
  deal_id: string;
  signal: "BUY" | "SELL";
  size: number;
  pnl: number;
}

function parseCSV(content: string): Trade[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",");
  const trades: Trade[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    if (values.length !== headers.length) continue;

    trades.push({
      timestamp: values[0],
      epic: values[1],
      deal_id: values[2],
      signal: values[3] as "BUY" | "SELL",
      size: parseFloat(values[4]),
      pnl: parseFloat(values[5]),
    });
  }

  return trades;
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const tradesPath = join(config.dataPath, "trade_history.csv");

  try {
    const content = await readFile(tradesPath, "utf-8");
    const trades = parseCSV(content);

    // Only consider closed trades (pnl != 0)
    const closedTrades = trades.filter((t) => t.pnl !== 0);

    if (closedTrades.length === 0) {
      return {
        totalTrades: trades.length,
        closedTrades: 0,
        openTrades: trades.filter((t) => t.pnl === 0).length,
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
      totalTrades: trades.length,
      closedTrades: closedTrades.length,
      openTrades: trades.filter((t) => t.pnl === 0).length,
      winRate: (wins.length / closedTrades.length) * 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      avgPnl: Math.round((totalPnl / closedTrades.length) * 100) / 100,
      profitFactor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : 0,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      equityCurve,
    };
  } catch (error) {
    return {
      totalTrades: 0,
      closedTrades: 0,
      openTrades: 0,
      winRate: 0,
      totalPnl: 0,
      avgPnl: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      equityCurve: [],
      error: "Could not calculate performance",
    };
  }
});
