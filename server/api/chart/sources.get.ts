/**
 * GET /api/chart/sources
 * Proxy to fwbg API: list available data sources.
 * Merges CSV sources from fwbg with configured broker accounts.
 */
export default defineEventHandler(async () => {
  // Get CSV sources from fwbg
  const csvSources = await fwbgFetch<unknown[]>("/api/chart/sources");

  // Get configured broker accounts and add as additional sources
  const accounts = await loadAccounts();
  const brokerSources = accounts
    .filter((a) => a.isActive)
    .map((a) => ({
      name: `broker:${a.id}`,
      type: "broker" as const,
      description: `${a.name} (${a.credentials?.acc_type || "UNKNOWN"})`,
      broker_type: "ig",
      account_id: a.id,
      symbols: [], // Broker symbols are dynamic, not pre-scanned
    }));

  return [...csvSources, ...brokerSources];
});
