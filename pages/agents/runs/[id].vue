<script setup lang="ts">
import RunTimeline from "~/components/agents/run/RunTimeline.vue";
import RunTranscript from "~/components/agents/run/RunTranscript.vue";
import RunReasoning from "~/components/agents/run/RunReasoning.vue";
import type {
  AgentRunDetail,
  AgentRunEvent,
  ArtifactContent,
  TranscriptRound,
} from "~/types/agents";
import { agentLabel, agentRunStatusColor } from "~/types/agents";

const route = useRoute();
const runId = computed(() => Number(route.params.id));

const detail = ref<AgentRunDetail | null>(null);
const loadError = ref<string | null>(null);
const actionLoading = ref(false);

const activeTab = ref("timeline");

// ── Flow subtree: which run ids belong to this envelope + their agent names ──
// The envelope view aggregates the whole flow (research_flow → researcher /
// critic / translator, plugin_author_flow → planner / implementer, …). We keep
// the id set to filter the global SSE stream and the name map to tag events.
const allowedIds = ref<Set<number>>(new Set());
const runNames = ref<Map<number, string>>(new Map());

function rebuildRunIndex() {
  const ids = new Set<number>([runId.value]);
  const names = new Map<number, string>();
  const d = detail.value;
  if (d) {
    names.set(d.id, d.agent_name);
    for (const desc of d.descendants ?? []) {
      ids.add(desc.id);
      names.set(desc.id, desc.agent_name);
    }
  }
  allowedIds.value = ids;
  runNames.value = names;
}

// ── Timeline: backfill + live, deduped by (run, seq) ─────────────────────────
// seq restarts at 0 per run, so a global seq set would collide across the flow's
// children — dedupe on `${run}:${seq}` instead.
const timeline = ref<AgentRunEvent[]>([]);
const seen = new Set<string>();
const lastActiveChildId = ref<number | null>(null);
// Cap the timeline for long-running flows (mirrors useAgentEvents' MAX_EVENTS).
const MAX_TIMELINE = 200;

function eventOrder(a: AgentRunEvent, b: AgentRunEvent) {
  return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.seq - b.seq;
}

// Live reasoning token stream (llm_delta — live-only, never persisted), keyed
// by `${run}:${round}`. Feeds the reasoning panel, not the timeline.
interface ReasoningBuf {
  runId: number;
  round: number;
  thinking: string;
  text: string;
}
const reasoning = ref<Map<string, ReasoningBuf>>(new Map());

function applyDelta(src: number, e: AgentRunEvent) {
  const round = typeof e.round === "number" ? e.round : 1;
  const kind = e.kind === "thinking" ? "thinking" : "text";
  const k = `${src}:${round}`;
  const m = new Map(reasoning.value);
  const cur = m.get(k) ?? { runId: src, round, thinking: "", text: "" };
  m.set(k, { ...cur, [kind]: cur[kind] + String(e.text ?? "") });
  reasoning.value = m;
}

function clearReasoning(src: number, round: number) {
  const k = `${src}:${round}`;
  if (!reasoning.value.has(k)) return;
  const m = new Map(reasoning.value);
  m.delete(k);
  reasoning.value = m;
}

function ingest(e: AgentRunEvent) {
  const src = typeof e.agent_run_id === "number" ? e.agent_run_id : null;
  // Drop events without a run id (heartbeats) and events from runs outside this
  // flow's subtree. A never-seen run *starting* under us → resync descendants.
  if (src === null) return;
  if (!allowedIds.value.has(src)) {
    if (e.type === "agent_run_started") scheduleDescendantSync();
    return;
  }
  // Live-only reasoning deltas feed the reasoning panel, not the timeline.
  if (e.type === "llm_delta") {
    applyDelta(src, e);
    if (src !== runId.value) lastActiveChildId.value = src;
    return;
  }
  if (typeof e.seq !== "number") return;
  const k = `${src}:${e.seq}`;
  if (seen.has(k)) return;
  seen.add(k);
  if (!e.agent_name && runNames.value.has(src)) e.agent_name = runNames.value.get(src);
  // Ordered insertion — events arrive close to time-order per source, so scan
  // from the tail rather than re-sorting the whole array on every push.
  const arr = timeline.value;
  let i = arr.length;
  for (let prev = arr[i - 1]; prev && eventOrder(prev, e) > 0; prev = arr[i - 1]) i--;
  arr.splice(i, 0, e);
  if (arr.length > MAX_TIMELINE) {
    const dropped = arr.shift();
    if (dropped) seen.delete(`${dropped.agent_run_id}:${dropped.seq}`);
  }
  // Track the active child so the LLM-session tab + header follow it.
  if (
    src !== runId.value &&
    (e.type === "llm_tool_call" ||
      e.type === "llm_round_done" ||
      e.type === "agent_run_started" ||
      e.type === "hypothesis_ready")
  ) {
    lastActiveChildId.value = src;
  }
}

// A child we didn't yet know about started → refetch our detail (server derives
// the subtree from parent_run_id) and re-backfill so events emitted before we
// learned the child aren't lost. Debounced to coalesce bursts.
let syncTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleDescendantSync() {
  if (syncTimer) return;
  syncTimer = setTimeout(async () => {
    syncTimer = undefined;
    await fetchDetail();
    await backfill();
  }, 400);
}

