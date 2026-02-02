<script setup lang="ts">
import type { Account } from "~/types/dashboard";

const props = defineProps<{
  accounts: Account[];
  togglingAccount: string | null;
}>();

const emit = defineEmits<{
  toggle: [accountId: string];
}>();
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
    <UCard v-for="acc in accounts" :key="acc.id">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            :class="[
              'w-3 h-3 rounded-full',
              acc.isActive ? 'bg-green-500' : 'bg-gray-500',
            ]"
          />
          <div>
            <p class="text-lg font-semibold text-white">{{ acc.name }}</p>
            <p class="text-xs text-gray-500">
              {{ acc.accType }} | {{ acc.pairsCount }} Pairs
            </p>
          </div>
        </div>
        <UButton
          :color="acc.isActive ? 'success' : 'neutral'"
          :variant="acc.isActive ? 'solid' : 'outline'"
          :loading="togglingAccount === acc.id"
          size="sm"
          @click="emit('toggle', acc.id)"
        >
          {{ acc.isActive ? "Aktiv" : "Inaktiv" }}
        </UButton>
      </div>
    </UCard>
  </div>
</template>
