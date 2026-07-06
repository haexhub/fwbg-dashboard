<script setup lang="ts">
import { agentStrategyStateColor } from "~/types/agents";
import type { AgentStrategySummary, AgentStrategyState } from "~/types/agents";

const { strategies, status, refresh, stateFilter, assetClassFilter } = useAgentStrategies();
const { criteriaList } = useAgentCriteria();

const showResearchModal = ref(false);

const searchQuery = ref("");

// ── Filter options ──
const stateOptions: { label: string; value: AgentStrategyState }[] = [
  { label: "proposed", value: "proposed" },
  { label: "backtested", value: "backtested" },
  { label: "paper_trading", value: "paper_trading" },
  { label: "live_trading", value: "live_trading" },
  { label: "abandoned", value: "abandoned" },
];

const assetClassOptions = computed(() =>
  (criteriaList.value?.asset_classes ?? []).map((ac) => ({ label: ac, value: ac })),
);

// ── Grouping by strategy_family ──
interface StrategyGroup {
  family: string;
  strategies: AgentStrategySummary[];
  latestState: AgentStrategyState;
}

const strategyGroups = computed<StrategyGroup[]>(() => {
  const q = searchQuery.value.toLowerCase().trim();
  const items = (strategies.value ?? []).filter((s) => {
    if (!q) return true;
    return (
      s.slug.toLowerCase().includes(q) ||
      s.strategy_family.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const map = new Map<string, AgentStrategySummary[]>();
  for (const s of items) {
    const family = s.strategy_family || s.slug;
    if (!map.has(family)) map.set(family, []);
    map.get(family)!.push(s);
  }

  return Array.from(map.entries())
    .map(([family, strats]) => {
      const sorted = [...strats].sort((a, b) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? ""),
      );
      // Latest state = most recently updated strategy's state
      const latest = [...strats].sort((a, b) =>
        (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
      )[0];
      return { family, strategies: sorted, latestState: latest?.current_state ?? "proposed" };
    })
    .sort((a, b) => a.family.localeCompare(b.family));
});

const openGroups = ref<string[]>([]);

function toggleGroup(family: string) {
  const idx = openGroups.value.indexOf(family);
  if (idx >= 0) openGroups.value.splice(idx, 1);
  else openGroups.value.push(family);
}

function isOpen(family: string) {
  return openGroups.value.includes(family);
}

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

// Label each strategy within its family as v1, v2, ...
function iterationLabel(group: StrategyGroup, s: AgentStrategySummary): string {
  const idx = group.strategies.indexOf(s);
  return `it${String(idx + 1).padStart(3, "0")}`;
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">Strategies</h2>
      <div class="flex items-center gap-2">
        <UButton icon="i-heroicons-arrow-path" variant="ghost" @click="refresh()">
          Refresh
        </UButton>
        <UButton icon="i-heroicons-sparkles" color="primary" @click="() => { showResearchModal = true }">
          New Research
        </UButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3 flex-wrap">
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Suche…"
        class="w-64"
        size="sm"
      />
      <div class="flex items-center gap-1">
        <USelect
          v-model="stateFilter"
          :items="stateOptions"
          value-key="value"
          placeholder="Alle Status"
          size="sm"
          class="w-40"
        />
        <UButton
          v-if="stateFilter"
          icon="i-heroicons-x-mark"
          variant="ghost"
          size="xs"
          @click="stateFilter = undefined"
        />
      </div>
      <div class="flex items-center gap-1">
        <USelect
          v-model="assetClassFilter"
          :items="assetClassOptions"
          value-key="value"
          placeholder="Alle Asset Classes"
          size="sm"
          class="w-48"
        />
        <UButton
          v-if="assetClassFilter"
          icon="i-heroicons-x-mark"
          variant="ghost"
          size="xs"
          @click="assetClassFilter = undefined"
        />
      </div>
    </div>

    <div v-if="status === 'pending'" class="py-8 text-center text-gray-400">
      Loading strategies...
    </div>
    <div v-else-if="!strategyGroups.length" class="py-8 text-center text-gray-400">
      No strategies found.
    </div>

    <div v-else class="space-y-2">
      <UCard
        v-for="group in strategyGroups"
        :key="group.family"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <!-- Accordion header -->
        <button
          class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-900/50 transition-colors"
          @click="toggleGroup(group.family)"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-white font-medium">{{ group.family }}</span>
              <UBadge color="neutral" variant="subtle" size="xs">
                {{ group.strategies.length }}
                {{ group.strategies.length === 1 ? "Iteration" : "Iterationen" }}
              </UBadge>
              <UBadge :color="agentStrategyStateColor(group.latestState)" variant="subtle" size="xs">
                {{ group.latestState }}
              </UBadge>
            </div>
          </div>
          <UIcon
            :name="isOpen(group.family) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
            class="text-gray-400 shrink-0 ml-4 w-4 h-4"
          />
        </button>

        <!-- Accordion body -->
        <div v-if="isOpen(group.family)" class="border-t border-gray-800">
          <div
            v-for="s in group.strategies"
            :key="s.id"
            class="flex items-center justify-between px-6 py-2.5 border-b border-gray-800/50 last:border-0 hover:bg-gray-900/30 transition-colors"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <NuxtLink
                  :to="`/agents/strategies/${s.id}`"
                  class="font-mono text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {{ iterationLabel(group, s) }}
                </NuxtLink>
                <UBadge :color="agentStrategyStateColor(s.current_state)" variant="subtle" size="xs">
                  {{ s.current_state }}
                </UBadge>
                <span v-if="s.asset_class" class="text-xs text-gray-400">{{ s.asset_class }}</span>
                <span v-else class="text-xs text-gray-500 italic">agnostic</span>
                <UTooltip
                  v-if="s.model_knowledge_only"
                  text="Ohne Web-Suche recherchiert"
                >
                  <UBadge color="warning" variant="subtle" size="xs">MK</UBadge>
                </UTooltip>
              </div>
              <div v-if="s.suggested_universe?.length" class="flex flex-wrap gap-1 mt-1">
                <UBadge
                  v-for="u in s.suggested_universe"
                  :key="u.scope + u.value"
                  :color="u.scope === 'symbol' ? 'primary' : 'info'"
                  variant="subtle"
                  size="xs"
                >
                  {{ u.value }}
                </UBadge>
              </div>
              <div v-if="s.tags.length" class="flex flex-wrap gap-1 mt-1">
                <UBadge
                  v-for="tag in s.tags"
                  :key="tag"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                >
                  {{ tag }}
                </UBadge>
              </div>
            </div>
            <div class="text-xs text-gray-500 shrink-0 ml-4 text-right">
              <div>{{ formatDate(s.created_at) }}</div>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <AgentsResearchBriefModal v-model:open="showResearchModal" @created="refresh" />
  </div>
</template>
