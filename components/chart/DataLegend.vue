<script setup lang="ts">
import type { CrosshairData } from "./Canvas.vue";

defineProps<{
  data: CrosshairData | null;
  pricePrecision: number;
}>();

function formatVol(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return String(Math.round(v));
}
</script>

<template>
  <div
    v-if="data"
    class="shrink-0 flex items-center gap-4 px-3 py-1 text-xs font-mono text-gray-400 border-b border-gray-800/30"
  >
    <span>O <span class="text-gray-200">{{ data.open.toFixed(pricePrecision) }}</span></span>
    <span>H <span class="text-gray-200">{{ data.high.toFixed(pricePrecision) }}</span></span>
    <span>L <span class="text-gray-200">{{ data.low.toFixed(pricePrecision) }}</span></span>
    <span>C <span class="text-gray-200">{{ data.close.toFixed(pricePrecision) }}</span></span>
    <span v-if="data.volume > 0">Vol <span class="text-gray-200">{{ formatVol(data.volume) }}</span></span>
    <span
      :class="data.change >= 0 ? 'text-green-400' : 'text-red-400'"
    >
      {{ data.change >= 0 ? "+" : "" }}{{ data.change.toFixed(pricePrecision) }}
      ({{ data.changePercent >= 0 ? "+" : "" }}{{ data.changePercent.toFixed(2) }}%)
    </span>
  </div>
</template>
