<script setup lang="ts">
import { h, resolveComponent } from "vue";
import type { TableColumn } from "@nuxt/ui";
import { agentPluginStateColor } from "~/types/agents";
import type { AgentPluginSummary, AgentPluginState, AgentPluginKind } from "~/types/agents";

const { plugins, status, refresh, stateFilter, kindFilter } = useAgentPlugins();

const searchQuery = ref("");
const filteredPlugins = computed(() => {
  if (!searchQuery.value.trim()) return plugins.value;
  const q = searchQuery.value.toLowerCase();
  return plugins.value.filter((p) => p.slug.toLowerCase().includes(q));
});

const stateOptions: { label: string; value: AgentPluginState }[] = [
  { label: "specified", value: "specified" },
  { label: "authored", value: "authored" },
  { label: "verified", value: "verified" },
  { label: "adopted_in_fwbg", value: "adopted_in_fwbg" },
  { label: "abandoned", value: "abandoned" },
];

const kindOptions: { label: string; value: AgentPluginKind }[] = [
  { label: "indicator", value: "indicator" },
  { label: "model", value: "model" },
  { label: "exit_strategy", value: "exit_strategy" },
  { label: "risk_management", value: "risk_management" },
  { label: "entry_modifier", value: "entry_modifier" },
  { label: "preprocessing", value: "preprocessing" },
  { label: "feature_selection", value: "feature_selection" },
  { label: "data_loading", value: "data_loading" },
];

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

const sorting = ref<{ id: string; desc: boolean }[]>([{ id: "created_at", desc: true }]);

const columns: TableColumn<AgentPluginSummary>[] = [
  { accessorKey: "slug", header: sortableHeader("Slug") },
  { accessorKey: "kind", header: sortableHeader("Kind") },
  { accessorKey: "current_state", header: sortableHeader("State") },
  { accessorKey: "created_at", header: sortableHeader("Erstellt") },
  { accessorKey: "updated_at", header: sortableHeader("Aktualisiert") },
];
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">Plugins</h2>
      <UButton icon="i-heroicons-arrow-path" variant="ghost" @click="refresh()">
        Refresh
      </UButton>
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
          class="w-44"
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
          v-model="kindFilter"
          :items="kindOptions"
          value-key="value"
          placeholder="Alle Kinds"
          size="sm"
          class="w-48"
        />
        <UButton
          v-if="kindFilter"
          icon="i-heroicons-x-mark"
          variant="ghost"
          size="xs"
          @click="kindFilter = undefined"
        />
      </div>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div v-if="status === 'pending'" class="py-8 text-center text-gray-400">
        Loading plugins...
      </div>
      <div v-else-if="!filteredPlugins.length" class="py-8 text-center text-gray-400">
        No plugins found.
      </div>

      <UTable
        v-else
        :data="filteredPlugins"
        :columns="columns"
        v-model:sorting="sorting"
        class="w-full"
      >
        <template #slug-cell="{ row }">
          <NuxtLink
            :to="`/agents/plugins/${row.original.id}`"
            class="text-white font-mono text-sm hover:text-blue-400 transition-colors"
          >
            {{ row.original.slug }}
          </NuxtLink>
        </template>

        <template #current_state-cell="{ row }">
          <UBadge :color="agentPluginStateColor(row.original.current_state)" variant="subtle" size="xs">
            {{ row.original.current_state }}
          </UBadge>
        </template>

        <template #created_at-cell="{ row }">
          <span class="text-sm text-gray-400">{{ formatDate(row.original.created_at) }}</span>
        </template>
        <template #updated_at-cell="{ row }">
          <span class="text-sm text-gray-400">{{ formatDate(row.original.updated_at) }}</span>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
