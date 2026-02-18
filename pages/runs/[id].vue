<script setup lang="ts">
import { statusColor, formatWinRate, formatPnl } from "~/types/strategy";
import type { RunDetail } from "~/types/strategy";

const route = useRoute();
const runId = computed(() => route.params.id as string);

const { getRunDetail, cancelRun } = useRuns();

const detail = ref<RunDetail | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    detail.value = await getRunDetail(runId.value);
  } catch {
    // Run not found
  } finally {
    loading.value = false;
  }
});

const assetList = computed(() => {
  if (!detail.value?.assets) return [];
  return Object.values(detail.value.assets).sort((a, b) =>
    a.symbol.localeCompare(b.symbol)
  );
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink to="/runs">
          <UButton icon="i-heroicons-arrow-left" variant="ghost" size="sm" />
        </NuxtLink>
        <h2 class="text-xl font-semibold text-white font-mono">
          {{ runId }}
        </h2>
        <UBadge
          v-if="detail"
          :color="statusColor(detail.status)"
          variant="subtle"
        >
          {{ detail.status }}
        </UBadge>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-16 text-center text-gray-400">
      Loading run...
    </div>

    <!-- Not found -->
    <div v-else-if="!detail" class="py-16 text-center text-gray-400">
      Run "{{ runId }}" not found.
    </div>

    <template v-else>
      <!-- Strategy Info -->
      <UCard v-if="detail.strategy">
        <template #header>
          <h3 class="text-sm font-medium text-gray-400">Strategy</h3>
        </template>
        <div class="space-y-1">
          <p class="text-white font-medium">{{ detail.strategy.name }}</p>
          <p v-if="detail.strategy.description" class="text-sm text-gray-400">
            {{ detail.strategy.description }}
          </p>
        </div>
      </UCard>

      <!-- Asset Results -->
      <UCard v-if="assetList.length">
        <template #header>
          <h3 class="text-sm font-medium text-gray-400">
            Assets ({{ assetList.length }})
          </h3>
        </template>
        <div class="divide-y divide-gray-800">
          <div
            v-for="asset in assetList"
            :key="asset.symbol"
            class="flex items-center justify-between py-2 px-1"
          >
            <div class="flex items-center gap-3">
              <span class="font-mono text-white text-sm">{{ asset.symbol }}</span>
              <UBadge
                :color="asset.status === 'ok' ? 'success' : asset.status === 'error' ? 'error' : 'warning'"
                variant="subtle"
                size="xs"
              >
                {{ asset.status }}
              </UBadge>
            </div>
            <div class="flex gap-6 text-sm text-gray-400">
              <span v-if="asset.walk_forward.total_trades">
                {{ asset.walk_forward.total_trades }} trades
              </span>
              <span v-if="asset.walk_forward.mean_win_rate">
                WR: {{ formatWinRate(asset.walk_forward.mean_win_rate) }}
              </span>
              <span v-if="asset.walk_forward.mean_pnl != null">
                PnL: {{ formatPnl(asset.walk_forward.mean_pnl) }}
              </span>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
