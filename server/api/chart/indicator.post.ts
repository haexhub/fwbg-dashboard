/**
 * POST /api/chart/indicator
 * Proxy to fwbg API: compute indicator for chart.
 * If source is a broker, injects credentials before forwarding.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // If source is a broker, inject credentials
  if (body.source?.startsWith("broker:")) {
    const accountId = body.source.replace("broker:", "");
    const accounts = await loadAccounts();
    const account = accounts.find((a) => a.id === accountId);
    if (!account) {
      throw createError({ statusCode: 404, statusMessage: `Account not found: ${accountId}` });
    }
    body.broker_type = "ig";
    body.credentials = {
      api_key: account.credentials.api_key,
      username: account.credentials.username,
      password: account.credentials.password,
      acc_type: account.credentials.acc_type,
    };
  }

  return fwbgFetch<unknown>("/api/chart/indicator", {
    method: "POST",
    body: JSON.stringify(body),
  });
});
