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

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const limit = parseInt(query.limit as string) || 50;
  const offset = parseInt(query.offset as string) || 0;

  const tradesPath = join(config.dataPath, "trade_history.csv");

  try {
    const content = await readFile(tradesPath, "utf-8");
    const allTrades = parseCSV(content);

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
  } catch (error) {
    return {
      trades: [],
      total: 0,
      limit,
      offset,
      error: "Could not read trade history",
    };
  }
});
