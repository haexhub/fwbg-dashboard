<script setup lang="ts">
import type { RunProgress } from "~/types/run-progress";

const props = defineProps<{
  progress: RunProgress;
}>();

const progressPct = computed(() =>
  (props.progress.overall_progress_fraction * 100).toFixed(1),
);

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

const elapsed = computed(() => formatDuration(props.progress.elapsed_seconds));

const eta = computed(() => {
  const r = props.progress.estimated_remaining_seconds;
  if (r == null) return "Berechne...";
  return formatDuration(r);
});
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold text-white">Run Progress</h2>
    </template>

    <!-- Progress Bar -->
    <div class="mb-4">
      <div class="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          class="h-full bg-primary rounded-full transition-all duration-500"
          :style="{ width: `${progressPct}%` }"
        />
      </div>
      <div class="flex justify-between text-xs text-gray-400 mt-1">
        <span>{{ progressPct }}%</span>
        <span>{{ progress.strategy_name }}</span>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-lg bg-gray-800 p-3">
        <div class="text-xs text-gray-400">Laufzeit</div>
        <div class="text-lg font-mono text-white">{{ elapsed }}</div>
      </div>
      <div class="rounded-lg bg-gray-800 p-3">
        <div class="text-xs text-gray-400">ETA</div>
        <div class="text-lg font-mono text-white">{{ eta }}</div>
      </div>
      <div class="rounded-lg bg-gray-800 p-3">
        <div class="text-xs text-gray-400">Assets</div>
        <div class="text-lg font-mono text-white">
          {{ progress.completed_assets }} / {{ progress.total_assets }}
        </div>
      </div>
      <div class="rounded-lg bg-gray-800 p-3">
        <div class="text-xs text-gray-400">Fehlgeschlagen</div>
        <div
          class="text-lg font-mono"
          :class="progress.failed_assets > 0 ? 'text-red-400' : 'text-white'"
        >
          {{ progress.failed_assets }}
        </div>
      </div>
    </div>

    <!-- Error Banner -->
    <div
      v-if="progress.error_message"
      class="mt-4 rounded-lg bg-red-900/40 border border-red-700 p-3 text-sm text-red-300"
    >
      {{ progress.error_message }}
    </div>
  </UCard>
</template>
