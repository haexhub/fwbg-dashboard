import { accountExists, loadAssets, saveAssets } from "~/server/utils/settings";
import type { AssetsConfig } from "~/server/utils/settings-types";

/**
 * POST /api/settings/[account]/assets/bulk
 * Bulk import assets from JSON
 *
 * Body: { assets: AssetsConfig, mode: "merge" | "replace" }
 * - merge: Add new assets, update existing ones
 * - replace: Replace all assets with the provided ones
 */
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

  const body = await readBody<{
    assets: AssetsConfig;
    mode?: "merge" | "replace";
  }>(event);

  if (!body.assets || typeof body.assets !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid assets format. Expected an object with asset configurations.",
    });
  }

  const mode = body.mode || "merge";

  try {
    let finalAssets: AssetsConfig;

    if (mode === "replace") {
      // Replace all assets
      finalAssets = body.assets;
    } else {
      // Merge with existing assets
      const existingAssets = await loadAssets(accountName);
      finalAssets = {
        ...(existingAssets || {}),
        ...body.assets,
      };
    }

    // Validate asset structure
    const importedCount = Object.keys(body.assets).length;
    const errors: string[] = [];

    for (const [assetName, config] of Object.entries(body.assets)) {
      if (!config || typeof config !== "object") {
        errors.push(`${assetName}: Invalid config format`);
        continue;
      }

      // Check required fields and set defaults
      if (typeof config.kelly_risk !== "number") {
        config.kelly_risk = 0.02;
      }
      if (typeof config.point_value !== "number") {
        config.point_value = 1.0;
      }
      if (typeof config.spread !== "number") {
        config.spread = 1.0;
      }
      if (typeof config.tp_mult !== "number") {
        config.tp_mult = 50;
      }
      if (typeof config.sl_mult !== "number") {
        config.sl_mult = 50;
      }
      if (typeof config.conf_thresh !== "number") {
        config.conf_thresh = 0.55;
      }
      if (!Array.isArray(config.features)) {
        config.features = [];
      }
      if (!Array.isArray(config.good_hours)) {
        config.good_hours = Array.from({ length: 24 }, (_, i) => i);
      }
      if (!Array.isArray(config.ensemble)) {
        config.ensemble = [];
      }
      if (!config.dd_scaling || typeof config.dd_scaling !== "object") {
        config.dd_scaling = { "10": 0.5, "20": 0.25 };
      }
    }

    const saved = await saveAssets(accountName, finalAssets);

    if (!saved) {
      throw new Error("Failed to save assets");
    }

    return {
      success: true,
      mode,
      imported: importedCount,
      total: Object.keys(finalAssets).length,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to import assets: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});
