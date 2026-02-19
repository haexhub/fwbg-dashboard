import { accountExists, loadAccountInfo } from "~/server/utils/settings";
import { createIGClient } from "~/server/utils/ig-client";

interface ResetOptions {
  closePositions?: boolean;
}

export default defineEventHandler(async (event) => {
  const accountName = getRouterParam(event, "account");

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

  // Check if this is a DEMO account
  const accountInfo = await loadAccountInfo(accountName);
  if (!accountInfo) {
    throw createError({
      statusCode: 404,
      statusMessage: `Account info for '${accountName}' not found`,
    });
  }

  const isDemoAccount = accountInfo.metadata.env === "DEMO";

  // Parse request body
  const body = await readBody<ResetOptions>(event);
  const closePositions = body?.closePositions ?? true;

  // Create IG client
  let client;
  try {
    client = await createIGClient(accountName);
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create IG client for '${accountName}': ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Get current account balance before reset
  let currentBalance = 0;
  let suggestedResetAmount = 30000;
  try {
    const igAccountInfo = await client.getAccountInfo();
    if (igAccountInfo) {
      currentBalance = igAccountInfo.balance?.balance || 0;
      // Round up to next 10k or use 30k minimum
      suggestedResetAmount = Math.max(30000, Math.ceil(currentBalance / 10000) * 10000);
    }
  } catch (error) {
    console.error("Failed to get account balance:", error);
  }

  // Close all positions if requested
  let closeResult = { closed: 0, errors: [] as string[] };
  if (closePositions) {
    try {
      closeResult = await client.closeAllPositions();
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to close positions: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return {
    success: true,
    isDemoAccount,
    positionsClosed: closeResult.closed,
    positionsFailed: closeResult.errors.length,
    errors: closeResult.errors,
    currentBalance,
    suggestedResetAmount,
    // IG API does not support resetting demo balance programmatically
    // User must do this manually on the IG platform
    manualResetRequired: true,
    manualResetUrl: "https://www.ig.com/de/mein-ig/dashboard",
  };
});
