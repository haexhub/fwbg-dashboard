<script setup lang="ts">
const props = defineProps<{
  sourceName: string;
  filename: string;
}>();

const emit = defineEmits<{
  done: [];
  cancel: [];
}>();

// Load preview
const { data: preview, status } = await useFetch<{ columns: string[]; rows: unknown[][] }>(
  `/api/datasources/${props.sourceName}/raw/${encodeURIComponent(props.filename)}/preview`,
);

const columns = computed(() => preview.value?.columns ?? []);

const symbol = ref("");
const timeframe = ref("");
const dateCol = ref("");
const openCol = ref("");
const highCol = ref("");
const lowCol = ref("");
const closeCol = ref("");
const volumeCol = ref("");

// Auto-detect columns by common names
watch(columns, (cols) => {
  const find = (...names: string[]) =>
    cols.find((c) => names.some((n) => c.toLowerCase() === n.toLowerCase())) ?? "";
  dateCol.value = find("date", "datetime", "time", "timestamp");
  openCol.value = find("open", "o");
  highCol.value = find("high", "h");
  lowCol.value = find("low", "l");
  closeCol.value = find("close", "c");
  volumeCol.value = find("volume", "vol", "v");
}, { immediate: true });

const processing = ref(false);
const error = ref<string | null>(null);

const canSubmit = computed(
  () => symbol.value && timeframe.value && dateCol.value && openCol.value &&
        highCol.value && lowCol.value && closeCol.value,
);

async function submit() {
  processing.value = true;
  error.value = null;
  try {
    await $fetch(`/api/datasources/${props.sourceName}/process`, {
      method: "POST",
      body: {
        filename: props.filename,
        symbol: symbol.value.toUpperCase(),
        timeframe: timeframe.value.toUpperCase(),
        date_col: dateCol.value,
        open_col: openCol.value,
        high_col: highCol.value,
        low_col: lowCol.value,
        close_col: closeCol.value,
        volume_col: volumeCol.value || undefined,
      },
    });
    emit("done");
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : "Verarbeitung fehlgeschlagen";
  } finally {
    processing.value = false;
  }
}

const colOptions = computed(() =>
  columns.value.map((c) => ({ label: c, value: c })),
);
</script>

<template>
  <div class="space-y-4">
    <div class="text-xs text-gray-400">
      Datei: <span class="font-mono text-gray-300">{{ filename }}</span>
    </div>

    <!-- Loading state -->
    <div v-if="status === 'pending'" class="text-sm text-gray-500">Vorschau wird geladen…</div>

    <template v-else-if="columns.length">
      <!-- Preview table -->
      <div class="overflow-x-auto rounded border border-gray-800">
        <table class="w-full text-xs">
          <thead>
            <tr>
              <th
                v-for="col in columns"
                :key="col"
                class="bg-gray-800 px-2 py-1 text-left font-mono text-gray-400"
              >
                {{ col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in preview?.rows" :key="i" class="border-t border-gray-800">
              <td
                v-for="(cell, j) in row"
                :key="j"
                class="px-2 py-1 font-mono text-gray-300"
              >
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Column mapping -->
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Symbol" required>
          <UInput v-model="symbol" placeholder="EURUSD" class="font-mono uppercase" />
        </UFormField>
        <UFormField label="Timeframe" required>
          <UInput v-model="timeframe" placeholder="H1" class="font-mono uppercase" />
        </UFormField>
        <UFormField label="Datum-Spalte" required>
          <USelect v-model="dateCol" :items="colOptions" placeholder="Spalte wählen" />
        </UFormField>
        <UFormField label="Open">
          <USelect v-model="openCol" :items="colOptions" placeholder="Spalte wählen" />
        </UFormField>
        <UFormField label="High">
          <USelect v-model="highCol" :items="colOptions" placeholder="Spalte wählen" />
        </UFormField>
        <UFormField label="Low">
          <USelect v-model="lowCol" :items="colOptions" placeholder="Spalte wählen" />
        </UFormField>
        <UFormField label="Close">
          <USelect v-model="closeCol" :items="colOptions" placeholder="Spalte wählen" />
        </UFormField>
        <UFormField label="Volume (optional)">
          <USelect v-model="volumeCol" :items="[{ label: '—', value: '' }, ...colOptions]" />
        </UFormField>
      </div>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="error"
        icon="i-heroicons-exclamation-triangle"
      />

      <div class="flex justify-end gap-2 pt-1">
        <UButton variant="ghost" @click="emit('cancel')">Abbrechen</UButton>
        <UButton :disabled="!canSubmit" :loading="processing" @click="submit">
          Verarbeiten
        </UButton>
      </div>
    </template>

    <div v-else class="text-sm text-red-400">Datei konnte nicht gelesen werden.</div>
  </div>
</template>
