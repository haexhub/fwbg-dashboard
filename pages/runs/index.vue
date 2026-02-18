<script setup lang="ts">
import { statusColor, formatWinRate } from "~/types/strategy";
import type { RunSummary } from "~/types/strategy";

const { runs, status, refresh } = useRuns();

const columns = [
  { key: "run_id", label: "Run ID" },
  { key: "strategy_name", label: "Strategy" },
  { key: "status", label: "Status" },
  { key: "timestamp", label: "Date" },
  { key: "asset_count", label: "Assets" },
  { key: "profitable_count", label: "Profitable" },
];

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
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">Runs</h2>
      <UButton icon="i-heroicons-arrow-path" variant="ghost" @click="refresh()">
        Refresh
      </UButton>
    </div>

    <UCard>
      <div v-if="status === 'pending'" class="py-8 text-center text-gray-400">
        Loading runs...
      </div>
      <div
        v-else-if="!runs?.length"
        class="py-8 text-center text-gray-400"
      >
        No runs found.
      </div>
      <div v-else class="divide-y divide-gray-800">
        <div
          v-for="run in runs"
          :key="run.run_id"
          class="flex items-center justify-between px-4 py-3 hover:bg-gray-900/50 transition-colors"
        >
          <div class="flex items-center gap-4 min-w-0 flex-1">
            <UBadge :color="statusColor(run.status)" variant="subtle" size="xs">
              {{ run.status }}
            </UBadge>
            <div class="min-w-0">
              <NuxtLink
                :to="`/runs/${run.run_id}`"
                class="text-white font-mono text-sm hover:text-blue-400 transition-colors"
              >
                {{ run.run_id }}
              </NuxtLink>
              <p v-if="run.strategy_name" class="text-sm text-gray-400 truncate">
                {{ run.strategy_name }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-6 text-sm text-gray-400">
            <span>{{ formatDate(run.timestamp || run.started_at) }}</span>
            <span v-if="run.asset_count != null">
              {{ run.profitable_count ?? 0 }}/{{ run.asset_count }} profitable
            </span>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
