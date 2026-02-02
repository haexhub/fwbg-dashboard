<script setup lang="ts">
defineProps<{
  appVersion: string;
  syncing: boolean;
}>();

const emit = defineEmits<{
  sync: [];
  refresh: [];
}>();
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="flex items-baseline gap-3">
      <h1 class="text-2xl font-bold text-white">FWBG Trading Dashboard</h1>
      <span class="text-xs text-gray-500">v{{ appVersion }}</span>
    </div>
    <div class="flex gap-2">
      <UButton
        icon="i-heroicons-cloud-arrow-down"
        :loading="syncing"
        @click="emit('sync')"
      >
        Sync IG
      </UButton>
      <UButton icon="i-heroicons-arrow-path" @click="emit('refresh')">
        Refresh
      </UButton>
      <NuxtLink to="/settings">
        <UButton icon="i-heroicons-cog-6-tooth" variant="ghost">
          Settings
        </UButton>
      </NuxtLink>
    </div>
  </div>
</template>
