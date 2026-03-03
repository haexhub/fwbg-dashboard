<script setup lang="ts">
import { h, resolveComponent } from "vue";
import type { TableColumn } from "@nuxt/ui";
import { statusColor } from "~/types/strategy";
import type { RunSummary } from "~/types/strategy";

const { runs, total, totalPages, page, status, refresh } = useRuns();

// ── Sorting & filtering ──
const sorting = ref<{ id: string; desc: boolean }[]>([
  { id: "timestamp", desc: true },
]);
const columnFilters = ref<{ id: string; value: string }[]>([]);
const globalFilter = ref("");

function setColumnFilter(col: string, value: string) {
  const existing = columnFilters.value.filter((f: { id: string }) => f.id !== col);
  if (value) existing.push({ id: col, value });
  columnFilters.value = existing;
}

// ── Single delete ──
const confirmDeleteId = ref<string | null>(null);
const deleteModalOpen = computed({
  get: () => confirmDeleteId.value !== null,
  set: (v) => {
    if (!v) confirmDeleteId.value = null;
  },
});

// ── Multi-select ──
const selected = ref<Set<string>>(new Set());

const allSelected = computed(
  () =>
    !!runs.value?.length &&
    runs.value.every((r) => selected.value.has(r.run_id)),
);

function toggleAll() {
  if (allSelected.value) {
    selected.value = new Set();
  } else {
    selected.value = new Set(runs.value?.map((r) => r.run_id) ?? []);
  }
}

function toggleOne(runId: string) {
  const s = new Set(selected.value);
  if (s.has(runId)) s.delete(runId);
  else s.add(runId);
  selected.value = s;
}

// ── Bulk delete ──
const bulkDeleteModalOpen = ref(false);
const deleting = ref(false);

async function confirmDelete() {
  deleting.value = true;
  try {
    if (confirmDeleteId.value) {
      await $fetch(`/api/runs/${confirmDeleteId.value}`, { method: "DELETE" });
      confirmDeleteId.value = null;
    } else {
      await Promise.all(
        [...selected.value].map((id) =>
          $fetch(`/api/runs/${id}`, { method: "DELETE" }),
        ),
      );
      selected.value = new Set();
      bulkDeleteModalOpen.value = false;
    }
    await refresh();
  } finally {
    deleting.value = false;
  }
}

function formatDate(ts?: string): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Sortable header helper ──
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

// ── Status options for filter ──
const statusOptions = computed(() => {
  const statuses = new Set(runs.value?.map((r) => r.status) ?? []);
  return [...statuses].sort().map((s) => ({ label: s, value: s }));
});

const statusFilter = ref<RunSummary["status"]>();
watch(statusFilter, (val) => setColumnFilter("status", val ?? ""));

const strategyFilter = ref("");
watch(strategyFilter, (val: string) => setColumnFilter("strategy_name", val));

