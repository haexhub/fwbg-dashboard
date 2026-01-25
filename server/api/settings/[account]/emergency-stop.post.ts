import {
  accountExists,
  setAccountActive,
  createSettingsIGClient,
} from "~/server/utils/settings";

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

  // Create IG client and close all positions
  const client = await createSettingsIGClient(accountName);
  if (!client) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create IG client for '${accountName}'`,
    });
  }

  let closeResult = { closed: 0, failed: 0, errors: [] as string[] };

  try {
    closeResult = await client.closeAllPositions();
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to close positions: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Deactivate the account
  const deactivated = await setAccountActive(accountName, false);

  return {
    success: true,
    accountDeactivated: deactivated,
    positionsClosed: closeResult.closed,
    positionsFailed: closeResult.failed,
    errors: closeResult.errors,
  };
});
