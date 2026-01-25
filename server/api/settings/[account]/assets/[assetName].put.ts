import { loadAssets, saveAssets, accountExists } from "~/server/utils/settings";
import type { AssetConfig } from "~/server/utils/settings-types";

export default defineEventHandler(async (event) => {
  const accountName = getRouterParam(event, "account");
  const assetName = getRouterParam(event, "assetName");

  if (!accountName) {
    throw createError({
      statusCode: 400,
      statusMessage: "Account name is required",
    });
  }

  if (!assetName) {
    throw createError({
      statusCode: 400,
      statusMessage: "Asset name is required",
    });
  }

  const exists = await accountExists(accountName);
  if (!exists) {
    throw createError({
      statusCode: 404,
      statusMessage: `Account '${accountName}' not found`,
    });
  }

  const body = await readBody<AssetConfig>(event);

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid asset config structure",
    });
  }

  const assets = await loadAssets(accountName);
  if (!assets) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to load assets for '${accountName}'`,
    });
  }

  if (!assets[assetName]) {
    throw createError({
      statusCode: 404,
      statusMessage: `Asset '${assetName}' not found in account '${accountName}'`,
    });
  }

  assets[assetName] = body;

  const success = await saveAssets(accountName, assets);
  if (!success) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to save assets for '${accountName}'`,
    });
  }

  return { success: true };
});
