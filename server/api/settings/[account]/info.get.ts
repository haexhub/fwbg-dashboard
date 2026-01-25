import { loadAccountInfo, accountExists } from "~/server/utils/settings";

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

  return info;
});
