<script setup lang="ts">
import { formatNumber } from "~/types/dashboard";

const props = defineProps<{
  avgWin: number;
  avgLoss: number;
}>();

const ratio = computed(() => {
  const absLoss = Math.abs(props.avgLoss);
  if (absLoss === 0) return 0;
  return Math.round((props.avgWin / absLoss) * 100) / 100;
});

// Bar widths as percentage — normalize to the larger value
const maxVal = computed(() =>
  Math.max(props.avgWin, Math.abs(props.avgLoss)),
);
const winWidth = computed(() =>
  maxVal.value > 0 ? (props.avgWin / maxVal.value) * 100 : 0,
);
const lossWidth = computed(() =>
  maxVal.value > 0 ? (Math.abs(props.avgLoss) / maxVal.value) * 100 : 0,
);
</script>

<template>
  <UCard>
    <div class="flex flex-col gap-1">
      <span class="text-sm text-gray-400">Avg Win/Loss Trade</span>
      <p
        :class="[
          'text-2xl font-bold',
          ratio >= 1 ? 'text-green-500' : 'text-red-500',
        ]"
      >
        {{ formatNumber(ratio, 2) }}
      </p>

      <div class="mt-1 flex flex-col gap-1.5">
        <!-- Avg Win bar -->
        <div class="flex items-center gap-2">
          <div class="h-3 rounded-sm bg-green-500" :style="{ width: winWidth + '%' }" />
          <span class="shrink-0 text-xs font-mono text-green-500">
            +{{ formatNumber(avgWin, 2) }}
          </span>
        </div>
        <!-- Avg Loss bar -->
        <div class="flex items-center gap-2">
          <div class="h-3 rounded-sm bg-red-500" :style="{ width: lossWidth + '%' }" />
          <span class="shrink-0 text-xs font-mono text-red-500">
            {{ formatNumber(avgLoss, 2) }}
          </span>
        </div>
      </div>
    </div>
  </UCard>
</template>
