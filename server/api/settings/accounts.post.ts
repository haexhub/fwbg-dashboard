import { createAccount } from "~/server/utils/settings";
import type { AccountInfo } from "~/server/utils/settings-types";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    folderName: string;
    info: AccountInfo;
  }>(event);

  if (!body.folderName) {
    throw createError({
      statusCode: 400,
      message: "folderName is required",
    });
  }

  if (!body.info) {
    throw createError({
      statusCode: 400,
      message: "info is required",
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

  try {
    await createAccount(body.folderName, body.info);
    return { success: true, folderName: body.folderName };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Failed to create account",
    });
  }
});
