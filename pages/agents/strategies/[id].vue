<script setup lang="ts">
import { agentStrategyStateColor } from "~/types/agents";
import type {
  AgentStrategyDetail,
  HypothesisContent,
  PaperSummary,
  PaperPosition,
} from "~/types/agents";

definePageMeta({ ssr: false });

const route = useRoute();
const toast = useToast();
const strategyId = computed(() => Number(route.params.id));

const {
  getStrategyDetail,
  getHypothesis,
  getPaperSummary,
  getPaperPositions,
  runBacktest,
  analyzeStrategy,
  paperAnalyzeStrategy,
} = useAgentStrategies();
const { pollRun } = useAgentRuns();

const detail = ref<AgentStrategyDetail | null>(null);
const loading = ref(true);
const notFound = ref(false);
const paperSummary = ref<PaperSummary | null>(null);
const paperPositions = ref<PaperPosition[]>([]);

// Hypothesis content is loaded lazily the first time its tab is opened. It
// lives on disk (sources + suggested_universe) rather than in the DB row.
const hypothesis = ref<HypothesisContent | null>(null);
const hypothesisLoading = ref(false);
const hypothesisError = ref("");
const hypothesisLoaded = ref(false);

const strategy = computed(() => detail.value?.strategy ?? null);
const showPaperTab = computed(
  () => strategy.value?.current_state === "paper_trading" || strategy.value?.current_state === "live_trading",
);

