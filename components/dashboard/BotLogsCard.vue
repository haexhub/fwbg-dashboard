<script setup lang="ts">
import type { LogsData } from "~/types/dashboard";

const props = defineProps<{
  logs: LogsData | null;
}>();

const emit = defineEmits<{
  refresh: [];
  clear: [];
}>();

const clearing = ref(false);

const clearLogs = async () => {
  if (!confirm("Alle Bot-Logs wirklich löschen?")) return;

  clearing.value = true;
  try {
    await fetch("/api/logs", { method: "DELETE" });
    emit("refresh");
  } catch (error) {
    console.error("Failed to clear logs:", error);
    alert(
      `Logs löschen fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    clearing.value = false;
  }
};
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold text-white">Bot Logs</h2>
          <UBadge v-if="logs?.fileSize" color="neutral" variant="subtle">
            {{ (logs.fileSize / 1024 / 1024).toFixed(2) }} MB
          </UBadge>
        </div>
        <UButton
          size="sm"
          color="error"
          variant="ghost"
          icon="i-heroicons-trash"
          :loading="clearing"
          @click="clearLogs"
        >
          Logs löschen
        </UButton>
      </div>
    </template>

    <div class="h-96 overflow-y-auto bg-gray-900 rounded p-3 font-mono text-xs">
      <div
        v-for="(line, i) in logs?.logs"
        :key="i"
        :class="[
          'py-0.5',
          line.includes('ERROR')
            ? 'text-red-400'
            : line.includes('WARNING')
              ? 'text-yellow-400'
              : 'text-gray-300',
        ]"
      >
        {{ line }}
      </div>
    </div>
  </UCard>
</template>
