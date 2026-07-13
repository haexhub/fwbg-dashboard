<script setup lang="ts">
import RunTimeline from "~/components/agents/run/RunTimeline.vue";
import RunTranscript from "~/components/agents/run/RunTranscript.vue";
import type { AgentRunDetail, AgentRunEvent, ArtifactContent } from "~/types/agents";
import { agentLabel, agentRunStatusColor } from "~/types/agents";

const route = useRoute();
const runId = computed(() => Number(route.params.id));

const detail = ref<AgentRunDetail | null>(null);
const loadError = ref<string | null>(null);
const actionLoading = ref(false);

const activeTab = ref("timeline");

// ── Timeline: backfill + live, deduped by per-run seq ──────────────────────
const timeline = ref<AgentRunEvent[]>([]);
const seenSeq = new Set<number>();

function ingest(e: AgentRunEvent) {
  if (typeof e.agent_run_id === "number" && e.agent_run_id !== runId.value) return;
  if (typeof e.seq !== "number" || seenSeq.has(e.seq)) return;
  seenSeq.add(e.seq);
  timeline.value.push(e);
  timeline.value.sort((a, b) => a.seq - b.seq);
}

async function fetchDetail() {
  try {
    detail.value = await $fetch<AgentRunDetail>(`/api/agents/runs/${runId.value}`);
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) {
      await navigateTo("/agents", { replace: true });
    } else {
      loadError.value = "Run konnte nicht geladen werden.";
    }
  }
}

async function backfill() {
  try {
    const stored = await $fetch<AgentRunEvent[]>(`/api/agents/runs/${runId.value}/events`);
    for (const e of stored) ingest(e);
  } catch {
    // no events endpoint / empty — fine
  }
}

const { events, connected, connect, disconnect } = useAgentEvents();
watch(
  () => events.value[0],
  (e) => {
    if (!e) return;
    const evt = e as unknown as AgentRunEvent;
    ingest(evt);
    // A terminal event for this run → refresh the detail row (status, tokens,
    // transcript index) without a manual reload.
    if (
      (evt.type === "agent_run_done" ||
        evt.type === "agent_run_failed" ||
        evt.type === "llm_round_done") &&
      evt.agent_run_id === runId.value
    ) {
      fetchDetail();
    }
  },
  { flush: "sync" }
);

onMounted(async () => {
  await Promise.all([fetchDetail(), backfill()]);
  connect();
});
onUnmounted(() => disconnect());

// ── Derived ────────────────────────────────────────────────────────────────
const isRunner = computed(() => detail.value?.agent_name === "runner");
const isRunning = computed(
  () => detail.value?.status === "running" || detail.value?.status === "pending"
);
const canRetry = computed(
  () => detail.value?.status === "failed" && detail.value?.agent_name === "research_flow"
);

const fwbgRunId = computed<string | null>(() => {
  const ev = timeline.value.find((e) => typeof e.fwbg_run_id === "string" && e.fwbg_run_id);
  return ev ? (ev.fwbg_run_id as string) : null;
});

