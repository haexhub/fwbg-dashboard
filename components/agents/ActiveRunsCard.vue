<script setup lang="ts">
import type {
  ResearchResultsEvent,
  ResearchSearchEvent,
} from "~/composables/useAgentEvents";
import type { AgentRun, AgentConfigListResponse } from "~/types/agents";
import { agentRunStatusColor } from "~/types/agents";

interface ResearchProgress {
  queries: string[];
  urls: { url: string; title: string }[];
}

const POLL_INTERVAL_MS = 5_000;

const activeRuns = ref<AgentRun[]>([]);
const recentFailed = ref<AgentRun[]>([]);

const researchProgress = ref<Record<number, ResearchProgress>>({});

function ensureProgress(runId: number): ResearchProgress {
  if (!researchProgress.value[runId]) {
    researchProgress.value[runId] = { queries: [], urls: [] };
  }
  return researchProgress.value[runId];
}

function applyEvent(event: { type: string; [key: string]: unknown }) {
  if (event.type === "research_search") {
    const e = event as ResearchSearchEvent;
    const p = ensureProgress(e.agent_run_id);
    if (!p.queries.includes(e.query)) p.queries.push(e.query);
  } else if (event.type === "research_results") {
    const e = event as ResearchResultsEvent;
    const p = ensureProgress(e.agent_run_id);
    for (const u of e.urls) {
      if (!p.urls.find((x) => x.url === u.url)) p.urls.push(u);
    }
  } else if (event.type === "agent_run_done" || event.type === "agent_run_failed") {
    fetchRuns();
  }
}

const { events, connected, connect, disconnect } = useAgentEvents();

// flush:'sync' ensures each SSE message is handled immediately even when
// multiple arrive in the same Vue scheduler tick (researcher fan-out).
watch(() => events.value[0], (event) => { if (event) applyEvent(event); }, { flush: "sync" });

// Aggregate progress across all active researcher sub-runs, used for the
// research_flow parent row which has no events of its own.
const researchFlowProgress = computed<ResearchProgress>(() => {
  const queries: string[] = [];
  const urls: { url: string; title: string }[] = [];
  for (const run of activeRuns.value) {
    if ((run.agent_name as string) !== "researcher") continue;
    const p = researchProgress.value[run.id];
    if (!p) continue;
    for (const q of p.queries) if (!queries.includes(q)) queries.push(q);
    for (const u of p.urls) if (!urls.find((x) => x.url === u.url)) urls.push(u);
  }
  return { queries, urls };
});

// Backfill stored events for researcher runs that were already in progress
// when the page loaded. Silently no-ops until fwbg-agents exposes the endpoint.
const backfilledRunIds = new Set<number>();

async function backfillRunEvents(runId: number) {
  if (backfilledRunIds.has(runId)) return;
  backfilledRunIds.add(runId);
  try {
    const stored = await $fetch<Array<{ type: string; query?: string; urls?: { url: string; title: string }[] }>>(
      `/api/agents/runs/${runId}/events`
    );
    for (const e of stored) applyEvent(e as { type: string; [key: string]: unknown });
  } catch {
    // endpoint not yet available — silently ignore
  }
}

async function fetchRuns() {
  try {
    const [active, failed] = await Promise.all([
      $fetch<{ runs: AgentRun[] }>("/api/agents/runs", {
        query: { status: "pending,running", limit: 20 },
      }),
      $fetch<{ runs: AgentRun[] }>("/api/agents/runs", {
        query: { status: "failed,cancelled", limit: 5 },
      }),
    ]);
    activeRuns.value = active.runs;
    recentFailed.value = failed.runs.filter(
      (r) => r.agent_name === "research_flow"
    );
    for (const run of active.runs) {
      if ((run.agent_name as string) === "researcher" && run.status === "running") {
        backfillRunEvents(run.id);
      }
    }
  } catch {
    // silently ignore — runs card is non-critical
  }
}

onMounted(() => {
  fetchRuns();
  fetchAgentConfig();
  connect();
  const timer = setInterval(fetchRuns, POLL_INTERVAL_MS);
  onUnmounted(() => {
    clearInterval(timer);
    disconnect();
  });
});

function progressFor(run: AgentRun): ResearchProgress | undefined {
  return (run.agent_name as string) === "researcher"
    ? researchProgress.value[run.id]
    : researchFlowProgress.value;
}

function relativeTime(ts: string | null): string {
  if (!ts) return "—";
  const diffSec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diffSec < 5) return "gerade eben";
  if (diffSec < 60) return `vor ${diffSec}s`;
  return `vor ${Math.floor(diffSec / 60)}m`;
}

const AGENT_LABELS: Record<string, string> = {
  research_flow: "Research",
  researcher: "Researcher",
  runner: "Runner",
  analyst: "Analyst",
  paper_analyst: "Paper-Analyst",
  promote_live: "Promote Live",
  reiterate: "Reiterate",
};

const actionLoading = ref<Record<number, boolean>>({});

// Model info per configurable agent type, fetched once on mount
const agentModelMap = ref<Record<string, string>>({});

function shortModelName(model: string): string {
  return model.replace(/^claude-/, "").replace(/-\d{8}$/, "");
}

async function fetchAgentConfig() {
  try {
    const config = await $fetch<AgentConfigListResponse>("/api/agents/config");
    agentModelMap.value = Object.fromEntries(config.agents.map((a) => [a.name, a.model]));
  } catch {
    // non-critical, silently ignore
  }
}

async function cancelRun(run: AgentRun) {
  actionLoading.value[run.id] = true;
  try {
    await $fetch(`/api/agents/runs/${run.id}/cancel`, { method: "POST" });
    await fetchRuns();
  } catch (e) {
    console.error("cancel failed", e);
  } finally {
    actionLoading.value[run.id] = false;
  }
}

