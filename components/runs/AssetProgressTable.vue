<script setup lang="ts">
import type { AssetProgress, StageProgress } from "~/types/run-progress";
import { statusColor } from "~/types/strategy";

defineProps<{
  assets: AssetProgress[];
}>();

function currentStage(asset: AssetProgress): StageProgress | null {
  if (!asset.stages?.length) return null;
  return (
    asset.stages.find((s) => s.status === "running") ??
    asset.stages.filter((s) => s.status === "completed").pop() ??
    asset.stages[0] ??
    null
  );
}

function stageLabel(stage: StageProgress): string {
  const { details } = stage;
  if (details.fold != null && details.total_folds != null) {
    const base = stage.stage_name.replace(/_/g, " ");
    const foldPart = `Fold ${details.fold}/${details.total_folds}`;
    if (details.grid_pos != null && details.grid_total != null) {
      return `${foldPart} (${details.grid_pos}/${details.grid_total})`;
    }
    return foldPart;
  }
  if (details.grid_pos != null && details.grid_total != null) {
    return `${details.grid_pos}/${details.grid_total}`;
  }
  return stage.description || stage.stage_name.replace(/_/g, " ");
}

const STAGE_LABELS: Record<string, string> = {
  data_loading: "Data Loading",
  indicators: "Indicators",
  grid_search: "Grid Search",
  model_training: "Model Training",
  evaluation: "Evaluation",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold text-white">Asset Progress</h2>
    </template>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-gray-400 border-b border-gray-700">
            <th class="pb-2 pr-4">Symbol</th>
            <th class="pb-2 pr-4">Status</th>
            <th class="pb-2 pr-4">Stage</th>
            <th class="pb-2 pr-4">Fortschritt</th>
            <th class="pb-2">Dauer</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="asset in assets"
            :key="asset.symbol"
            class="border-b border-gray-800"
          >
            <td class="py-2 pr-4 font-medium text-white">
              {{ asset.symbol }}
            </td>
            <td class="py-2 pr-4">
              <UBadge :color="statusColor(asset.status)" variant="subtle">
                {{ asset.status }}
              </UBadge>
            </td>
            <td class="py-2 pr-4 text-gray-300">
              <template v-if="currentStage(asset)">
                <span class="text-gray-400">
                  {{ STAGE_LABELS[currentStage(asset)!.stage_name] ?? currentStage(asset)!.stage_name }}
                </span>
                <span class="ml-1.5 text-white">
                  {{ stageLabel(currentStage(asset)!) }}
                </span>
              </template>
              <template v-else-if="asset.result_summary">
                <span class="text-gray-400">{{ asset.result_summary }}</span>
              </template>
              <span v-else class="text-gray-600">—</span>
            </td>
            <td class="py-2 pr-4 w-32">
              <template v-if="currentStage(asset) && asset.status === 'running'">
                <div class="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    class="h-full bg-primary rounded-full transition-all duration-500"
                    :style="{
                      width: `${(currentStage(asset)!.progress_fraction * 100).toFixed(0)}%`,
                    }"
                  />
                </div>
              </template>
              <span v-else class="text-gray-600">—</span>
            </td>
            <td class="py-2 text-gray-400">
              {{ asset.duration_seconds > 0 ? formatDuration(asset.duration_seconds) : "—" }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!assets.length" class="py-6 text-center text-gray-500">
      Keine Assets
    </div>
  </UCard>
</template>
