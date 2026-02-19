/**
 * WebSocket /ws/chart — live price streaming for broker chart sources.
 *
 * Client sends: { type: "subscribe", source, symbol, timeframe }
 * Server sends: { type: "tick", bar: { timestamp, open, high, low, close } }
 *
 * Uses /markets/{epic} for live price snapshots — this endpoint does NOT
 * count against the IG historical data allowance. Candle OHLC values are
 * built from successive snapshots within each timeframe period.
 */
import {
  createIGClient,
  SYMBOL_TO_EPIC,
} from "../../utils/ig-client";
import { updateCachedLastBar } from "../../utils/ohlcv-cache";

/** Timeframe → candle duration in milliseconds */
const TIMEFRAME_MS: Record<string, number> = {
  MINUTE_1: 60_000,
  MINUTE_5: 5 * 60_000,
  MINUTE_15: 15 * 60_000,
  MINUTE_30: 30 * 60_000,
  HOUR: 60 * 60_000,
  DAY: 24 * 60 * 60_000,
};

interface CandleState {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Subscription {
  source: string;
  accountId: string;
  symbol: string;
  timeframe: string;
  interval: ReturnType<typeof setInterval>;
  candle: CandleState | null;
}

const subscriptions = new Map<any, Subscription>();

const POLL_INTERVAL = 3000; // 3 seconds

/** Get the candle start timestamp for a given time and timeframe */
function getCandleTimestamp(now: number, timeframeMs: number): number {
  return Math.floor(now / timeframeMs) * timeframeMs;
}

async function fetchAndSend(peer: any, sub: Subscription) {
  const epic = SYMBOL_TO_EPIC[sub.symbol];
  if (!epic) return;

  try {
    const client = await createIGClient(sub.accountId);
    const snapshot = await client.fetchMarketSnapshot(epic);
    const price = snapshot.mid;
    const now = Date.now();
    const tfMs = TIMEFRAME_MS[sub.timeframe] ?? 60 * 60_000;
    const candleTs = getCandleTimestamp(now, tfMs);

    if (!sub.candle || sub.candle.timestamp !== candleTs) {
      // New candle period started
      sub.candle = {
        timestamp: candleTs,
        open: price,
        high: price,
        low: price,
        close: price,
      };
    } else {
      // Update existing candle
      sub.candle.high = Math.max(sub.candle.high, price);
      sub.candle.low = Math.min(sub.candle.low, price);
      sub.candle.close = price;
    }

    const bar = { ...sub.candle };

    // Update server-side cache
    updateCachedLastBar(sub.source, sub.symbol, sub.timeframe, bar);

    peer.send(JSON.stringify({ type: "tick", bar }));
  } catch (error: any) {
    peer.send(JSON.stringify({ type: "error", error: error.message }));
  }
}

function clearSubscription(peer: any) {
  const existing = subscriptions.get(peer);
  if (existing) {
    clearInterval(existing.interval);
    subscriptions.delete(peer);
  }
}

export default defineWebSocketHandler({
  open(peer) {
    console.log("[WS:chart] Client connected:", peer.id);
  },

  message(peer, message) {
    try {
      const data = JSON.parse(message.text());

      if (data.type === "subscribe") {
        // Accept both formats: { source } or legacy { accountId }
        const source: string = data.source || (data.accountId ? `broker:${data.accountId}` : "");
        const { symbol, timeframe } = data;

        if (!source || !symbol || !timeframe) {
          peer.send(JSON.stringify({
            type: "error",
            error: "Missing source, symbol, or timeframe",
          }));
          return;
        }

        if (!source.startsWith("broker:")) {
          peer.send(JSON.stringify({
            type: "error",
            error: "Live streaming only available for broker sources",
          }));
          return;
        }

        const accountId = source.replace("broker:", "");

        if (!SYMBOL_TO_EPIC[symbol]) {
          peer.send(JSON.stringify({
            type: "error",
            error: `Unknown symbol: ${symbol}`,
          }));
          return;
        }

        console.log(`[WS:chart] ${peer.id} subscribed: ${symbol} ${timeframe} (${source})`);

        clearSubscription(peer);

        const sub: Subscription = {
          source,
          accountId,
          symbol,
          timeframe,
          interval: setInterval(() => fetchAndSend(peer, sub), POLL_INTERVAL),
          candle: null,
        };

        subscriptions.set(peer, sub);
        fetchAndSend(peer, sub);
      } else if (data.type === "unsubscribe") {
        clearSubscription(peer);
        console.log(`[WS:chart] ${peer.id} unsubscribed`);
      }
    } catch {
      // Ignore invalid messages
    }
  },

  close(peer) {
    console.log("[WS:chart] Client disconnected:", peer.id);
    clearSubscription(peer);
  },

  error(peer, error) {
    console.error("[WS:chart] Error for client:", peer.id, error);
    clearSubscription(peer);
  },
});
