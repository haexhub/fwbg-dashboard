import { loadAssets, accountExists } from "~/server/utils/settings";

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

  const assets = await loadAssets(accountName);
  if (!assets) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to load assets for '${accountName}'`,
    });
  }

  return assets;
});
