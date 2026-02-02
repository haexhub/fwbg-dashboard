import { writeFile, stat, readdir, unlink } from "fs/promises";
import { join } from "path";

export default defineEventHandler(async () => {
  const logsDir = process.env.LOG_DIR || "/app/logs";
  const deleted: string[] = [];
  const errors: string[] = [];

  try {
    // Try to clear bot.log directly
    const directLogPath = join(logsDir, "bot.log");
    try {
      await stat(directLogPath);
      // Truncate the file instead of deleting (keeps the file for the bot to write to)
      await writeFile(directLogPath, "");
      deleted.push("bot.log");
    } catch {
      // bot.log doesn't exist
    }

    // Also check for account-based log structure
    const entries = await readdir(logsDir, { withFileTypes: true });

    // Delete any other .log files in the root
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".log") && entry.name !== "bot.log") {
        try {
          const logPath = join(logsDir, entry.name);
          await writeFile(logPath, "");
          deleted.push(entry.name);
        } catch (e) {
          errors.push(`${entry.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    // Clear logs in account subdirectories
    const accountDirs = entries.filter((d) => d.isDirectory()).map((d) => d.name);

    for (const accountId of accountDirs) {
      const accountLogDir = join(logsDir, accountId);
      try {
        const files = await readdir(accountLogDir);
        for (const file of files) {
          if (file.endsWith(".log")) {
            const logPath = join(accountLogDir, file);
            await writeFile(logPath, "");
            deleted.push(`${accountId}/${file}`);
          }
        }
      } catch {
        // Skip this account directory
      }
    }

    return {
      success: true,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
      message: deleted.length > 0
        ? `${deleted.length} Log-Datei(en) geleert`
        : "Keine Log-Dateien gefunden",
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to clear logs: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});