async function fetchDetail() {
  try {
    detail.value = await $fetch<AgentRunDetail>(`/api/agents/runs/${runId.value}`);
    rebuildRunIndex();
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
    const stored = await $fetch<AgentRunEvent[]>(`/api/agents/runs/${runId.value}/events`, {
      query: { include_descendants: true },
    });
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
    const src = typeof evt.agent_run_id === "number" ? evt.agent_run_id : null;
    if (src === null || !allowedIds.value.has(src)) return;
    // A round finished → the persisted transcript now covers it; drop the live
    // reasoning buffer and refresh the session transcript / detail telemetry.
    if (evt.type === "llm_round_done") {
      clearReasoning(src, typeof evt.round === "number" ? evt.round : 1);
      if (src === sessionRunId.value) loadSessionTranscripts();
      if (src === runId.value) fetchDetail(); // refresh token totals + transcript index
    }
    // Any terminal child event → drop the run's lingering live reasoning buffer
    // (a run may terminate without a final llm_round_done) and refresh statuses,
    // tokens, descendants.
    if (evt.type === "agent_run_done" || evt.type === "agent_run_failed") {
      for (const r of reasoning.value.values()) {
        if (r.runId === src) clearReasoning(src, r.round);
      }
      fetchDetail();
    }
  },
  { flush: "sync" }
);

onMounted(async () => {
  await fetchDetail();
  await backfill();
  connect();
});
onUnmounted(() => {
  disconnect();
  if (syncTimer) clearTimeout(syncTimer);
});

// ── Derived ────────────────────────────────────────────────────────────────
const isRunner = computed(() => detail.value?.agent_name === "runner");
const isRunning = computed(
  () => detail.value?.status === "running" || detail.value?.status === "pending"
);
const canRetry = computed(
  () => detail.value?.status === "failed" && detail.value?.agent_name === "research_flow"
);

const isFlow = computed(
  () =>
    (detail.value?.descendants?.length ?? 0) > 0 ||
    timeline.value.some((e) => e.type === "flow_phase")
);

// Status header: current phase + target strategy + which child is active now.
const flowStatus = computed(() => {
  const phases = timeline.value.filter((e) => e.type === "flow_phase");
  const last = phases[phases.length - 1];
  const active = lastActiveChildId.value ?? runId.value;
  const hyp = timeline.value.find((e) => e.type === "hypothesis_ready");
  return {
    phase: last?.phase as string | undefined,
    strategyId: (last?.strategy_id as number | undefined) ?? detail.value?.strategy_id ?? null,
    slug: last?.slug as string | undefined,
    title: (last?.title as string | undefined) ?? (hyp?.title as string | undefined),
    activeAgent: runNames.value.get(active),
  };
});

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

// ── LLM-Session: for a flow run, follow the active/last child instead of the
// empty envelope (WP-F4). For a leaf run this is just runId. ─────────────────
const sessionRunId = computed(() => lastActiveChildId.value ?? runId.value);
const sessionTranscripts = ref<TranscriptRound[]>([]);
// Guard against out-of-order responses: sessionRunId can change again before an
// in-flight fetch resolves — only the latest request may write the result.
let sessionRequestId = 0;
async function loadSessionTranscripts() {
  const reqId = ++sessionRequestId;
  try {
    const d = await $fetch<AgentRunDetail>(`/api/agents/runs/${sessionRunId.value}`);
    if (reqId === sessionRequestId) sessionTranscripts.value = d.transcripts;
  } catch {
    if (reqId === sessionRequestId) sessionTranscripts.value = [];
  }
}
watch(sessionRunId, loadSessionTranscripts, { immediate: true });

const activeReasoning = computed(() =>
  [...reasoning.value.values()]
    .filter((r) => r.runId === sessionRunId.value)
    .sort((a, b) => a.round - b.round)
);

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

        <!-- Flow status: woran / was gerade läuft (WP-F2) -->
        <div
          v-if="isFlow && (flowStatus.phase || flowStatus.title || flowStatus.activeAgent)"
          class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
        >
          <span v-if="flowStatus.phase" class="flex items-center gap-1">
            <span class="text-gray-500">Phase</span>
            <UBadge color="primary" variant="subtle" size="xs">{{ flowStatus.phase }}</UBadge>
          </span>
          <NuxtLink
            v-if="flowStatus.strategyId"
            :to="`/agents/strategies/${flowStatus.strategyId}`"
            class="text-blue-400 hover:text-blue-300"
          >Strategie {{ flowStatus.slug ?? `#${flowStatus.strategyId}` }}</NuxtLink>
          <span v-if="flowStatus.activeAgent" class="text-gray-400">
            aktiv: {{ agentLabel(flowStatus.activeAgent) }}
          </span>
          <span v-if="flowStatus.title" class="text-gray-400 truncate">
            · {{ flowStatus.title }}
          </span>
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

      <!-- Kind-Runs (Flow drill-down, recursive subtree) -->
      <UCard v-if="detail.descendants && detail.descendants.length">
        <p class="mb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
          Kind-Runs
        </p>
        <div class="space-y-1">
          <NuxtLink
            v-for="child in detail.descendants"
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
      <div v-else-if="activeTab === 'session'" class="space-y-3">
        <p v-if="isFlow && sessionRunId !== runId" class="text-xs text-gray-500">
          Session von Kind-Run
          <NuxtLink :to="`/agents/runs/${sessionRunId}`" class="text-blue-400 hover:text-blue-300"
            >#{{ sessionRunId }}</NuxtLink
          >
          <span v-if="runNames.get(sessionRunId)"> ({{ agentLabel(runNames.get(sessionRunId)!) }})</span>
        </p>
        <RunReasoning :rounds="activeReasoning" />
        <RunTranscript :run-id="sessionRunId" :transcripts="sessionTranscripts" />
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
