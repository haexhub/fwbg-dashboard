<script setup lang="ts">
const { appVersion } = useRuntimeConfig().public;

function refreshAll() {
  refreshNuxtData();
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 flex flex-col">
    <!-- Sticky Header -->
    <header class="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800/50">
      <div class="max-w-[1600px] mx-auto px-8 py-4">
        <DashboardHeader
          :app-version="appVersion"
          @refresh="refreshAll"
        />
      </div>
    </header>

    <!-- Page Content -->
    <main class="flex-1">
      <div class="max-w-[1600px] mx-auto px-8 py-6">
        <slot />
      </div>
    </main>
  </div>
</template>
