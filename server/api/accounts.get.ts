import { loadAccounts } from "../utils/ig-client";

/**
 * GET /api/accounts
 * Returns list of all configured accounts (without sensitive credentials)
 */
export default defineEventHandler(async () => {
  const accounts = await loadAccounts();

  // Return accounts without sensitive credentials
  return {
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      isActive: a.isActive,
      accType: a.credentials?.acc_type || "UNKNOWN",
      pairsCount: Object.keys(a.pairs || {}).length,
    })),
  };
});
