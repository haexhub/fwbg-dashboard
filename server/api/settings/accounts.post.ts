import { createAccount } from "~/server/utils/settings";
import type { AccountInfo } from "~/server/utils/settings-types";

const DEFAULT_MONEY_MANAGEMENT = {
  max_margin_usage: 0.9,
  min_lot_size: 0.1,
  emergency_stop_pct: 0.15,
};

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    folderName: string;
    accountInfo: AccountInfo;
  }>(event);

  if (!body.folderName) {
    throw createError({
      statusCode: 400,
      message: "folderName is required",
    });
  }

  if (!body.accountInfo) {
    throw createError({
      statusCode: 400,
      message: "accountInfo is required",
    });
  }

  if (!body.accountInfo.broker_type) {
    throw createError({
      statusCode: 400,
      message: "broker_type is required",
    });
  }

  // Validate folder name (only alphanumeric, underscores, and hyphens)
  if (!/^[a-zA-Z0-9_-]+$/.test(body.folderName)) {
    throw createError({
      statusCode: 400,
      message:
        "Invalid folder name. Use only letters, numbers, underscores, and hyphens.",
    });
  }

  // Ensure money_management has defaults if not provided
  const info: AccountInfo = {
    ...body.accountInfo,
    money_management: {
      ...DEFAULT_MONEY_MANAGEMENT,
      ...body.accountInfo.money_management,
    },
  };

  try {
    await createAccount(body.folderName, info);
    return { success: true, folderName: body.folderName };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Failed to create account",
    });
  }
});
