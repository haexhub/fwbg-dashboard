<script setup lang="ts">
defineProps<{
  appVersion: string;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const route = useRoute();

const navItems = [
  { label: "Dashboard", to: "/", icon: "i-heroicons-home" },
  { label: "Chart", to: "/chart", icon: "i-heroicons-chart-bar-square" },
  { label: "Strategies", to: "/strategy", icon: "i-heroicons-puzzle-piece" },
  { label: "Runs", to: "/runs", icon: "i-heroicons-play-circle" },
  { label: "Exploration", to: "/exploration", icon: "i-heroicons-magnifying-glass-circle" },
  { label: "Plugins", to: "/plugins", icon: "i-heroicons-cube" },
  { label: "Datenquellen", to: "/datasources", icon: "i-heroicons-circle-stack" },
  { label: "Presets", to: "/presets", icon: "i-heroicons-bookmark-square" },
  { label: "AI", to: "/ai", icon: "i-heroicons-sparkles" },
];

function isActive(to: string): boolean {
  if (to === "/") return route.path === "/";
  return route.path.startsWith(to);
}

// Accounts — only show sync button when accounts are configured
const { data: accountsData } = useFetch<{ accounts: { id: string }[] }>(
  "/api/accounts",
  { default: () => ({ accounts: [] }) }
);

const hasAccounts = computed(
  () => (accountsData.value?.accounts?.length ?? 0) > 0
);

const syncing = ref(false);

async function syncAccounts() {
  syncing.value = true;
  try {
    await $fetch("/api/sync", { method: "POST" });
  } catch (e) {
    console.error("Sync failed:", e);
  } finally {
    syncing.value = false;
  }
}
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-6">
      <div class="flex items-baseline gap-3">
        <h1 class="text-2xl font-bold text-white">FWBG</h1>
        <span class="text-xs text-gray-500">v{{ appVersion }}</span>
      </div>
      <nav class="flex gap-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
        >
          <UButton
            :icon="item.icon"
            :variant="isActive(item.to) ? 'soft' : 'ghost'"
          >
            {{ item.label }}
          </UButton>
        </NuxtLink>
      </nav>
    </div>
    <div class="flex gap-2">
      <UButton
        v-if="hasAccounts"
        icon="i-heroicons-cloud-arrow-down"
        :loading="syncing"
        @click="syncAccounts"
      >
        Sync
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
