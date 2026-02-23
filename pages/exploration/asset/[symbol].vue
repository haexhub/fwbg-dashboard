<script setup lang="ts">
import type { ExitOptimizationResult } from "~/types/exploration";

const route = useRoute();
const symbol = computed(() => route.params.symbol as string);

const { data: result, status } = useFetch<ExitOptimizationResult>(
  () => `/api/exploration/exit-optimization/${symbol.value}`,
  { default: () => null as unknown as ExitOptimizationResult }
);

const applyModalOpen = ref(false);

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
    <!-- Header -->
    <div class="flex items-center gap-4">
      <NuxtLink to="/exploration">
        <UButton icon="i-heroicons-arrow-left" variant="ghost" />
      </NuxtLink>
      <div>
        <h2 class="text-xl font-semibold text-white">{{ symbol }}</h2>
        <p v-if="result" class="text-sm text-gray-400">
          {{ result.timeframe }} &middot; {{ result.exit_strategy }} &middot;
          {{ formatDate(result.analyzed_at) }}
        </p>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="status === 'pending'" class="py-8 text-center text-gray-400">
      Lade Ergebnis...
    </div>

    <!-- Error state -->
    <UCard v-else-if="!result" class="text-center text-gray-400 py-8">
      Kein Ergebnis gefunden.
    </UCard>

    <!-- Result sections -->
    <template v-else>
      <!-- Metadata -->
      <UCard>
        <div class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <span class="text-gray-400">Datei</span>
            <p class="text-white font-mono">{{ result.data_file }}</p>
          </div>
          <div>
            <span class="text-gray-400">Bars analysiert</span>
            <p class="text-white">{{ result.bars_analyzed }}</p>
          </div>
          <div>
            <span class="text-gray-400">Max. Bars forward</span>
            <p class="text-white">{{ result.max_bars_forward }}</p>
          </div>
          <div>
            <span class="text-gray-400">Exit-Params</span>
            <p class="text-white font-mono text-xs">
              {{ JSON.stringify(result.exit_params) }}
            </p>
          </div>
        </div>
      </UCard>

      <!-- Suggested Grid -->
      <ExplorationExitOptimizationSuggestedGrid
        :suggested-grid="result.suggested_grid"
        @apply="applyModalOpen = true"
      />

      <!-- Apply Grid Modal -->
      <ExplorationApplyGridModal
        :open="applyModalOpen"
        :result="result"
        :symbol="symbol"
        @update:open="applyModalOpen = $event"
      />

      <!-- MFE/MAE Percentiles -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ExplorationExitOptimizationPercentiles
          direction="Long"
          :percentiles="result.mfe_mae.long"
        />
        <ExplorationExitOptimizationPercentiles
          direction="Short"
          :percentiles="result.mfe_mae.short"
        />
      </div>

      <!-- Capture Matrix -->
      <ExplorationExitOptimizationCaptureMatrix
        :capture-matrix="result.capture_matrix"
      />
    </template>
  </div>
</template>