// ── Columns ──
const columns: TableColumn<RunSummary>[] = [
  {
    id: "select",
    header: "",
    cell: () => "",
  },
  {
    accessorKey: "status",
    header: sortableHeader("Status"),
    filterFn: "equalsString",
  },
  {
    accessorKey: "run_id",
    header: sortableHeader("Run ID"),
  },
  {
    accessorKey: "strategy_name",
    header: sortableHeader("Strategy"),
    filterFn: "includesString",
  },
  {
    accessorKey: "timeframe",
    header: sortableHeader("Timeframe"),
  },
  {
    id: "timestamp",
    accessorFn: (row) => row.timestamp || row.started_at || "",
    header: sortableHeader("Datum"),
  },
  {
    id: "assets",
    accessorFn: (row) => row.asset_count ?? 0,
    header: sortableHeader("Assets"),
  },
  {
    id: "actions",
    header: "",
    cell: () => "",
  },
];
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">Runs</h2>
      <div class="flex items-center gap-2">
        <UButton
          v-if="selected.size > 0"
          icon="i-heroicons-trash"
          color="error"
          variant="ghost"
          @click="bulkDeleteModalOpen = true"
        >
          {{ selected.size }} löschen
        </UButton>
        <UButton
          icon="i-heroicons-arrow-path"
          variant="ghost"
          @click="refresh()"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3">
      <UInput
        v-model="globalFilter"
        icon="i-lucide-search"
        placeholder="Suche…"
        class="w-64"
        size="sm"
      />
      <div class="flex items-center gap-1">
        <USelect
          v-model="statusFilter"
          :items="statusOptions"
          value-key="value"
          placeholder="Alle Status"
          size="sm"
          class="w-40"
        />
        <UButton
          v-if="statusFilter"
          icon="i-heroicons-x-mark"
          variant="ghost"
          size="xs"
          @click="statusFilter = undefined"
        />
      </div>
      <UInput
        v-model="strategyFilter"
        placeholder="Strategy…"
        size="sm"
        class="w-48"
      />
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div v-if="status === 'pending'" class="py-8 text-center text-gray-400">
        Loading runs...
      </div>
      <div
        v-else-if="!runs?.length"
        class="py-8 text-center text-gray-400"
      >
        No runs found.
      </div>

      <UTable
        v-else
        :data="runs"
        :columns="columns"
        v-model:sorting="sorting"
        v-model:column-filters="columnFilters"
        v-model:global-filter="globalFilter"
        class="w-full"
      >
        <!-- Select -->
        <template #select-header>
          <UCheckbox :model-value="allSelected" @update:model-value="toggleAll" />
        </template>
        <template #select-cell="{ row }">
          <UCheckbox
            :model-value="selected.has(row.original.run_id)"
            @update:model-value="toggleOne(row.original.run_id)"
            @click.stop
          />
        </template>

        <!-- Status -->
        <template #status-cell="{ row }">
          <UBadge
            :color="statusColor(row.original.status)"
            variant="subtle"
            size="xs"
          >
            {{ row.original.status }}
          </UBadge>
        </template>

        <!-- Run ID -->
        <template #run_id-cell="{ row }">
          <NuxtLink
            :to="`/runs/${row.original.run_id}`"
            class="text-white font-mono text-sm hover:text-blue-400 transition-colors"
          >
            {{ row.original.run_id }}
          </NuxtLink>
        </template>

        <!-- Strategy -->
        <template #strategy_name-cell="{ row }">
          <span class="text-sm text-gray-300">
            {{ row.original.strategy_name ?? "-" }}
          </span>
        </template>

        <!-- Timeframe -->
        <template #timeframe-cell="{ row }">
          <span class="text-sm text-gray-400 font-mono">
            {{ row.original.timeframe ?? "-" }}
          </span>
        </template>

        <!-- Datum -->
        <template #timestamp-cell="{ row }">
          <span class="text-sm text-gray-400">
            {{ formatDate(row.original.timestamp || row.original.started_at) }}
          </span>
        </template>

        <!-- Assets -->
        <template #assets-cell="{ row }">
          <span v-if="row.original.asset_count != null" class="text-sm text-gray-300">
            <span class="text-green-400">{{ row.original.profitable_count ?? 0 }}</span>
            /
            {{ row.original.asset_count }}
          </span>
          <span v-else class="text-sm text-gray-500">-</span>
        </template>

        <!-- Actions -->
        <template #actions-cell="{ row }">
          <UButton
            icon="i-heroicons-trash"
            variant="ghost"
            color="error"
            size="xs"
            @click.prevent="confirmDeleteId = row.original.run_id"
          />
        </template>
      </UTable>
    </UCard>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <span class="text-sm text-gray-500">
        {{ total }} Runs gesamt
      </span>
      <UPagination v-model="page" :total="total" :items-per-page="20" />
    </div>

    <!-- Single delete confirmation -->
    <UModal v-model:open="deleteModalOpen">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-base font-semibold text-white">Run löschen?</h3>
          <p class="text-sm text-gray-400">
            Alle Ergebnisse für Run
            <span class="font-mono text-white">{{ confirmDeleteId }}</span>
            werden unwiderruflich von der Festplatte gelöscht.
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" @click="confirmDeleteId = null"
              >Abbrechen</UButton
            >
            <UButton color="error" :loading="deleting" @click="confirmDelete"
              >Löschen</UButton
            >
          </div>
        </div>
      </template>
    </UModal>

    <!-- Bulk delete confirmation -->
    <UModal v-model:open="bulkDeleteModalOpen">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-base font-semibold text-white">
            {{ selected.size }} Runs löschen?
          </h3>
          <p class="text-sm text-gray-400">
            Alle Ergebnisse der ausgewählten {{ selected.size }} Runs werden
            unwiderruflich von der Festplatte gelöscht.
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" @click="bulkDeleteModalOpen = false"
              >Abbrechen</UButton
            >
            <UButton color="error" :loading="deleting" @click="confirmDelete"
              >Alle löschen</UButton
            >
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
