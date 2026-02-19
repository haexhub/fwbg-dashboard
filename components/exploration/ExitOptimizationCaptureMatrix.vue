<script setup lang="ts">
import type { CaptureEntry } from "~/types/exploration";

const props = defineProps<{
  captureMatrix: CaptureEntry[];
}>();

type SortKey = keyof CaptureEntry;
const sortKey = ref<SortKey>("edge_long");
const sortAsc = ref(false);

const sorted = computed(() => {
  const data = [...props.captureMatrix];
  data.sort((a, b) => {
    const av = a[sortKey.value] as number;
    const bv = b[sortKey.value] as number;
    return sortAsc.value ? av - bv : bv - av;
  });
  return data;
});

// Show top 50 by default, expandable
const showAll = ref(false);
const displayed = computed(() =>
  showAll.value ? sorted.value : sorted.value.slice(0, 50)
);

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortKey.value = key;
    sortAsc.value = false;
  }
}

function sortIcon(key: SortKey): string {
  if (sortKey.value !== key) return "i-heroicons-arrows-up-down";
  return sortAsc.value ? "i-heroicons-arrow-up" : "i-heroicons-arrow-down";
}

function formatPercent(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

function formatEdge(v: number): string {
  return (v >= 0 ? "+" : "") + v.toFixed(4);
}

function edgeColor(v: number): string {
  if (v > 0.05) return "text-green-400";
  if (v > 0) return "text-green-600";
  if (v > -0.05) return "text-red-600";
  return "text-red-400";
}

const columns: { key: SortKey; label: string; align?: string }[] = [
  { key: "tp", label: "TP" },
  { key: "sl", label: "SL" },
  { key: "rrr", label: "RRR" },
  { key: "win_rate_long", label: "WR Long", align: "right" },
  { key: "win_rate_short", label: "WR Short", align: "right" },
  { key: "edge_long", label: "Edge Long", align: "right" },
  { key: "edge_short", label: "Edge Short", align: "right" },
  { key: "resolved_trades", label: "Trades", align: "right" },
];
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-medium text-white">Capture Matrix</h3>
        <span class="text-sm text-gray-400">
          {{ captureMatrix.length }} Kombinationen
        </span>
      </div>
    </template>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-400 border-b border-gray-800">
            <th
              v-for="col in columns"
              :key="col.key"
              class="pb-2 pr-3 cursor-pointer hover:text-white transition-colors select-none"
              :class="col.align === 'right' ? 'text-right' : ''"
              @click="toggleSort(col.key)"
            >
              <span class="inline-flex items-center gap-1">
                {{ col.label }}
                <UIcon :name="sortIcon(col.key)" class="size-3" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in displayed"
            :key="i"
            class="border-b border-gray-800/50 hover:bg-gray-900/30"
          >
            <td class="py-1.5 pr-3 font-mono text-white">{{ row.tp.toFixed(1) }}</td>
            <td class="py-1.5 pr-3 font-mono text-white">{{ row.sl.toFixed(1) }}</td>
            <td class="py-1.5 pr-3 font-mono text-gray-300">{{ row.rrr.toFixed(2) }}</td>
            <td class="py-1.5 pr-3 font-mono text-right">
              {{ formatPercent(row.win_rate_long) }}
            </td>
            <td class="py-1.5 pr-3 font-mono text-right">
              {{ formatPercent(row.win_rate_short) }}
            </td>
            <td class="py-1.5 pr-3 font-mono text-right" :class="edgeColor(row.edge_long)">
              {{ formatEdge(row.edge_long) }}
            </td>
            <td class="py-1.5 pr-3 font-mono text-right" :class="edgeColor(row.edge_short)">
              {{ formatEdge(row.edge_short) }}
            </td>
            <td class="py-1.5 font-mono text-right text-gray-400">
              {{ row.resolved_trades }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="captureMatrix.length > 50"
      class="mt-3 text-center"
    >
      <UButton size="xs" variant="ghost" @click="showAll = !showAll">
        {{ showAll ? "Weniger anzeigen" : `Alle ${captureMatrix.length} anzeigen` }}
      </UButton>
    </div>
  </UCard>
</template>
