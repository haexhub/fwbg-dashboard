/**
 * Composable for live chart price streaming via WebSocket.
 *
 * Connects to /ws/chart and subscribes to price updates for a given
 * source, symbol, and timeframe. Emits tick events that can be
 * used to update KLineChart in real-time.
 */
export interface ChartTick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function useChartStream() {
  const ws = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const lastTick = ref<ChartTick | null>(null);

  // Callback for tick events
  let onTickCallback: ((tick: ChartTick) => void) | null = null;

  function onTick(cb: (tick: ChartTick) => void) {
    onTickCallback = cb;
  }

  function connect(source: string, symbol: string, timeframe: string) {
    // Close existing connection
    disconnect();

    if (import.meta.server) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chart`;

    ws.value = new WebSocket(wsUrl);

    ws.value.onopen = () => {
      isConnected.value = true;

      // Subscribe to price updates
      ws.value?.send(
        JSON.stringify({
          type: "subscribe",
          source,
          symbol,
          timeframe,
        })
      );
    };

    ws.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "tick" && data.bar) {
          const tick: ChartTick = {
            timestamp: data.bar.timestamp,
            open: data.bar.open,
            high: data.bar.high,
            low: data.bar.low,
            close: data.bar.close,
          };
          lastTick.value = tick;
          onTickCallback?.(tick);
        }
      } catch {
        // Ignore invalid messages
      }
    };

    ws.value.onerror = () => {
      isConnected.value = false;
    };

    ws.value.onclose = () => {
      isConnected.value = false;
    };
  }

  function disconnect() {
    if (ws.value) {
      // Send unsubscribe before closing
      if (ws.value.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({ type: "unsubscribe" }));
      }
      ws.value.close();
      ws.value = null;
    }
    isConnected.value = false;
    lastTick.value = null;
  }

  /**
   * Resubscribe with new parameters (symbol/timeframe changed).
   * Keeps the existing WebSocket connection.
   */
  function resubscribe(source: string, symbol: string, timeframe: string) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(
        JSON.stringify({
          type: "subscribe",
          source,
          symbol,
          timeframe,
        })
      );
    } else {
      connect(source, symbol, timeframe);
    }
  }

  return {
    isConnected: readonly(isConnected),
    lastTick: readonly(lastTick),
    connect,
    disconnect,
    resubscribe,
    onTick,
  };
}
