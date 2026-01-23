import { readFile, readdir } from "fs/promises";
import { join } from "path";

interface AccountInfo {
  balance: number;
  available: number;
  profitLoss: number;
  deposit: number;
}

interface AccountInfoResult {
  accountId: string;
  accountName: string;
  timestamp?: string;
  account?: AccountInfo;
  error?: string;
}

/**
 * GET /api/account-info
 * Returns account balance/margin info from saved JSON files
 * Optional query param: ?accountId=xxx for specific account
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const accountId = query.accountId as string | undefined;

  const statsDir = join(config.dataPath, "stats_export");

  // If specific account requested
  if (accountId) {
    return await getAccountInfo(statsDir, accountId);
  }

  // Return all accounts' info
  try {
    const accountDirs = await readdir(statsDir, { withFileTypes: true });
    const accountIds = accountDirs
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const results: AccountInfoResult[] = [];
    let totalBalance = 0;
    let totalAvailable = 0;
    let totalProfitLoss = 0;
    let totalDeposit = 0;

    for (const accId of accountIds) {
      const result = await getAccountInfo(statsDir, accId);
      results.push(result);

      if (result.account) {
        totalBalance += result.account.balance;
        totalAvailable += result.account.available;
        totalProfitLoss += result.account.profitLoss;
        totalDeposit += result.account.deposit;
      }
    }

    return {
      accounts: results,
      summary: {
        balance: totalBalance,
        available: totalAvailable,
        profitLoss: totalProfitLoss,
        deposit: totalDeposit,
      },
    };
  } catch {
    return {
      accounts: [],
      summary: {
        balance: 0,
        available: 0,
        profitLoss: 0,
        deposit: 0,
      },
      error: "Could not read account info",
    };
  }
});

async function getAccountInfo(
  statsDir: string,
  accountId: string
): Promise<AccountInfoResult> {
  const infoPath = join(statsDir, accountId, "account_info.json");

  try {
    const content = await readFile(infoPath, "utf-8");
    const data = JSON.parse(content);

    return {
      accountId: data.accountId || accountId,
      accountName: data.accountName || accountId,
      timestamp: data.timestamp,
      account: data.account,
    };
  } catch {
    return {
      accountId,
      accountName: accountId,
      error: `Could not read account info for ${accountId}`,
    };
  }
}
