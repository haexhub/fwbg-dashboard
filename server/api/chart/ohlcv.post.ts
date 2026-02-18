/**
 * POST /api/chart/ohlcv
 * Load OHLCV data from a broker source.
 * Dashboard injects broker credentials from ACCOUNTS_PATH before forwarding to fwbg.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // Extract account ID from source (e.g. "broker:ig-demo" → "ig-demo")
  const accountId = body.source?.replace("broker:", "");
  if (!accountId) {
    throw createError({ statusCode: 400, statusMessage: "Missing broker source" });
  }

  // Load account credentials
  const accounts = await loadAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) {
    throw createError({ statusCode: 404, statusMessage: `Account not found: ${accountId}` });
  }

  // Forward to fwbg with credentials injected
  return fwbgFetch<unknown>("/api/chart/ohlcv", {
    method: "POST",
    body: JSON.stringify({
      symbol: body.symbol,
      timeframe: body.timeframe,
      limit: body.limit || 5000,
      broker_type: "ig",
      credentials: {
        api_key: account.credentials.api_key,
        username: account.credentials.username,
        password: account.credentials.password,
        acc_type: account.credentials.acc_type,
      },
    }),
  });
});
