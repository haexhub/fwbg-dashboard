<script setup lang="ts">
import { agentStrategyStateColor, agentPluginStateColor } from "~/types/agents";
import type { Hypothesis } from "~/types/agents";

const { data: health, refresh: refreshHealth } = useFetch<{
  status: string;
  version: string;
}>("/api/agents/health");

onMounted(() => {
  const interval = setInterval(refreshHealth, 30_000);
  onUnmounted(() => clearInterval(interval));
});

const { strategies } = useAgentStrategies();
const { plugins } = useAgentPlugins();

const { data: hypothesesData } = useFetch<{ hypotheses: Hypothesis[] }>(
  "/api/agents/hypotheses",
  { query: { limit: 10 }, default: () => ({ hypotheses: [] }) }
);
const recentHypotheses = computed(() => hypothesesData.value?.hypotheses ?? []);

function countByState(items: { current_state: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.current_state] = (counts[item.current_state] ?? 0) + 1;
  }
  return counts;
}

const strategyCounts = computed(() => countByState(strategies.value));
const pluginCounts = computed(() => countByState(plugins.value));
const paperTradingCount = computed(() => strategyCounts.value.paper_trading ?? 0);
const liveTradingCount = computed(() => strategyCounts.value.live_trading ?? 0);

const showResearchModal = ref(false);

// ── Runner auto mode: waiting proposed strategies are backtested
// automatically (single-flight) while this is on. ──
const toast = useToast();
const { data: runnerAuto, refresh: refreshRunnerAuto } = useFetch<{
  enabled: boolean;
  pipeline_min_proposed: number;
}>("/api/agents/runner-auto");
const runnerAutoBusy = ref(false);
const pipelineMinProposedInput = ref<number | null>(null);

watch(runnerAuto, (v) => {
  if (v && pipelineMinProposedInput.value === null) {
    pipelineMinProposedInput.value = v.pipeline_min_proposed;
  }
}, { immediate: true });

async function setRunnerAuto(enabled: boolean) {
  runnerAutoBusy.value = true;
  try {
    await $fetch("/api/agents/runner-auto", { method: "PUT", body: { enabled } });
    await refreshRunnerAuto();
    toast.add({
      title: enabled ? "Auto-Backtesting aktiviert" : "Auto-Backtesting deaktiviert",
      description: enabled
        ? "Wartende Strategien werden automatisch nacheinander gebacktestet."
        : "Backtests starten nur noch manuell.",
      color: enabled ? "success" : "neutral",
    });
  } catch {
    toast.add({ title: "Fehler", description: "Konnte Auto-Modus nicht umschalten.", color: "error" });
  } finally {
    runnerAutoBusy.value = false;
  }
}

async function savePipelineMinProposed() {
  const value = pipelineMinProposedInput.value;
  if (value === null || value === runnerAuto.value?.pipeline_min_proposed) return;
  try {
    await $fetch("/api/agents/runner-auto", {
      method: "PUT",
      body: { pipeline_min_proposed: value },
    });
    await refreshRunnerAuto();
    toast.add({ title: `Pipeline-Minimum auf ${value} gesetzt`, color: "success" });
  } catch {
    toast.add({ title: "Fehler", description: "Konnte Pipeline-Minimum nicht speichern.", color: "error" });
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-semibold text-white">Agents</h2>
        <UBadge v-if="health" color="success" variant="subtle">
          Online · v{{ health.version }}
        </UBadge>
        <UBadge v-else color="error" variant="subtle">Offline</UBadge>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-3 rounded-md border border-gray-800 px-3 py-1.5">
          <span class="text-sm text-gray-400">Auto-Backtest</span>
          <USwitch
            :model-value="runnerAuto?.enabled ?? false"
            :disabled="runnerAutoBusy"
            @update:model-value="setRunnerAuto"
          />
          <div
            class="flex items-center gap-1.5 border-l border-gray-700 pl-3"
            title="Mindestanzahl PROPOSED-Strategien in der Pipeline"
          >
            <span class="text-sm text-gray-400">Pipeline min.</span>
            <UInput
              v-model.number="pipelineMinProposedInput"
              type="number"
              :min="0"
              :max="20"
              size="xs"
              class="w-16"
              @change="savePipelineMinProposed"
            />
          </div>
        </div>
        <UButton
          to="/agents/config"
          icon="i-heroicons-adjustments-horizontal"
          variant="outline"
          color="neutral"
        >
          Agenten konfigurieren
        </UButton>
        <UButton icon="i-heroicons-sparkles" color="primary" @click="showResearchModal = true">
          New Research
        </UButton>
      </div>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UCard>
        <template #header>
          <h3 class="text-sm font-medium text-gray-400">Strategies</h3>
        </template>
        <p class="text-2xl font-bold text-white">{{ strategies.length }}</p>
        <div class="flex flex-wrap gap-1 mt-2">
          <UBadge
            v-for="(count, state) in strategyCounts"
            :key="state"
            :color="agentStrategyStateColor(state)"
            variant="subtle"
            size="xs"
          >
            {{ state }}: {{ count }}
          </UBadge>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="text-sm font-medium text-gray-400">Plugins</h3>
        </template>
        <p class="text-2xl font-bold text-white">{{ plugins.length }}</p>
        <div class="flex flex-wrap gap-1 mt-2">
          <UBadge
            v-for="(count, state) in pluginCounts"
            :key="state"
            :color="agentPluginStateColor(state)"
            variant="subtle"
            size="xs"
          >
            {{ state }}: {{ count }}
          </UBadge>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="text-sm font-medium text-gray-400">Paper Trading</h3>
        </template>
        <p class="text-2xl font-bold text-white">{{ paperTradingCount }}</p>
      </UCard>

      <UCard :class="liveTradingCount > 0 ? 'ring-1 ring-red-500/50' : ''">
        <template #header>
          <h3 class="text-sm font-medium text-gray-400">Live Trading</h3>
        </template>
        <p
          class="text-2xl font-bold"
          :class="liveTradingCount > 0 ? 'text-red-400' : 'text-white'"
        >
          {{ liveTradingCount }}
        </p>
      </UCard>
    </div>

    <!-- Active Runs -->
    <AgentsActiveRunsCard />

    <!-- Live Event Feed + Recent Hypotheses -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AgentsEventFeed />

      <UCard>
        <template #header>
          <h3 class="text-sm font-medium text-gray-400">Recent Hypotheses</h3>
        </template>
        <div v-if="!recentHypotheses.length" class="py-8 text-center text-gray-500 text-sm">
          No hypotheses yet.
        </div>
        <div v-else class="divide-y divide-gray-800">
          <NuxtLink
            v-for="h in recentHypotheses"
            :key="h.id"
            :to="`/agents/strategies/${h.id}`"
            class="block py-3 hover:bg-gray-900/50 transition-colors -mx-4 px-4"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm text-white font-medium">{{ h.slug }}</span>
                <UBadge v-if="h.model_knowledge_only" color="warning" variant="subtle" size="xs">
                  MK
                </UBadge>
              </div>
              <UBadge :color="agentStrategyStateColor(h.current_state)" variant="subtle" size="xs">
                {{ h.current_state }}
              </UBadge>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              {{ h.asset_class ?? "agnostic" }} · {{ h.strategy_family }}
            </p>
          </NuxtLink>
        </div>
      </UCard>
    </div>

    <AgentsResearchBriefModal v-model:open="showResearchModal" />
  </div>
</template>
