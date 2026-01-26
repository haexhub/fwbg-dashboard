import { readFile, stat, readdir } from "fs/promises";
import { join } from "path";

interface LogResult {
  logs: string[];
  totalLines: number;
  fileSize?: number;
  lastModified?: string;
  error?: string;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const lines = parseInt(query.lines as string) || 100;

  // Logs are in /app/logs (separate volume)
  const logsDir = process.env.LOG_DIR || "/app/logs";

  try {
    // First, try to read bot.log directly (simple format)
    const directLogPath = join(logsDir, "bot.log");
    try {
      const fileStats = await stat(directLogPath);
      const content = await readFile(directLogPath, "utf-8");
      const allLines = content.trim().split("\n").filter(Boolean);
      const lastLines = allLines.slice(-lines);

      return {
        logs: lastLines,
        totalLines: allLines.length,
        fileSize: fileStats.size,
        lastModified: fileStats.mtime.toISOString(),
      };
    } catch {
      // bot.log doesn't exist, try account-based structure
    }

    // Fall back to account-based structure: logs/[accountId]/*.log
    const entries = await readdir(logsDir, { withFileTypes: true });
    const accountDirs = entries.filter((d) => d.isDirectory()).map((d) => d.name);

    if (accountDirs.length === 0) {
      // No subdirectories, try to find any .log file
      const logFiles = entries.filter((f) => f.isFile() && f.name.endsWith(".log"));
      if (logFiles.length > 0 && logFiles[0]) {
        const logPath = join(logsDir, logFiles[0].name);
        const fileStats = await stat(logPath);
        const content = await readFile(logPath, "utf-8");
        const allLines = content.trim().split("\n").filter(Boolean);
        const lastLines = allLines.slice(-lines);

        return {
          logs: lastLines,
          totalLines: allLines.length,
          fileSize: fileStats.size,
          lastModified: fileStats.mtime.toISOString(),
        };
      }
    }

    // Read logs from account subdirectories
    const allLogs: { line: string; timestamp: Date }[] = [];

    for (const accountId of accountDirs) {
      const accountLogDir = join(logsDir, accountId);
      try {
        const files = await readdir(accountLogDir);
        const logFile = files.find((f) => f.endsWith(".log"));

        if (logFile) {
          const logPath = join(accountLogDir, logFile);
          const content = await readFile(logPath, "utf-8");
          const lines = content.trim().split("\n").filter(Boolean);

          for (const line of lines) {
            const timestamp = parseLogTimestamp(line);
            allLogs.push({ line: `[${accountId}] ${line}`, timestamp });
          }
        }
      } catch {
        // Skip this account directory
      }
    }

    // Sort by timestamp and take last N lines
    allLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const lastLines = allLogs.slice(-lines).map((l) => l.line);

    return {
      logs: lastLines,
      totalLines: allLogs.length,
    };
  } catch {
    return {
      logs: [],
      totalLines: 0,
      error: "Could not read log files",
    };
  }
});

function parseLogTimestamp(line: string): Date {
  // Parse timestamp from log line format: "2024-01-23 10:30:45,123 - [INFO] - ..."
  const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
  if (match && match[1]) {
    return new Date(match[1].replace(" ", "T"));
  }
  return new Date(0);
}
