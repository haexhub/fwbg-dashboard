import type { AgentRun } from "~/types/agents";

/** Matches the backend's RUNNER_POLL_INTERVAL_SECONDS default. */
const POLL_INTERVAL_MS = 5_000;

/**
 * Composable for polling fwbg-agents AgentRun rows. Shared by every
 * action button (Run/Analyze/Paper-Analyze/Promote) to watch a 202-scheduled
 * job through to completion.
 */
export function useAgentRuns() {
  async function getRun(id: number): Promise<AgentRun> {
    return $fetch<AgentRun>(`/api/agents/runs/${id}`);
  }

  function pollRun(
    id: number,
    onUpdate?: (run: AgentRun) => void
  ): { promise: Promise<AgentRun>; cancel: () => void } {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const promise = new Promise<AgentRun>((resolve, reject) => {
      async function tick() {
        if (cancelled) return;
        try {
          const run = await getRun(id);
          if (cancelled) return;
          onUpdate?.(run);
          if (run.status === "done" || run.status === "failed") {
            resolve(run);
            return;
          }
          timer = setTimeout(tick, POLL_INTERVAL_MS);
        } catch (e) {
          if (!cancelled) reject(e);
        }
      }
      tick();
    });

    function cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
    }

    return { promise, cancel };
  }

  return { getRun, pollRun };
}