async function retryRun(run: AgentRun) {
  actionLoading.value[run.id] = true;
  try {
    await $fetch(`/api/agents/runs/${run.id}/retry`, { method: "POST" });
    await fetchRuns();
  } catch (e) {
    console.error("retry failed", e);
  } finally {
    actionLoading.value[run.id] = false;
  }
}

const allEmpty = computed(
  () => activeRuns.value.length === 0 && recentFailed.value.length === 0
);

function progressFor(run: AgentRun): ResearchProgress | undefined {
  return (run.agent_name as string) === "researcher"
    ? researchProgress.value[run.id]
    : researchFlowProgress.value;
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-400">Laufende Agents</h3>
        <UBadge :color="connected ? 'success' : 'error'" variant="subtle" size="xs">
          {{ connected ? "Live" : "Getrennt" }}
        </UBadge>
      </div>
    </template>

    <div v-if="allEmpty" class="py-8 text-center text-gray-500 text-sm">
      Keine laufenden Agents.
    </div>

    <div v-else class="space-y-4">
      <!-- Active runs (pending / running) -->
      <div
        v-for="run in activeRuns"
        :key="run.id"
        class="rounded-lg border border-gray-800 p-3 space-y-2"
      >
        <!-- Run header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 flex-wrap">
            <span
              v-if="run.status === 'running'"
              class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
            />
            <span v-else class="h-2 w-2 rounded-full bg-gray-600 shrink-0" />
            <span class="text-sm font-medium text-white">
              {{ AGENT_LABELS[run.agent_name] ?? run.agent_name }}
            </span>
            <span class="text-xs text-gray-500">#{{ run.id }}</span>
            <UBadge
              v-if="agentModelMap[run.agent_name]"
              color="neutral"
              variant="outline"
              size="xs"
              class="font-mono"
            >
              {{ shortModelName(agentModelMap[run.agent_name] ?? "") }}
            </UBadge>
          </div>
          <div class="flex items-center gap-2">
            <UBadge :color="agentRunStatusColor(run.status)" variant="subtle" size="xs">
              {{ run.status }}
            </UBadge>
            <UButton
              v-if="run.agent_name === 'research_flow'"
              size="xs"
              color="error"
              variant="ghost"
              :loading="actionLoading[run.id]"
              @click="cancelRun(run)"
            >
              Abbrechen
            </UButton>
          </div>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <p class="text-xs text-gray-500">gestartet {{ relativeTime(run.started_at) }}</p>
          <span v-if="run.strategy_id" class="text-xs text-gray-600">Strategie #{{ run.strategy_id }}</span>
          <span v-if="run.plugin_id" class="text-xs text-gray-600">Plugin #{{ run.plugin_id }}</span>
        </div>

        <!-- Research progress (researcher: per-run; research_flow: aggregate) -->
        <template v-if="(run.agent_name as string) === 'researcher' || (run.agent_name as string) === 'research_flow'">
          <div class="space-y-2 pt-1">
            <p v-if="(run.agent_name as string) === 'research_flow'" class="text-xs text-gray-500">
              {{ activeRuns.filter(r => (r.agent_name as string) === 'researcher').length }} Researcher aktiv
            </p>

            <div v-if="progressFor(run)?.queries.length" class="space-y-1">
              <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">Suchen</p>
              <div class="space-y-1">
                <div
                  v-for="q in progressFor(run)!.queries"
                  :key="q"
                  class="flex items-center gap-2 text-xs"
                >
                  <span class="text-gray-400 font-mono truncate">{{ q }}</span>
                </div>
              </div>
            </div>

            <div v-if="progressFor(run)?.urls.length" class="space-y-1">
              <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Quellen ({{ progressFor(run)!.urls.length }})
              </p>
              <div class="space-y-1 max-h-40 overflow-y-auto">
                <a
                  v-for="u in progressFor(run)!.urls"
                  :key="u.url"
                  :href="u.url"
                  target="_blank"
                  rel="noopener"
                  class="block text-xs text-blue-400 hover:text-blue-300 truncate"
                  :title="u.url"
                >
                  {{ u.title || u.url }}
                </a>
              </div>
            </div>

            <p
              v-if="!progressFor(run)?.queries.length"
              class="text-xs text-gray-600 italic"
            >
              Warte auf erste Suche...
            </p>
          </div>
        </template>
      </div>

      <!-- Recent failed research runs -->
      <template v-if="recentFailed.length">
        <p class="text-xs text-gray-600 font-medium uppercase tracking-wide pt-1">
          Fehlgeschlagen / Abgebrochen
        </p>
        <div
          v-for="run in recentFailed"
          :key="`failed-${run.id}`"
          class="rounded-lg border border-gray-800 p-3 space-y-2"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-red-500" />
              <span class="text-sm font-medium text-white">
                {{ AGENT_LABELS[run.agent_name] ?? run.agent_name }}
              </span>
              <span class="text-xs text-gray-500">#{{ run.id }}</span>
            </div>
            <div class="flex items-center gap-2">
              <UBadge :color="agentRunStatusColor(run.status)" variant="subtle" size="xs">
                {{ run.status }}
              </UBadge>
              <UButton
                size="xs"
                color="primary"
                variant="ghost"
                :loading="actionLoading[run.id]"
                @click="retryRun(run)"
              >
                Wiederholen
              </UButton>
            </div>
          </div>
          <p class="text-xs text-gray-500">
            {{ relativeTime(run.ended_at) }} · {{ run.error ?? "Unbekannter Fehler" }}
          </p>
        </div>
      </template>
    </div>
  </UCard>
</template>
