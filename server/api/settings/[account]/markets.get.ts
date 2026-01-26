import { createIGClient } from "~/server/utils/ig-client";
import { accountExists } from "~/server/utils/settings";

export interface MarketInfo {
  epic: string;
  instrumentName: string;
  instrumentType: string;
  expiry: string;
}

/**
 * GET /api/settings/[account]/markets
 * Returns available markets from IG API
 *
 * Query params:
 * - search: Search term to filter markets (e.g., "EUR", "GOLD")
 * - watchlist: Watchlist ID to get markets from
 */
export default defineEventHandler(async (event) => {
  const accountName = getRouterParam(event, "account");
  const query = getQuery(event);
  const searchTerm = query.search as string | undefined;
  const watchlistId = query.watchlist as string | undefined;

  if (!accountName) {
    throw createError({
      statusCode: 400,
      statusMessage: "Account name is required",
    });
  }

  const exists = await accountExists(accountName);
  if (!exists) {
    throw createError({
      statusCode: 404,
      statusMessage: `Account '${accountName}' not found`,
    });
  }

  let client;
  try {
    client = await createIGClient(accountName);
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create IG client: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  try {
    // If watchlist ID provided, get markets from that watchlist
    if (watchlistId) {
      const markets = await client.getWatchlistMarkets(watchlistId);
      return {
        markets: markets.map((m) => ({
          epic: m.epic,
          instrumentName: m.instrumentName,
          instrumentType: m.instrumentType,
          expiry: m.expiry,
        })),
      };
    }

    // If search term provided, search for markets
    if (searchTerm) {
      const markets = await client.searchMarkets(searchTerm);
      return {
        markets: markets.map((m) => ({
          epic: m.epic,
          instrumentName: m.instrumentName,
          instrumentType: m.instrumentType,
          expiry: m.expiry,
        })),
      };
    }

    // Otherwise, get watchlists so user can choose
    const watchlists = await client.getWatchlists();
    return {
      watchlists,
      hint: "Provide ?search=TERM or ?watchlist=ID to get markets",
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch markets: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});
