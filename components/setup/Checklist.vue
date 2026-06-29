<script setup lang="ts">
// Dashboard "Erste Schritte" card. Renders only while the instance is not yet
// fully set up; once complete it disappears. Shares state with the /setup
// wizard via useSetupStatus (same useFetch key).
const { steps, isComplete, status } = useSetupStatus();
</script>

<template>
  <UCard v-if="status !== 'pending' && !isComplete" class="ring-1 ring-primary/30">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-rocket-launch" class="w-5 h-5 text-primary" />
          <span class="text-base font-semibold text-white">Erste Schritte</span>
        </div>
        <UButton to="/setup" color="primary" size="sm" icon="i-heroicons-sparkles">
          Setup öffnen
        </UButton>
      </div>
    </template>

    <ul class="space-y-3">
      <li v-for="s in steps" :key="s.key" class="flex items-start gap-3">
        <UIcon
          :name="s.done ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'"
          :class="s.done ? 'text-green-500' : 'text-gray-600'"
          class="w-5 h-5 mt-0.5 shrink-0"
        />
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <NuxtLink :to="s.to" class="text-sm font-medium text-white hover:underline">
              {{ s.label }}
            </NuxtLink>
            <UBadge v-if="!s.required" color="neutral" variant="subtle" size="xs">
              optional
            </UBadge>
          </div>
          <p class="text-xs text-gray-500">{{ s.description }}</p>
        </div>
      </li>
    </ul>
  </UCard>
</template>
