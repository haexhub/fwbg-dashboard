<script setup lang="ts">
interface HistoryEntry {
  hash: string;
  short_hash: string;
  date: string;
  message: string;
}

const props = defineProps<{
  strategyName: string;
}>();

const emit = defineEmits<{
  restore: [config: Record<string, unknown>];
}>();

const open = defineModel<boolean>("open");

const loading = ref(false);
const history = ref<HistoryEntry[]>([]);
const restoring = ref<string | null>(null);
const error = ref<string | null>(null);

watch(open, async (isOpen) => {
  if (isOpen) await loadHistory();
});

async function loadHistory() {
  loading.value = true;
  error.value = null;
  try {
    history.value = await $fetch<HistoryEntry[]>(
      `/api/strategy/strategies/${props.strategyName}/history`,
    );
  } catch (e) {
    error.value = "Versionsverlauf konnte nicht geladen werden.";
  } finally {
    loading.value = false;
  }
}

async function restoreVersion(hash: string) {
  restoring.value = hash;
  try {
    const config = await $fetch<Record<string, unknown>>(
      `/api/strategy/strategies/${props.strategyName}/version/${hash}`,
    );
    emit("restore", config);
    open.value = false;
  } catch {
    error.value = "Version konnte nicht geladen werden.";
  } finally {
    restoring.value = null;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <UModal v-model:open="open" :ui="{ content: 'max-w-xl' }">
    <template #header>
      <h3 class="text-base font-semibold text-white">
        Versionsverlauf —
        <span class="font-mono text-gray-300">{{ strategyName }}</span>
      </h3>
    </template>

    <template #body>
      <div v-if="loading" class="py-8 text-center text-gray-400">Lade Verlauf…</div>
      <div v-else-if="error" class="py-4 text-center text-red-400 text-sm">{{ error }}</div>
      <div v-else-if="!history.length" class="py-8 text-center text-gray-500 text-sm">
        Keine Git-History verfügbar.
      </div>
      <div v-else class="divide-y divide-gray-800">
        <div
          v-for="(entry, idx) in history"
          :key="entry.hash"
          class="flex items-start gap-3 py-3"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs text-gray-500">{{ entry.short_hash }}</span>
              <UBadge v-if="idx === 0" color="success" variant="subtle" size="xs">aktuell</UBadge>
            </div>
            <p class="text-sm text-white truncate mt-0.5">{{ entry.message }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ formatDate(entry.date) }}</p>
          </div>
          <UButton
            v-if="idx > 0"
            size="xs"
            variant="ghost"
            icon="i-heroicons-arrow-uturn-left"
            :loading="restoring === entry.hash"
            @click="restoreVersion(entry.hash)"
          >
            Wiederherstellen
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
