<script setup lang="ts">
import type {
  ResearchResultsEvent,
  ResearchSearchEvent,
} from "~/composables/useAgentEvents";
import type { AgentRun } from "~/types/agents";
import { agentRunStatusColor } from "~/types/agents";

interface ResearchProgress {
  queries: string[];
  urls: { url: string; title: string }[];
}

const POLL_INTERVAL_MS = 5_000;

const activeRuns = ref<AgentRun[]>([]);
const recentFailed = ref<AgentRun[]>([]);

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
  } catch {
    // silently ignore — runs card is non-critical
  }
}

const researchProgress = ref<Record<number, ResearchProgress>>({});

function ensureProgress(runId: number): ResearchProgress {
  if (!researchProgress.value[runId]) {
    researchProgress.value[runId] = { queries: [], urls: [] };
  }
  return researchProgress.value[runId];
}

const { events, connected, connect, disconnect } = useAgentEvents();

watch(
  () => events.value[0],
  (event) => {
    if (!event) return;
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
);

onMounted(() => {
  fetchRuns();
  connect();
  const timer = setInterval(fetchRuns, POLL_INTERVAL_MS);
  onUnmounted(() => {
    clearInterval(timer);
    disconnect();
  });
});

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
          <div class="flex items-center gap-2">
            <span
              v-if="run.status === 'running'"
              class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"
            />
            <span v-else class="h-2 w-2 rounded-full bg-gray-600" />
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

        <p class="text-xs text-gray-500">
          gestartet {{ relativeTime(run.started_at) }}
        </p>

        <!-- Research progress (for researcher runs) -->
        <template v-if="(run.agent_name as string) === 'researcher'">
          <div class="space-y-2 pt-1">
            <div v-if="researchProgress[run.id]?.queries.length" class="space-y-1">
              <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">Suchen</p>
              <div class="space-y-1">
                <div
                  v-for="q in researchProgress[run.id]?.queries"
                  :key="q"
                  class="flex items-center gap-2 text-xs"
                >
                  <span class="text-gray-400 font-mono truncate">{{ q }}</span>
                </div>
              </div>
            </div>

            <div v-if="researchProgress[run.id]?.urls.length" class="space-y-1">
              <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Quellen ({{ researchProgress[run.id]?.urls.length }})
              </p>
              <div class="space-y-1 max-h-40 overflow-y-auto">
                <a
                  v-for="u in researchProgress[run.id]?.urls"
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
              v-if="!researchProgress[run.id]?.queries.length"
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
