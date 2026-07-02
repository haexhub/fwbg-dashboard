<script setup lang="ts">
import { h, resolveComponent } from "vue";
import type { TableColumn } from "@nuxt/ui";
import { agentStrategyStateColor } from "~/types/agents";
import type { AgentStrategySummary, AgentStrategyState } from "~/types/agents";

const { strategies, status, refresh, stateFilter, assetClassFilter } = useAgentStrategies();
const { criteriaList } = useAgentCriteria();

const showResearchModal = ref(false);

// ── Sorting ──
const sorting = ref<{ id: string; desc: boolean }[]>([{ id: "created_at", desc: true }]);

// ── Free-text search (client-side; backend has no text-search query param) ──
const searchQuery = ref("");
const filteredStrategies = computed(() => {
  if (!searchQuery.value.trim()) return strategies.value;
  const q = searchQuery.value.toLowerCase();
  return strategies.value.filter(
    (s) =>
      s.slug.toLowerCase().includes(q) ||
      s.strategy_family.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)),
  );
});

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

function sortableHeader(label: string) {
  return ({ column }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc: boolean) => void } }) => {
    const isSorted = column.getIsSorted();
    return h(resolveComponent("UButton"), {
      label,
      variant: "ghost",
      size: "xs",
      icon: isSorted
        ? isSorted === "asc"
          ? "i-lucide-arrow-up-narrow-wide"
          : "i-lucide-arrow-down-wide-narrow"
        : "i-lucide-arrow-up-down",
      class: "-mx-2",
      onClick: () => column.toggleSorting(column.getIsSorted() === "asc"),
    });
  };
}

const columns: TableColumn<AgentStrategySummary>[] = [
  { accessorKey: "slug", header: sortableHeader("Slug") },
  { accessorKey: "asset_class", header: sortableHeader("Asset Class") },
  { id: "universe", header: "Universe", cell: () => "" },
  { accessorKey: "strategy_family", header: sortableHeader("Family") },
  { accessorKey: "current_state", header: sortableHeader("State") },
  { id: "tags", header: "Tags", cell: () => "" },
  { accessorKey: "created_at", header: sortableHeader("Erstellt") },
  { accessorKey: "updated_at", header: sortableHeader("Aktualisiert") },
];
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">Strategies</h2>
      <div class="flex items-center gap-2">
        <UButton icon="i-heroicons-arrow-path" variant="ghost" @click="refresh()">
          Refresh
        </UButton>
        <UButton icon="i-heroicons-sparkles" color="primary" @click="showResearchModal = true">
          New Research
        </UButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3">
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

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div v-if="status === 'pending'" class="py-8 text-center text-gray-400">
        Loading strategies...
      </div>
      <div v-else-if="!filteredStrategies.length" class="py-8 text-center text-gray-400">
        No strategies found.
      </div>

      <UTable
        v-else
        :data="filteredStrategies"
        :columns="columns"
        v-model:sorting="sorting"
        class="w-full"
      >
        <!-- Slug -->
        <template #slug-cell="{ row }">
          <div class="flex items-center gap-2">
            <NuxtLink
              :to="`/agents/strategies/${row.original.id}`"
              class="text-white font-mono text-sm hover:text-blue-400 transition-colors"
            >
              {{ row.original.slug }}
            </NuxtLink>
            <UTooltip
              v-if="row.original.model_knowledge_only"
              text="Ohne Web-Suche recherchiert — Quellen aus Modellwissen"
            >
              <UBadge color="warning" variant="subtle" size="xs">MK</UBadge>
            </UTooltip>
          </div>
        </template>

        <!-- Asset Class (null = asset-agnostic) -->
        <template #asset_class-cell="{ row }">
          <span v-if="row.original.asset_class" class="text-sm text-white">
            {{ row.original.asset_class }}
          </span>
          <span v-else class="text-sm text-gray-500 italic">agnostic</span>
        </template>

        <!-- Suggested universe (Researcher's asset recommendation) -->
        <template #universe-cell="{ row }">
          <div v-if="row.original.suggested_universe?.length" class="flex flex-wrap gap-1">
            <UBadge
              v-for="u in row.original.suggested_universe"
              :key="u.scope + u.value"
              :color="u.scope === 'symbol' ? 'primary' : 'info'"
              variant="subtle"
              size="xs"
            >
              {{ u.value }}
            </UBadge>
          </div>
          <span v-else class="text-xs text-gray-600">—</span>
        </template>

        <!-- State -->
        <template #current_state-cell="{ row }">
          <UBadge :color="agentStrategyStateColor(row.original.current_state)" variant="subtle" size="xs">
            {{ row.original.current_state }}
          </UBadge>
        </template>

        <!-- Tags -->
        <template #tags-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="tag in row.original.tags"
              :key="tag"
              color="neutral"
              variant="subtle"
              size="xs"
            >
              {{ tag }}
            </UBadge>
          </div>
        </template>

        <!-- Created / Updated -->
        <template #created_at-cell="{ row }">
          <span class="text-sm text-gray-400">{{ formatDate(row.original.created_at) }}</span>
        </template>
        <template #updated_at-cell="{ row }">
          <span class="text-sm text-gray-400">{{ formatDate(row.original.updated_at) }}</span>
        </template>
      </UTable>
    </UCard>

    <AgentsResearchBriefModal v-model:open="showResearchModal" @created="refresh" />
  </div>
</template>
