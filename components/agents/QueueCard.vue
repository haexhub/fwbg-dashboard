<script setup lang="ts">
interface QueueStrategy {
  id: number;
  slug: string;
  strategy_family: string;
  asset_class: string | null;
  queue_position: number | null;
  created_at: string;
}

const toast = useToast();

const strategies = ref<QueueStrategy[]>([]);
const loading = ref(true);
const saving = ref(false);

async function fetchQueue() {
  try {
    const data = await $fetch<{ strategies: QueueStrategy[] }>("/api/agents/queue");
    strategies.value = data.strategies; // backend already sorts by nulls_last(queue_position), created_at
  } catch {
    toast.add({ title: "Fehler", description: "Backtest-Queue konnte nicht geladen werden.", color: "error" });
  } finally {
    loading.value = false;
  }
}

onMounted(fetchQueue);

// ── Drag & Drop ──────────────────────────────────────────────────────────────

const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

function onDragStart(index: number, event: DragEvent) {
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function onDragOver(index: number, event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  dragOverIndex.value = index;
}

function onDragLeave() {
  dragOverIndex.value = null;
}

function onDragEnd() {
  dragIndex.value = null;
  dragOverIndex.value = null;
}

async function onDrop(targetIndex: number, event: DragEvent) {
  event.preventDefault();
  const from = dragIndex.value;
  dragIndex.value = null;
  dragOverIndex.value = null;

  if (from === null || from === targetIndex) return;

  // Optimistic update: reorder locally
  const updated = [...strategies.value];
  const moved = updated.splice(from, 1)[0];
  if (!moved) return;
  updated.splice(targetIndex, 0, moved);
  const previous = strategies.value;
  strategies.value = updated;

  saving.value = true;
  try {
    await $fetch("/api/agents/queue", {
      method: "PUT",
      body: { order: updated.map((s) => s.id) },
    });
  } catch {
    // Rollback on error
    strategies.value = previous;
    toast.add({ title: "Fehler", description: "Reihenfolge konnte nicht gespeichert werden.", color: "error" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-400">Backtest-Queue (PROPOSED)</h3>
        <UBadge v-if="saving" color="warning" variant="subtle" size="xs">
          Speichern...
        </UBadge>
        <UBadge v-else-if="!loading" color="neutral" variant="subtle" size="xs">
          {{ strategies.length }} Strategie{{ strategies.length !== 1 ? "n" : "" }}
        </UBadge>
      </div>
    </template>

    <div v-if="loading" class="py-8 text-center text-gray-500 text-sm">
      Lade Queue...
    </div>

    <div v-else-if="strategies.length === 0" class="py-8 text-center text-gray-500 text-sm">
      Keine Strategien in der Queue.
    </div>

    <div v-else class="divide-y divide-gray-800">
      <div
        v-for="(strategy, index) in strategies"
        :key="strategy.id"
        draggable="true"
        class="flex items-center gap-3 py-3 -mx-4 px-4 transition-colors select-none"
        :class="{
          'opacity-50': dragIndex === index,
          'bg-gray-800/60 border-t-2 border-primary-500': dragOverIndex === index && dragIndex !== index,
          'hover:bg-gray-900/50': dragIndex === null,
          'cursor-grabbing': dragIndex === index,
          'cursor-grab': dragIndex === null,
        }"
        @dragstart="onDragStart(index, $event)"
        @dragover="onDragOver(index, $event)"
        @dragleave="onDragLeave"
        @dragend="onDragEnd"
        @drop="onDrop(index, $event)"
      >
        <!-- Drag handle -->
        <UIcon name="i-lucide-grip-vertical" class="text-gray-600 shrink-0 w-4 h-4" />

        <!-- Rank -->
        <span class="text-xs text-gray-500 font-mono w-6 shrink-0 text-right">
          #{{ index + 1 }}
        </span>

        <!-- Slug (link) -->
        <NuxtLink
          :to="`/agents/strategies/${strategy.id}`"
          class="flex-1 text-sm text-white font-medium hover:text-primary-400 transition-colors truncate"
          @click.stop
        >
          {{ strategy.slug }}
        </NuxtLink>

        <!-- Asset class -->
        <UBadge
          color="neutral"
          variant="subtle"
          size="xs"
          class="shrink-0"
        >
          {{ strategy.asset_class ?? "agnostic" }}
        </UBadge>

        <!-- Strategy family -->
        <UBadge
          color="primary"
          variant="subtle"
          size="xs"
          class="shrink-0"
        >
          {{ strategy.strategy_family }}
        </UBadge>
      </div>
    </div>
  </UCard>
</template>
