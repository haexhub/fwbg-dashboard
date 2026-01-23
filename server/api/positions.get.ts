import { readFile, readdir } from "fs/promises";
import { join } from "path";

interface Position {
  dealId: string;
  epic: string;
  instrumentName: string;
  direction: string;
  size: number;
  openLevel: number;
  currentLevel: number;
  stopLevel: number | null;
  limitLevel: number | null;
  profitLoss: number;
  currency: string;
  createdDate: string;
  accountId?: string;
  accountName?: string;
}

interface PositionsResult {
  accountId: string;
  accountName: string;
  timestamp?: string;
  positions: Position[];
  error?: string;
}

/**
 * GET /api/positions
 * Returns open positions from saved JSON files
 * Optional query param: ?accountId=xxx for specific account
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const accountId = query.accountId as string | undefined;

  const statsDir = join(config.dataPath, "stats_export");

  // If specific account requested
  if (accountId) {
    return await getPositions(statsDir, accountId);
  }

  // Return all accounts' positions
  try {
    const accountDirs = await readdir(statsDir, { withFileTypes: true });
    const accountIds = accountDirs
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const allPositions: Position[] = [];
    const results: PositionsResult[] = [];

    for (const accId of accountIds) {
      const result = await getPositions(statsDir, accId);
      results.push(result);

      // Add account info to each position for combined view
      for (const pos of result.positions) {
        allPositions.push({
          ...pos,
          accountId: result.accountId,
          accountName: result.accountName,
        });
      }
    }

    return {
      positions: allPositions,
      byAccount: results,
      summary: {
        totalPositions: allPositions.length,
        totalProfitLoss: allPositions.reduce((sum, p) => sum + p.profitLoss, 0),
      },
    };
  } catch {
    return {
      positions: [],
      byAccount: [],
      summary: {
        totalPositions: 0,
        totalProfitLoss: 0,
      },
      error: "Could not read positions",
    };
  }
});

async function getPositions(
  statsDir: string,
  accountId: string
): Promise<PositionsResult> {
  const positionsPath = join(statsDir, accountId, "open_positions.json");

  try {
    const content = await readFile(positionsPath, "utf-8");
    const data = JSON.parse(content);

    return {
      accountId: data.accountId || accountId,
      accountName: data.accountName || accountId,
      timestamp: data.timestamp,
      positions: data.positions || [],
    };
  } catch {
    return {
      accountId,
      accountName: accountId,
      positions: [],
      error: `Could not read positions for ${accountId}`,
    };
  }
}
