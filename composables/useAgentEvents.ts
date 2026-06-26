export interface AgentEvent {
  type: string;
  counter?: number;
  ts: string;
  [key: string]: unknown;
}

const MAX_EVENTS = 200;

/**
 * Wraps native EventSource for the fwbg-agents heartbeat stream. GET-only,
 * no auth needed, gets free auto-reconnect from the browser — simpler than
 * a manual fetch-reader loop, which is only needed for streamed POST requests.
 */
export function useAgentEvents() {
  const events = ref<AgentEvent[]>([]);
  const connected = ref(false);
  let source: EventSource | null = null;

  function connect() {
    if (source) return;
    source = new EventSource("/api/agents/events");

    source.addEventListener("open", () => {
      connected.value = true;
    });

    source.addEventListener("error", () => {
      connected.value = false;
    });

    source.addEventListener("heartbeat", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as AgentEvent;
        events.value = [payload, ...events.value].slice(0, MAX_EVENTS);
      } catch {
        // malformed payload — drop it, don't crash the feed
      }
    });
  }

  function disconnect() {
    source?.close();
    source = null;
    connected.value = false;
  }

  return { events, connected, connect, disconnect };
}
