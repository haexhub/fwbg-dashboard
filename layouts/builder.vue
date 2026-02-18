<script setup lang="ts">
const { appVersion } = useRuntimeConfig().public;

function refreshAll() {
  refreshNuxtData();
}
</script>

<template>
  <div class="h-screen bg-gray-950 flex flex-col overflow-hidden">
    <!-- Sticky Header -->
    <header class="shrink-0 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800/50">
      <div class="px-8 py-4">
        <DashboardHeader
          :app-version="appVersion"
          @refresh="refreshAll"
        />
      </div>
    </header>

    <!-- Full-bleed content (no max-width, fills viewport) -->
    <main class="flex-1 min-h-0 px-8 py-4">
      <slot />
    </main>
  </div>
</template>
