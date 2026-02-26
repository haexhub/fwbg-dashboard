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
const timestampFormat = ref("auto");  // "auto", "unix_s", "unix_ms"
const timezone = ref("");

// Auto-detect columns by common names
watch(columns, (cols) => {
  const find = (...names: string[]) =>
    cols.find((c) => names.some((n) => c.toLowerCase() === n.toLowerCase())) ?? "";
  dateCol.value = find("date", "datetime", "time", "timestamp", "t");
  openCol.value = find("open", "o");
  highCol.value = find("high", "h");
  lowCol.value = find("low", "l");
  closeCol.value = find("close", "c");
  volumeCol.value = find("volume", "vol", "v");
}, { immediate: true });

// Timestamp format auto-detection
type TimestampHint = { format: string; label: string };

function detectTimestampFormat(values: unknown[]): TimestampHint {
  const nums = values.map(Number).filter((n) => !isNaN(n) && n > 0);
  if (nums.length === 0) return { format: "auto", label: "ISO / String" };
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  if (avg > 1e12) return { format: "unix_ms", label: "Unix Millisekunden" };
  if (avg > 1e9) return { format: "unix_s", label: "Unix Sekunden" };
  return { format: "auto", label: "ISO / String" };
}

const timestampHint = computed<TimestampHint>(() => {
  if (!preview.value || !dateCol.value) return { format: "auto", label: "—" };
  const colIdx = columns.value.indexOf(dateCol.value);
  if (colIdx === -1) return { format: "auto", label: "—" };
  const values = preview.value.rows.map((row: unknown[]) => row[colIdx]);
  return detectTimestampFormat(values);
});

// Apply hint when date column changes
watch([dateCol, () => preview.value], () => {
  timestampFormat.value = timestampHint.value.format;
});

const timestampFormatOptions = [
  { label: "Automatisch (ISO)", value: "auto" },
  { label: "Unix Sekunden", value: "unix_s" },
  { label: "Unix Millisekunden", value: "unix_ms" },
];

// Transformed preview (client-side)
const transformedPreview = computed(() => {
  if (!preview.value || !dateCol.value) return null;
  const cols = columns.value;
  const dIdx = cols.indexOf(dateCol.value);
  const oIdx = cols.indexOf(openCol.value);
  const hIdx = cols.indexOf(highCol.value);
  const lIdx = cols.indexOf(lowCol.value);
  const cIdx = cols.indexOf(closeCol.value);
  const vIdx = volumeCol.value ? cols.indexOf(volumeCol.value) : -1;
  if ([dIdx, oIdx, hIdx, lIdx, cIdx].some((i) => i === -1)) return null;

  const rows = preview.value.rows.map((row: unknown[]) => {
    let t = String(row[dIdx] ?? "");
    if (timestampFormat.value === "unix_ms") {
      const d = new Date(Number(t));
      t = isNaN(d.getTime()) ? t : d.toISOString().replace("T", " ").slice(0, 19);
    } else if (timestampFormat.value === "unix_s") {
      const d = new Date(Number(t) * 1000);
      t = isNaN(d.getTime()) ? t : d.toISOString().replace("T", " ").slice(0, 19);
    }
    return [
      t,
      row[oIdx],
      row[hIdx],
      row[lIdx],
      row[cIdx],
      vIdx >= 0 ? row[vIdx] : 0,
    ];
  });
  return { columns: ["T", "O", "H", "L", "C", "V"], rows };
});

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
        timestamp_format: timestampFormat.value === "auto" ? undefined : timestampFormat.value,
        timezone: timezone.value || undefined,
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
      <!-- Raw preview table -->
      <div class="text-xs text-gray-500 mb-1">Rohdaten</div>
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

      <!-- Timestamp handling -->
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Timestamp-Format">
          <USelect v-model="timestampFormat" :items="timestampFormatOptions" />
          <p v-if="timestampHint.format !== 'auto'" class="text-xs text-blue-400 mt-1">
            Erkannt: {{ timestampHint.label }}
          </p>
        </UFormField>
        <UFormField label="Zeitzone (optional)">
          <UInput v-model="timezone" placeholder="Europe/Berlin" class="font-mono" />
          <p class="text-xs text-gray-500 mt-1">Leer = UTC</p>
        </UFormField>
      </div>

      <!-- Transformed preview -->
      <template v-if="transformedPreview">
        <div class="text-xs text-gray-500 mb-1">Vorschau (transformiert)</div>
        <div class="overflow-x-auto rounded border border-blue-900/40">
          <table class="w-full text-xs">
            <thead>
              <tr>
                <th
                  v-for="col in transformedPreview.columns"
                  :key="col"
                  class="bg-blue-950/30 px-2 py-1 text-left font-mono text-blue-300"
                >
                  {{ col }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in transformedPreview.rows" :key="i" class="border-t border-blue-900/30">
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
      </template>

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
