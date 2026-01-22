import { readFile, stat } from "fs/promises";
import { join } from "path";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const lines = parseInt(query.lines as string) || 100;

  const logPath = join(config.dataPath, "bot.log");

  try {
    const fileStats = await stat(logPath);
    const content = await readFile(logPath, "utf-8");

    const allLines = content.trim().split("\n");
    const lastLines = allLines.slice(-lines);

    return {
      logs: lastLines,
      totalLines: allLines.length,
      fileSize: fileStats.size,
      lastModified: fileStats.mtime.toISOString(),
    };
  } catch (error) {
    return {
      logs: [],
      totalLines: 0,
      error: "Could not read log file",
    };
  }
});