async function loadDetail() {
  loading.value = true;
  notFound.value = false;
  try {
    detail.value = await getStrategyDetail(strategyId.value);
    if (showPaperTab.value) {
      const [summary, positions] = await Promise.all([
        getPaperSummary(strategyId.value),
        getPaperPositions(strategyId.value),
      ]);
      paperSummary.value = summary;
      paperPositions.value = positions;
    }
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) {
      notFound.value = true;
    } else {
      throw e;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(loadDetail);

async function loadHypothesis() {
  if (hypothesisLoaded.value || hypothesisLoading.value) return;
  hypothesisLoading.value = true;
  hypothesisError.value = "";
  try {
    const res = await getHypothesis(strategyId.value);
    hypothesis.value = res.hypothesis;
    hypothesisLoaded.value = true;
  } catch (e) {
    const statusCode = (e as { statusCode?: number }).statusCode;
    hypothesisError.value =
      statusCode === 404
        ? "Keine Hypothese für diese Strategie hinterlegt (manuell erstellt oder Datei entfernt)."
        : extractErrorMessage(e);
  } finally {
    hypothesisLoading.value = false;
  }
}

const tabItems = computed(() => {
  const items = [
    { label: "Overview", value: "overview" },
    { label: "Hypothesis", value: "hypothesis" },
    { label: "Strategy JSON", value: "json" },
    { label: "Transitions", value: "transitions" },
  ];
  if (showPaperTab.value) items.push({ label: "Paper Trading", value: "paper" });
  return items;
});
const selectedTab = ref("overview");

watch(selectedTab, (tab) => {
  if (tab === "hypothesis") loadHypothesis();
});

function formatDate(ts?: string | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractErrorMessage(e: unknown): string {
  const err = e as { statusMessage?: string; message?: string; data?: { detail?: string; message?: string } };
  return err?.data?.detail ?? err?.data?.message ?? err?.statusMessage ?? err?.message ?? "Aktion fehlgeschlagen";
}

// ── Action buttons (Run / Analyze / Paper-Analyze) ──
const runningAction = ref<"run" | "analyze" | "paper_analyze" | null>(null);

async function handleAction(
  action: "run" | "analyze" | "paper_analyze",
  fn: () => Promise<{ agent_run_id: number }>,
) {
  runningAction.value = action;
  try {
    const { agent_run_id } = await fn();
    const { promise } = pollRun(agent_run_id);
    const run = await promise;
    toast.add({
      title: run.status === "done" ? "Abgeschlossen" : "Fehlgeschlagen",
      description: run.status === "done"
        ? `Agent-Run #${run.id} erfolgreich abgeschlossen.`
        : (run.error ?? `Agent-Run #${run.id} fehlgeschlagen.`),
      color: run.status === "done" ? "success" : "error",
    });
    await loadDetail();
  } catch (e) {
    toast.add({ title: "Fehler", description: extractErrorMessage(e), color: "error" });
  } finally {
    runningAction.value = null;
  }
}

const handleRun = () => handleAction("run", () => runBacktest(strategyId.value));
const handleAnalyze = () => handleAction("analyze", () => analyzeStrategy(strategyId.value));
const handlePaperAnalyze = () => handleAction("paper_analyze", () => paperAnalyzeStrategy(strategyId.value));

// ── Promote to Live ──
const showPromoteModal = ref(false);
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="py-16 text-center text-gray-400">
      Lade Strategie...
    </div>

    <div v-else-if="notFound" class="py-16 text-center text-gray-400">
      Strategie nicht gefunden.
    </div>

    <template v-else-if="strategy">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <NuxtLink to="/agents/strategies">
            <UButton icon="i-heroicons-arrow-left" variant="ghost" />
          </NuxtLink>
          <h2 class="text-xl font-semibold text-white font-mono">{{ strategy.slug }}</h2>
          <UBadge :color="agentStrategyStateColor(strategy.current_state)" variant="subtle">
            {{ strategy.current_state }}
          </UBadge>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="strategy.current_state === 'proposed'"
            icon="i-heroicons-play"
            :loading="runningAction === 'run'"
            :disabled="runningAction !== null"
            @click="handleRun"
          >
            Run Backtest
          </UButton>
          <UButton
            v-if="strategy.current_state === 'proposed'"
            icon="i-heroicons-chart-bar"
            variant="outline"
            :loading="runningAction === 'analyze'"
            :disabled="runningAction !== null"
            @click="handleAnalyze"
          >
            Analyze
          </UButton>
          <UButton
            v-if="strategy.current_state === 'paper_trading'"
            icon="i-heroicons-document-chart-bar"
            variant="outline"
            :loading="runningAction === 'paper_analyze'"
            :disabled="runningAction !== null"
            @click="handlePaperAnalyze"
          >
            Paper-Analyze
          </UButton>
          <UButton
            v-if="strategy.current_state === 'paper_trading'"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            @click="showPromoteModal = true"
          >
            Promote to Live
          </UButton>
        </div>
      </div>

      <!-- Tabs -->
      <UTabs v-model="selectedTab" :items="tabItems" variant="link" />

      <!-- Overview -->
      <UCard v-if="selectedTab === 'overview'">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span class="text-gray-500">ID</span>
            <p class="text-white font-mono">{{ strategy.id }}</p>
          </div>
          <div>
            <span class="text-gray-500">Asset Class</span>
            <p v-if="strategy.asset_class" class="text-white">{{ strategy.asset_class }}</p>
            <p v-else class="text-gray-400 italic">agnostic</p>
          </div>
          <div>
            <span class="text-gray-500">Family</span>
            <p class="text-white">{{ strategy.strategy_family }}</p>
          </div>
          <div>
            <span class="text-gray-500">Iteration</span>
            <p class="text-white">{{ strategy.iteration_count }}</p>
          </div>
          <div v-if="strategy.parent_strategy_id">
            <span class="text-gray-500">Parent Strategy</span>
            <NuxtLink :to="`/agents/strategies/${strategy.parent_strategy_id}`" class="text-blue-400 hover:underline block">
              #{{ strategy.parent_strategy_id }}
            </NuxtLink>
          </div>
          <div>
            <span class="text-gray-500">Erstellt</span>
            <p class="text-white">{{ formatDate(strategy.created_at) }}</p>
          </div>
          <div>
            <span class="text-gray-500">Aktualisiert</span>
            <p class="text-white">{{ formatDate(strategy.updated_at) }}</p>
          </div>
        </div>
        <div v-if="strategy.tags.length" class="flex flex-wrap gap-1 mt-4">
          <UBadge v-for="tag in strategy.tags" :key="tag" color="neutral" variant="subtle" size="xs">
            {{ tag }}
          </UBadge>
        </div>
        <div class="mt-4 space-y-1 text-xs text-gray-500">
          <p v-if="strategy.hypothesis_path">Hypothesis: <span class="font-mono">{{ strategy.hypothesis_path }}</span></p>
          <p v-if="strategy.spec_path">Spec: <span class="font-mono">{{ strategy.spec_path }}</span></p>
          <p v-if="strategy.post_mortem_path">Post-Mortem: <span class="font-mono">{{ strategy.post_mortem_path }}</span></p>
        </div>
      </UCard>

      <!-- Hypothesis: the researcher's edge, sources (with key_points) and the
           suggested asset universe — read on-demand from the hypothesis.json. -->
      <UCard v-else-if="selectedTab === 'hypothesis'">
        <div v-if="hypothesisLoading" class="py-8 text-center text-gray-400">
          Lade Hypothese...
        </div>
        <div v-else-if="hypothesisError" class="py-8 text-center text-gray-400">
          {{ hypothesisError }}
        </div>
        <div v-else-if="hypothesis" class="space-y-6">
          <UAlert
            v-if="hypothesis.model_knowledge_only"
            color="warning"
            variant="subtle"
            icon="i-heroicons-cpu-chip"
            title="Model-Knowledge only"
            description="Diese Hypothese entstand ohne Web-Suche — alle Quellen stammen aus dem Modellwissen und sind nicht extern verifiziert."
          />

          <div>
            <h3 class="text-base font-semibold text-white">{{ hypothesis.title }}</h3>
            <p class="text-sm text-gray-300 mt-2 whitespace-pre-line">{{ hypothesis.hypothesis }}</p>
          </div>

          <div>
            <h4 class="text-sm font-medium text-gray-400 mb-1">Expected Edge</h4>
            <p class="text-sm text-gray-300 whitespace-pre-line">{{ hypothesis.expected_edge_explanation }}</p>
          </div>

          <div v-if="hypothesis.key_indicators?.length">
            <h4 class="text-sm font-medium text-gray-400 mb-2">Key Indicators</h4>
            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="ind in hypothesis.key_indicators"
                :key="ind"
                color="neutral"
                variant="subtle"
                size="xs"
              >
                {{ ind }}
              </UBadge>
            </div>
          </div>

          <!-- Suggested universe: the Researcher's asset recommendation. -->
          <div v-if="hypothesis.suggested_universe?.length">
            <h4 class="text-sm font-medium text-gray-400 mb-2">Suggested Universe</h4>
            <div class="space-y-2">
              <div
                v-for="u in hypothesis.suggested_universe"
                :key="u.scope + u.value"
                class="rounded border border-gray-800 bg-gray-950/50 p-3"
              >
                <div class="flex items-center gap-2">
                  <UBadge :color="u.scope === 'symbol' ? 'primary' : 'info'" variant="subtle" size="xs">
                    {{ u.scope }}
                  </UBadge>
                  <span class="text-sm text-white font-mono">{{ u.value }}</span>
                  <span v-if="u.timeframe" class="text-xs text-gray-500">· {{ u.timeframe }}</span>
                </div>
                <p class="text-xs text-gray-400 mt-1">{{ u.rationale }}</p>
              </div>
            </div>
          </div>

          <!-- Sources: first-class citations backing the edge. -->
          <div>
            <h4 class="text-sm font-medium text-gray-400 mb-2">
              Sources ({{ hypothesis.sources?.length || 0 }})
            </h4>
            <div v-if="!hypothesis.sources?.length" class="text-sm text-gray-500">
              Keine Quellen hinterlegt.
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="(src, i) in hypothesis.sources"
                :key="i"
                class="rounded border border-gray-800 bg-gray-950/50 p-3"
              >
                <div class="flex items-start justify-between gap-2">
                  <a
                    v-if="src.url && src.url.startsWith('http')"
                    :href="src.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-blue-400 hover:underline font-medium"
                  >
                    {{ src.title }}
                    <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3 h-3 inline" />
                  </a>
                  <span v-else class="text-sm text-white font-medium">{{ src.title }}</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">{{ src.why_relevant }}</p>
                <ul v-if="src.key_points?.length" class="mt-2 space-y-1">
                  <li
                    v-for="(kp, j) in src.key_points"
                    :key="j"
                    class="text-xs text-gray-400 flex gap-2"
                  >
                    <span class="text-gray-600">•</span>
                    <span>{{ kp }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Strategy JSON: the API only exposes this metadata object, not the
           underlying fwbg strategy.json file content (only its on-disk path). -->
      <UCard v-else-if="selectedTab === 'json'">
        <pre class="text-xs text-gray-300 bg-gray-950 rounded p-3 overflow-x-auto">{{ JSON.stringify(strategy, null, 2) }}</pre>
      </UCard>

      <!-- Transitions -->
      <UCard v-else-if="selectedTab === 'transitions'" :ui="{ body: 'p-0 sm:p-0' }">
        <div v-if="!detail?.transitions.length" class="py-8 text-center text-gray-400">
          No transitions yet.
        </div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-500 border-b border-gray-800">
              <th class="px-4 py-2">From</th>
              <th class="px-4 py-2">To</th>
              <th class="px-4 py-2">Reason</th>
              <th class="px-4 py-2">By</th>
              <th class="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <tr v-for="t in detail?.transitions" :key="t.id">
              <td class="px-4 py-2 text-gray-400">{{ t.from_state ?? "-" }}</td>
              <td class="px-4 py-2">
                <UBadge :color="agentStrategyStateColor(t.to_state)" variant="subtle" size="xs">
                  {{ t.to_state }}
                </UBadge>
              </td>
              <td class="px-4 py-2 text-gray-400">{{ t.reason || "-" }}</td>
              <td class="px-4 py-2 text-gray-400">{{ t.created_by }}</td>
              <td class="px-4 py-2 text-gray-400">{{ formatDate(t.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </UCard>

      <!-- Paper Trading -->
      <UCard v-else-if="selectedTab === 'paper'">
        <div v-if="!paperSummary" class="py-8 text-center text-gray-400">
          No paper-trade telemetry on disk yet.
        </div>
        <template v-else>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span class="text-gray-500">Sharpe (Paper)</span>
              <p class="text-white">{{ paperSummary.sharpe_paper.toFixed(2) }}</p>
            </div>
            <div>
              <span class="text-gray-500">Max Drawdown</span>
              <p class="text-white">{{ (paperSummary.max_dd_paper * 100).toFixed(1) }}%</p>
            </div>
            <div>
              <span class="text-gray-500">Win Rate</span>
              <p class="text-white">{{ (paperSummary.win_rate * 100).toFixed(1) }}%</p>
            </div>
            <div>
              <span class="text-gray-500">Trades (Total / Today)</span>
              <p class="text-white">{{ paperSummary.trades_total }} / {{ paperSummary.trades_today }}</p>
            </div>
            <div>
              <span class="text-gray-500">Days in Paper</span>
              <p class="text-white">{{ paperSummary.days_in_paper }}</p>
            </div>
            <div>
              <span class="text-gray-500">Equity</span>
              <p class="text-white">{{ paperSummary.current_equity.toFixed(2) }} ({{ paperSummary.starting_equity.toFixed(2) }} start)</p>
            </div>
            <div>
              <span class="text-gray-500">Last Trade</span>
              <p class="text-white">{{ formatDate(paperSummary.last_trade_at) }}</p>
            </div>
          </div>

          <h4 class="text-sm font-medium text-gray-400 mt-6 mb-2">Open Positions</h4>
          <div v-if="!paperPositions.length" class="py-4 text-center text-gray-500 text-sm">
            No open positions.
          </div>
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="text-left text-gray-500 border-b border-gray-800">
                <th class="px-4 py-2">Symbol</th>
                <th class="px-4 py-2">Side</th>
                <th class="px-4 py-2">Qty</th>
                <th class="px-4 py-2">Entry</th>
                <th class="px-4 py-2">Current</th>
                <th class="px-4 py-2">Unrealised PnL</th>
                <th class="px-4 py-2">Opened</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
              <tr v-for="p in paperPositions" :key="p.symbol + p.opened_at">
                <td class="px-4 py-2 text-white font-mono">{{ p.symbol }}</td>
                <td class="px-4 py-2 text-gray-400">{{ p.side }}</td>
                <td class="px-4 py-2 text-gray-400">{{ p.quantity }}</td>
                <td class="px-4 py-2 text-gray-400">{{ p.entry_price }}</td>
                <td class="px-4 py-2 text-gray-400">{{ p.current_price ?? "-" }}</td>
                <td class="px-4 py-2" :class="(p.unrealised_pnl_pct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'">
                  {{ p.unrealised_pnl_pct != null ? `${(p.unrealised_pnl_pct * 100).toFixed(2)}%` : "-" }}
                </td>
                <td class="px-4 py-2 text-gray-400">{{ formatDate(p.opened_at) }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </UCard>
    </template>

    <AgentsPromoteLiveModal
      v-if="strategy"
      v-model:open="showPromoteModal"
      :strategy-id="strategy.id"
      :strategy-slug="strategy.slug"
      @promoted="loadDetail"
    />
  </div>
</template>
