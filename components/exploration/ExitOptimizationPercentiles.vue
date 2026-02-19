<script setup lang="ts">
import type { DirectionPercentiles } from "~/types/exploration";

const props = defineProps<{
  direction: string;
  percentiles: DirectionPercentiles;
}>();

const rows = computed(() => {
  const pcts = ["10", "25", "50", "60", "75", "85", "90", "95"];
  return pcts.map((p) => ({
    percentile: `P${p}`,
    mfe: props.percentiles.mfe_percentiles[p]?.toFixed(4) ?? "-",
    mae: props.percentiles.mae_percentiles[p]?.toFixed(4) ?? "-",
  }));
});
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-lg font-medium text-white">
        MFE/MAE Percentile — {{ direction }}
      </h3>
    </template>

    <table class="w-full text-sm">
      <thead>
        <tr class="text-left text-gray-400 border-b border-gray-800">
          <th class="pb-2 pr-4">Percentile</th>
          <th class="pb-2 pr-4 text-right">MFE (ATR)</th>
          <th class="pb-2 text-right">MAE (ATR)</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.percentile"
          class="border-b border-gray-800/50"
        >
          <td class="py-1.5 pr-4 text-white font-mono">{{ row.percentile }}</td>
          <td class="py-1.5 pr-4 text-right text-green-400 font-mono">
            {{ row.mfe }}
          </td>
          <td class="py-1.5 text-right text-red-400 font-mono">
            {{ row.mae }}
          </td>
        </tr>
      </tbody>
    </table>
  </UCard>
</template>
