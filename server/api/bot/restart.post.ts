import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

export default defineEventHandler(async () => {
  // The restart signal file path - must match STATS_DIR in the bot
  const statsDir = process.env.DATA_PATH
    ? join(process.env.DATA_PATH, "stats_export")
    : "stats_export";

  const restartFile = join(statsDir, "restart_signal");

  try {
    // Ensure directory exists
    await mkdir(dirname(restartFile), { recursive: true });

    // Write the restart signal file
    await writeFile(restartFile, new Date().toISOString());

    return {
      success: true,
      message: "Restart signal sent. Bot will restart within 5 minutes.",
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to send restart signal: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});
