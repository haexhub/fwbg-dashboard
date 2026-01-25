import { saveAccountInfo, accountExists } from "~/server/utils/settings";
import type { AccountInfo } from "~/server/utils/settings-types";

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

  const body = await readBody<AccountInfo>(event);

  if (!body || !body.credentials || !body.money_management || !body.metadata) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid account info structure",
    });
  }

  const success = await saveAccountInfo(accountName, body);
  if (!success) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to save account info for '${accountName}'`,
    });
  }

  return { success: true };
});
