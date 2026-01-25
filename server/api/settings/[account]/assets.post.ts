import { loadAssets, saveAssets, accountExists } from "~/server/utils/settings";
import type { AssetConfig } from "~/server/utils/settings-types";

interface AddAssetBody {
  name: string;
  config: AssetConfig;
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

  const body = await readBody<AddAssetBody>(event);

  if (!body || !body.name || !body.config) {
    throw createError({
      statusCode: 400,
      statusMessage: "Asset name and config are required",
    });
  }

  const assets = await loadAssets(accountName);
  if (!assets) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to load assets for '${accountName}'`,
    });
  }

  if (assets[body.name]) {
    throw createError({
      statusCode: 409,
      statusMessage: `Asset '${body.name}' already exists`,
    });
  }

  assets[body.name] = body.config;

  const success = await saveAssets(accountName, assets);
  if (!success) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to save assets for '${accountName}'`,
    });
  }

  return { success: true, assetName: body.name };
});
