<script setup lang="ts">
import type { SuggestedExitGrid } from "~/types/exploration";

defineProps<{
  suggestedGrid: SuggestedExitGrid;
}>();

const emit = defineEmits<{
  apply: [];
}>();
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-medium text-white">Suggested Grid</h3>
        <UButton
          icon="i-heroicons-arrow-up-tray"
          size="sm"
          variant="soft"
          @click="emit('apply')"
        >
          In Strategie übernehmen
        </UButton>
      </div>
    </template>

    <div class="space-y-4">
      <div class="flex flex-wrap gap-3">
        <div>
          <span class="text-sm text-gray-400">Take Profit (ATR)</span>
          <div class="mt-1 flex gap-2">
            <UBadge
              v-for="tp in suggestedGrid.tp"
              :key="tp"
              variant="subtle"
              color="success"
              size="md"
            >
              {{ tp }}
            </UBadge>
          </div>
        </div>
        <div>
          <span class="text-sm text-gray-400">Stop Loss (ATR)</span>
          <div class="mt-1 flex gap-2">
            <UBadge
              v-for="sl in suggestedGrid.sl"
              :key="sl"
              variant="subtle"
              color="error"
              size="md"
            >
              {{ sl }}
            </UBadge>
          </div>
        </div>
      </div>
      <p class="text-sm text-gray-400">{{ suggestedGrid.reasoning }}</p>
    </div>
  </UCard>
</template>
