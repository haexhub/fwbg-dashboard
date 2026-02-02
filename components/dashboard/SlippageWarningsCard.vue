<script setup lang="ts">
import type { SlippageWarning } from "~/types/dashboard";

defineProps<{
  warnings: (SlippageWarning & { accountName: string })[];
}>();
</script>

<template>
  <UCard
    v-if="warnings.length > 0"
    class="border-2 border-orange-500 bg-orange-950/30"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon
          name="i-heroicons-exclamation-triangle"
          class="w-6 h-6 text-orange-500"
        />
        <h2 class="text-lg font-bold text-orange-500">
          Slippage-Warnungen ({{ warnings.length }})
        </h2>
      </div>
    </template>

    <div class="space-y-2">
      <div
        v-for="(warning, idx) in warnings"
        :key="idx"
        class="flex items-center justify-between p-3 bg-orange-900/20 rounded-lg border border-orange-800"
      >
        <div class="flex items-center gap-4">
          <UBadge
            :color="warning.direction === 'BUY' ? 'success' : 'error'"
            size="sm"
          >
            {{ warning.direction }}
          </UBadge>
          <span class="font-semibold text-white">{{ warning.symbol }}</span>
          <span class="text-gray-400 text-sm">{{ warning.accountName }}</span>
        </div>
        <div class="flex items-center gap-6 text-sm">
          <div class="text-gray-400">
            <span class="text-gray-500">Erwartet:</span>
            {{ warning.expected_price?.toFixed(5) }}
          </div>
          <div class="text-gray-400">
            <span class="text-gray-500">Ausgeführt:</span>
            {{ warning.actual_price?.toFixed(5) }}
          </div>
          <div class="text-orange-400 font-bold">
            {{ warning.slippage_pct?.toFixed(2) }}% Slippage
          </div>
          <div class="text-gray-500 text-xs">
            {{ new Date(warning.timestamp).toLocaleString("de-DE") }}
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
