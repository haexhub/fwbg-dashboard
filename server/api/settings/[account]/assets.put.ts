import { saveAssets, accountExists } from "~/server/utils/settings";
import type { AssetsConfig } from "~/server/utils/settings-types";

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

  const body = await readBody<AssetsConfig>(event);

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid assets structure",
    });
  }

  const success = await saveAssets(accountName, body);
  if (!success) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to save assets for '${accountName}'`,
    });
  }

  return { success: true };
});
