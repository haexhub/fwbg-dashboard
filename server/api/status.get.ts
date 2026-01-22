import { readFile } from "fs/promises";
import { join } from "path";

interface BotStatus {
  last_heartbeat: string;
  status: string;
  active_pairs_count: number;
  active_epics: string[];
  account_mode: string;
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const statusPath = join(config.dataPath, "stats_export", "bot_status.json");

  try {
    const content = await readFile(statusPath, "utf-8");
    const status: BotStatus = JSON.parse(content);

    // Calculate if bot is alive (heartbeat within last 10 minutes)
    const lastHeartbeat = new Date(status.last_heartbeat);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastHeartbeat.getTime()) / 1000 / 60;
    const isAlive = diffMinutes < 10;

    return {
      ...status,
      isAlive,
      lastHeartbeatAgo: Math.round(diffMinutes),
    };
  } catch (error) {
    return {
      status: "OFFLINE",
      isAlive: false,
      error: "Could not read bot status",
      active_pairs_count: 0,
      active_epics: [],
      account_mode: "unknown",
    };
  }
});
