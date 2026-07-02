export interface AgentEvent {
  type: string;
  ts: string;
  [key: string]: unknown;
}

export interface AgentRunStartedEvent extends AgentEvent {
  type: "agent_run_started";
  agent_run_id: number;
  agent_name: string;
}

export interface ResearchSearchEvent extends AgentEvent {
  type: "research_search";
  agent_run_id: number;
  query: string;
}

export interface ResearchResultsEvent extends AgentEvent {
  type: "research_results";
  agent_run_id: number;
  query: string;
  urls: { url: string; title: string }[];
}

export interface AgentRunDoneEvent extends AgentEvent {
  type: "agent_run_done";
  agent_run_id: number;
  agent_name: string;
}

export interface AgentRunFailedEvent extends AgentEvent {
  type: "agent_run_failed";
  agent_run_id: number;
  agent_name: string;
  error: string;
}

const MAX_EVENTS = 200;

/**
 * Wraps native EventSource for the fwbg-agents event stream.
 * All events arrive as unnamed SSE messages (no named event type),
 * so we use `onmessage` as a single catch-all handler.
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

    source.onmessage = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as AgentEvent;
        events.value = [payload, ...events.value].slice(0, MAX_EVENTS);
      } catch {
        // malformed payload — drop
      }
    };
  }

  function disconnect() {
    source?.close();
    source = null;
    connected.value = false;
  }

  return { events, connected, connect, disconnect };
}
