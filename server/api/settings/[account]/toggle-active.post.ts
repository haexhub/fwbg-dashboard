import {
  accountExists,
  loadAccountInfo,
  setAccountActive,
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

  const info = await loadAccountInfo(accountName);
  if (!info) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to load account info for '${accountName}'`,
    });
  }

  // Toggle the current state (default to true if not set)
  const currentState = info.metadata.is_active ?? true;
  const newState = !currentState;

  const success = await setAccountActive(accountName, newState);
  if (!success) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to update account state for '${accountName}'`,
    });
  }

  return {
    success: true,
    isActive: newState,
  };
});