function durationText(): string {
  const d = detail.value;
  if (!d?.started_at) return "—";
  const end = d.ended_at ? new Date(d.ended_at).getTime() : Date.now();
  const sec = Math.round((end - new Date(d.started_at).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

// ── Artifacts ──────────────────────────────────────────────────────────────
const artifacts = ref<Record<string, ArtifactContent | { error: string } | null>>({});

async function loadArtifact(kind: "input" | "output") {
  artifacts.value[kind] = null;
  try {
    artifacts.value[kind] = await $fetch<ArtifactContent>(
      `/api/agents/runs/${runId.value}/artifact`,
      { query: { kind } }
    );
  } catch {
    artifacts.value[kind] = { error: "Artefakt nicht ladbar." };
  }
}

watch(activeTab, (tab) => {
  if (tab === "artifacts" && detail.value) {
    for (const a of detail.value.artifacts) {
      if (a.exists && !(a.kind in artifacts.value)) loadArtifact(a.kind);
    }
  }
});

// ── Actions ────────────────────────────────────────────────────────────────
async function cancelRun() {
  actionLoading.value = true;
  try {
    await $fetch(`/api/agents/runs/${runId.value}/cancel`, { method: "POST" });
    await fetchDetail();
  } finally {
    actionLoading.value = false;
  }
}
async function retryRun() {
  actionLoading.value = true;
  try {
    await $fetch(`/api/agents/runs/${runId.value}/retry`, { method: "POST" });
    await fetchDetail();
  } finally {
    actionLoading.value = false;
  }
}

const tabs = computed(() => {
  const t = [{ label: "Timeline", value: "timeline" }];
  if (!isRunner.value) t.push({ label: "LLM-Session", value: "session" });
  t.push({ label: "Artefakte", value: "artifacts" });
  return t;
});

useHead({ title: () => `Agent-Run #${runId.value}` });
</script>

<template>
  <div class="mx-auto max-w-4xl p-4 space-y-4">
    <NuxtLink to="/agents" class="text-xs text-gray-500 hover:text-gray-300">← Agents</NuxtLink>

    <div v-if="loadError" class="py-12 text-center text-red-400">{{ loadError }}</div>

    <template v-else-if="detail">
      <!-- Header -->
      <UCard>
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-lg font-semibold text-white">{{ agentLabel(detail.agent_name) }}</h1>
              <span class="text-sm text-gray-500">#{{ detail.id }}</span>
              <UBadge :color="agentRunStatusColor(detail.status)" variant="subtle" size="xs">
                {{ detail.status }}
              </UBadge>
              <span
                v-if="connected"
                class="text-xs text-emerald-400"
                title="Live-Verbindung aktiv"
              >● live</span>
            </div>
            <div class="flex items-center gap-3 flex-wrap text-xs text-gray-500">
              <NuxtLink
                v-if="detail.strategy_id"
                :to="`/agents/strategies/${detail.strategy_id}`"
                class="hover:text-gray-300"
              >Strategie #{{ detail.strategy_id }}</NuxtLink>
              <NuxtLink
                v-if="detail.plugin_id"
                :to="`/agents/plugins/${detail.plugin_id}`"
                class="hover:text-gray-300"
              >Plugin #{{ detail.plugin_id }}</NuxtLink>
              <NuxtLink
                v-if="detail.parent_run_id"
                :to="`/agents/runs/${detail.parent_run_id}`"
                class="hover:text-gray-300"
              >↑ Flow-Run #{{ detail.parent_run_id }}</NuxtLink>
              <span>Dauer {{ durationText() }}</span>
              <span v-if="detail.total_input_tokens || detail.total_output_tokens">
                {{ detail.total_input_tokens }}→{{ detail.total_output_tokens }} Tokens
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              v-if="isRunning"
              size="xs"
              color="error"
              variant="ghost"
              :loading="actionLoading"
              @click="cancelRun"
            >Abbrechen</UButton>
            <UButton
              v-if="canRetry"
              size="xs"
              color="primary"
              variant="ghost"
              :loading="actionLoading"
              @click="retryRun"
            >Wiederholen</UButton>
          </div>
        </div>

        <p v-if="detail.error" class="mt-2 text-xs text-red-400 break-all">{{ detail.error }}</p>

        <!-- Runner: prominent jump to the backtest run overview -->
        <div v-if="isRunner" class="mt-3">
          <UButton
            :to="fwbgRunId ? `/runs/${fwbgRunId}` : '/runs'"
            size="sm"
            color="primary"
            variant="soft"
          >
            Zur Backtest-Übersicht{{ fwbgRunId ? ` (${fwbgRunId})` : "" }}
          </UButton>
        </div>
      </UCard>

      <!-- Kind-Runs (Flow drill-down) -->
      <UCard v-if="detail.children.length">
        <p class="mb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
          Kind-Runs
        </p>
        <div class="space-y-1">
          <NuxtLink
            v-for="child in detail.children"
            :key="child.id"
            :to="`/agents/runs/${child.id}`"
            class="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
          >
            <span class="text-gray-500">#{{ child.id }}</span>
            <span>{{ agentLabel(child.agent_name) }}</span>
            <UBadge :color="agentRunStatusColor(child.status)" variant="subtle" size="xs">
              {{ child.status }}
            </UBadge>
          </NuxtLink>
        </div>
      </UCard>

      <UTabs v-model="activeTab" :items="tabs" />

      <!-- Timeline -->
      <div v-if="activeTab === 'timeline'">
        <RunTimeline :events="timeline" />
      </div>

      <!-- LLM-Session -->
      <div v-else-if="activeTab === 'session'">
        <p v-if="isRunning" class="mb-2 text-xs text-gray-500 italic">
          Session läuft — die Timeline zeigt die Live-Aktivität; das Transkript aktualisiert
          sich nach jeder Runde.
        </p>
        <RunTranscript :run-id="runId" :transcripts="detail.transcripts" />
      </div>

      <!-- Artefakte -->
      <div v-else-if="activeTab === 'artifacts'" class="space-y-3">
        <div v-for="a in detail.artifacts" :key="a.kind" class="space-y-1">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {{ a.kind }}<span v-if="a.path" class="ml-2 font-normal normal-case text-gray-600 break-all">{{ a.path }}</span>
          </p>
          <p v-if="!a.exists" class="text-xs text-gray-600 italic">Kein {{ a.kind }}-Artefakt.</p>
          <template v-else>
            <p v-if="artifacts[a.kind] === null" class="text-xs text-gray-500">Lade…</p>
            <p
              v-else-if="artifacts[a.kind] && 'error' in (artifacts[a.kind] as object)"
              class="text-xs text-red-400"
            >{{ (artifacts[a.kind] as { error: string }).error }}</p>
            <pre
              v-else-if="artifacts[a.kind]"
              class="overflow-x-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-xs text-gray-300"
            >{{ (artifacts[a.kind] as ArtifactContent).content }}</pre>
          </template>
        </div>
      </div>
    </template>

    <div v-else class="py-12 text-center text-gray-500 text-sm">Lade Run…</div>
  </div>
</template>
