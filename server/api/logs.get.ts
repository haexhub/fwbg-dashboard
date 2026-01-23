import { readFile, stat, readdir } from "fs/promises";
import { join } from "path";

interface LogResult {
  logs: string[];
  totalLines: number;
  fileSize?: number;
  lastModified?: string;
  error?: string;
  accountId?: string;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const lines = parseInt(query.lines as string) || 100;
  const accountId = query.accountId as string | undefined;

  const logsDir = join(config.dataPath, "logs");

  // If specific account requested, return logs for that account
  if (accountId) {
    return await getAccountLogs(logsDir, accountId, lines);
  }

  // Otherwise, return combined logs from all accounts
  try {
    const accountDirs = await readdir(logsDir, { withFileTypes: true });
    const accountIds = accountDirs
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const allLogs: { line: string; timestamp: Date; accountId: string }[] = [];

    for (const accId of accountIds) {
      const result = await getAccountLogs(logsDir, accId, 1000);
      if (result.logs.length > 0) {
        for (const line of result.logs) {
          const timestamp = parseLogTimestamp(line);
          allLogs.push({ line: `[${accId}] ${line}`, timestamp, accountId: accId });
        }
      }
    }

    // Sort by timestamp descending and take last N lines
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

async function getAccountLogs(
  logsDir: string,
  accountId: string,
  lines: number
): Promise<LogResult> {
  const accountLogDir = join(logsDir, accountId);

  try {
    const files = await readdir(accountLogDir);
    const logFile = files.find((f) => f.endsWith(".log"));

    if (!logFile) {
      return { logs: [], totalLines: 0, accountId };
    }

    const logPath = join(accountLogDir, logFile);
    const fileStats = await stat(logPath);
    const content = await readFile(logPath, "utf-8");

    const allLines = content.trim().split("\n").filter(Boolean);
    const lastLines = allLines.slice(-lines);

    return {
      logs: lastLines,
      totalLines: allLines.length,
      fileSize: fileStats.size,
      lastModified: fileStats.mtime.toISOString(),
      accountId,
    };
  } catch {
    return {
      logs: [],
      totalLines: 0,
      error: `Could not read logs for account ${accountId}`,
      accountId,
    };
  }
}

function parseLogTimestamp(line: string): Date {
  // Parse timestamp from log line format: "2024-01-23 10:30:45,123 - INFO - ..."
  const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
  if (match && match[1]) {
    return new Date(match[1].replace(" ", "T"));
  }
  return new Date(0);
}
