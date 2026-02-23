<script setup lang="ts">
import { statusColor } from "~/types/strategy";

const { runs, status, refresh } = useRuns();

// ── Single delete ──
const confirmDeleteId = ref<string | null>(null);
const deleteModalOpen = computed({
  get: () => confirmDeleteId.value !== null,
  set: (v) => { if (!v) confirmDeleteId.value = null; },
});

// ── Multi-select ──
const selected = ref<Set<string>>(new Set());

const allSelected = computed(() =>
  !!runs.value?.length && runs.value.every((r) => selected.value.has(r.run_id))
);

function toggleAll() {
  if (allSelected.value) {
    selected.value = new Set();
  } else {
    selected.value = new Set(runs.value?.map((r) => r.run_id) ?? []);
  }
}

function toggleOne(runId: string) {
  const s = new Set(selected.value);
  if (s.has(runId)) s.delete(runId);
  else s.add(runId);
  selected.value = s;
}

// ── Bulk delete ──
const bulkDeleteModalOpen = ref(false);
const deleting = ref(false);

async function confirmDelete() {
  deleting.value = true;
  try {
    if (confirmDeleteId.value) {
      // Single delete
      await $fetch(`/api/runs/${confirmDeleteId.value}`, { method: "DELETE" });
      confirmDeleteId.value = null;
    } else {
      // Bulk delete
      await Promise.all(
        [...selected.value].map((id) =>
          $fetch(`/api/runs/${id}`, { method: "DELETE" })
        )
      );
      selected.value = new Set();
      bulkDeleteModalOpen.value = false;
    }
    await refresh();
  } finally {
    deleting.value = false;
  }
}

function formatDate(ts?: string): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">Runs</h2>
      <div class="flex items-center gap-2">
        <UButton
          v-if="selected.size > 0"
          icon="i-heroicons-trash"
          color="error"
          variant="ghost"
          @click="bulkDeleteModalOpen = true"
        >
          {{ selected.size }} löschen
        </UButton>
        <UButton icon="i-heroicons-arrow-path" variant="ghost" @click="refresh()">
          Refresh
        </UButton>
      </div>
    </div>

    <UCard>
      <div v-if="status === 'pending'" class="py-8 text-center text-gray-400">
        Loading runs...
      </div>
      <div v-else-if="!runs?.length" class="py-8 text-center text-gray-400">
        No runs found.
      </div>
      <div v-else class="divide-y divide-gray-800">
        <!-- Header row with select-all -->
        <div class="flex items-center gap-4 px-4 py-2">
          <UCheckbox :model-value="allSelected" @update:model-value="toggleAll" />
          <span class="text-xs text-gray-500">Alle auswählen</span>
        </div>

        <div
          v-for="run in runs"
          :key="run.run_id"
          class="group flex items-center justify-between px-4 py-3 hover:bg-gray-900/50 transition-colors"
        >
          <div class="flex items-center gap-4 min-w-0 flex-1">
            <UCheckbox
              :model-value="selected.has(run.run_id)"
              @update:model-value="toggleOne(run.run_id)"
              @click.stop
            />
            <UBadge :color="statusColor(run.status)" variant="subtle">
              {{ run.status }}
            </UBadge>
            <div class="min-w-0">
              <NuxtLink
                :to="`/runs/${run.run_id}`"
                class="text-white font-mono text-sm hover:text-blue-400 transition-colors"
              >
                {{ run.run_id }}
              </NuxtLink>
              <p v-if="run.strategy_name" class="text-sm text-gray-400 truncate">
                {{ run.strategy_name }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-4 text-sm text-gray-400">
            <span>{{ formatDate(run.timestamp || run.started_at) }}</span>
            <span v-if="run.asset_count != null">
              {{ run.profitable_count ?? 0 }}/{{ run.asset_count }} profitable
            </span>
            <UButton
              icon="i-heroicons-trash"
              variant="ghost"
              color="error"
              class="opacity-0 group-hover:opacity-100 transition-opacity"
              @click.prevent="confirmDeleteId = run.run_id"
            />
          </div>
        </div>
      </div>
    </UCard>

    <!-- Single delete confirmation -->
    <UModal v-model:open="deleteModalOpen">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-base font-semibold text-white">Run löschen?</h3>
          <p class="text-sm text-gray-400">
            Alle Ergebnisse für Run <span class="font-mono text-white">{{ confirmDeleteId }}</span> werden unwiderruflich von der Festplatte gelöscht.
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" @click="confirmDeleteId = null">Abbrechen</UButton>
            <UButton color="error" :loading="deleting" @click="confirmDelete">Löschen</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Bulk delete confirmation -->
    <UModal v-model:open="bulkDeleteModalOpen">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-base font-semibold text-white">{{ selected.size }} Runs löschen?</h3>
          <p class="text-sm text-gray-400">
            Alle Ergebnisse der ausgewählten {{ selected.size }} Runs werden unwiderruflich von der Festplatte gelöscht.
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" @click="bulkDeleteModalOpen = false">Abbrechen</UButton>
            <UButton color="error" :loading="deleting" @click="confirmDelete">Alle löschen</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
