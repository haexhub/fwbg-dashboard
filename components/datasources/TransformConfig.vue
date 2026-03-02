<script setup lang="ts">
import type { CSVSource, FileInfo } from "~/types/datasource";

const props = defineProps<{
  source: CSVSource;
}>();

const emit = defineEmits<{
  updated: [];
}>();

// ── Raw files ───────────────────────────────────────────────────────────────

const rawFiles = computed<FileInfo[]>(() => props.source.raw_files ?? []);

// ── Step 1: Pick a reference file for preview ───────────────────────────────

const selectedFile = ref(rawFiles.value[0]?.name ?? "");
const fileOptions = computed(() =>
  rawFiles.value.map((f: FileInfo) => ({ label: f.name, value: f.name })),
);

// Load preview for selected file
type PreviewData = { columns: string[]; rows: unknown[][] };
const previewUrl = computed(() =>
  selectedFile.value
    ? `/api/datasources/${props.source.name}/raw/${encodeURIComponent(selectedFile.value)}/preview`
    : "/api/_placeholder_",
);
const { data: rawPreview, status: previewStatus } = useLazyFetch(previewUrl);
const preview = computed<PreviewData | null>(() => {
  if (!selectedFile.value || !rawPreview.value) return null;
  return rawPreview.value as unknown as PreviewData;
});

const columns = computed<string[]>(() => preview.value?.columns ?? []);
const colOptions = computed(() =>
  columns.value.map((c: string) => ({ label: c, value: c })),
);

// ── Step 2: Column mapping (from preview data) ─────────────────────────────

type ColumnRole = "T" | "O" | "H" | "L" | "C" | "V";
const ROLES: { role: ColumnRole; label: string; required: boolean }[] = [
  { role: "T", label: "Timestamp", required: true },
  { role: "O", label: "Open", required: true },
  { role: "H", label: "High", required: true },
  { role: "L", label: "Low", required: true },
  { role: "C", label: "Close", required: true },
  { role: "V", label: "Volume", required: false },
];

const columnMapping = reactive<Record<ColumnRole, string>>({
  T: props.source.date_col ?? "",
  O: props.source.open_col ?? "",
  H: props.source.high_col ?? "",
  L: props.source.low_col ?? "",
  C: props.source.close_col ?? "",
  V: props.source.volume_col ?? "",
});

// Auto-detect columns when preview loads
watch(columns, (cols: string[]) => {
  // Only auto-detect if columns are currently empty (first load)
  if (columnMapping.T && cols.includes(columnMapping.T)) return;

  const find = (...names: string[]) =>
    cols.find((c: string) => names.some((n) => c.toLowerCase() === n.toLowerCase())) ?? "";
  columnMapping.T = find("date", "datetime", "time", "timestamp", "t");
  columnMapping.O = find("open", "o");
  columnMapping.H = find("high", "h");
  columnMapping.L = find("low", "l");
  columnMapping.C = find("close", "c");
  columnMapping.V = find("volume", "vol", "v");
});

// Role assigned to each column (for header highlighting)
const colRoleMap = computed(() => {
  const map: Record<string, ColumnRole> = {};
  for (const role of ROLES) {
    const col = columnMapping[role.role];
    if (col) map[col] = role.role;
  }
  return map;
});

// ── Timestamp detection + options ───────────────────────────────────────────

const timestampUnit = ref(props.source.timestamp_unit || "auto");
const timezone = ref(props.source.timezone || "UTC");

const TIMEZONES = [
  "UTC",
  "Europe/Berlin", "Europe/London", "Europe/Paris", "Europe/Zurich", "Europe/Vienna",
  "Europe/Amsterdam", "Europe/Brussels", "Europe/Madrid", "Europe/Rome", "Europe/Stockholm",
  "Europe/Warsaw", "Europe/Moscow", "Europe/Istanbul", "Europe/Athens", "Europe/Helsinki",
  "US/Eastern", "US/Central", "US/Mountain", "US/Pacific", "US/Alaska", "US/Hawaii",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Toronto", "America/Sao_Paulo", "America/Mexico_City", "America/Argentina/Buenos_Aires",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Asia/Seoul",
  "Asia/Kolkata", "Asia/Dubai", "Asia/Bangkok", "Asia/Jakarta", "Asia/Taipei",
  "Australia/Sydney", "Australia/Melbourne", "Australia/Perth",
  "Pacific/Auckland", "Africa/Johannesburg", "Africa/Cairo",
];
const timezoneOptions = TIMEZONES.map((tz) => ({ label: tz, value: tz }));

const timestampOptions = [
  { label: "Automatisch (ISO)", value: "auto" },
  { label: "Unix Sekunden", value: "s" },
  { label: "Unix Millisekunden", value: "ms" },
];

type TimestampHint = { format: string; label: string };

function detectTimestampFormat(values: unknown[]): TimestampHint {
  const nums = values.map(Number).filter((n) => !isNaN(n) && n > 0);
  if (nums.length === 0) return { format: "auto", label: "ISO / String" };
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  if (avg > 1e12) return { format: "ms", label: "Unix Millisekunden" };
  if (avg > 1e9) return { format: "s", label: "Unix Sekunden" };
  return { format: "auto", label: "ISO / String" };
}

const timestampHint = computed<TimestampHint>(() => {
  if (!preview.value || !columnMapping.T) return { format: "auto", label: "—" };
  const colIdx = columns.value.indexOf(columnMapping.T);
  if (colIdx === -1) return { format: "auto", label: "—" };
  const values = preview.value.rows.map((row: unknown[]) => row[colIdx]);
  return detectTimestampFormat(values);
});

// Apply hint when T column changes
watch([() => columnMapping.T, () => preview.value], () => {
  timestampUnit.value = timestampHint.value.format;
});

// ── Transformed preview (client-side) ───────────────────────────────────────

const transformedPreview = computed(() => {
  if (!preview.value || !columnMapping.T) return null;
  const cols = columns.value;
  const dIdx = cols.indexOf(columnMapping.T);
  const oIdx = cols.indexOf(columnMapping.O);
  const hIdx = cols.indexOf(columnMapping.H);
  const lIdx = cols.indexOf(columnMapping.L);
  const cIdx = cols.indexOf(columnMapping.C);
  const vIdx = columnMapping.V ? cols.indexOf(columnMapping.V) : -1;
  if ([dIdx, oIdx, hIdx, lIdx, cIdx].some((i) => i === -1)) return null;

  const rows = preview.value.rows.map((row: unknown[]) => {
    let t = String(row[dIdx] ?? "");
    if (timestampUnit.value === "ms") {
      const d = new Date(Number(t));
      t = isNaN(d.getTime()) ? t : d.toISOString().replace("T", " ").slice(0, 19);
    } else if (timestampUnit.value === "s") {
      const d = new Date(Number(t) * 1000);
      t = isNaN(d.getTime()) ? t : d.toISOString().replace("T", " ").slice(0, 19);
    }
    return [t, row[oIdx], row[hIdx], row[lIdx], row[cIdx], vIdx >= 0 ? row[vIdx] : 0];
  });
  return { columns: ["T", "O", "H", "L", "C", "V"], rows };
});

// ── Step 3: Symbol mapping + file selection ─────────────────────────────────

const rawPattern = ref(props.source.raw_pattern ?? "{raw_symbol}_m15.csv");
const symbolMap = ref<{ key: string; value: string }[]>(
  Object.entries(props.source.symbol_map ?? {}).map(([k, v]) => ({ key: k, value: v })),
);
if (symbolMap.value.length === 0) symbolMap.value.push({ key: "", value: "" });

interface GlobMatch {
  filename: string;
  prefix: string;
  symbol: string;
  outputName: string;
  selected: boolean;
}

const globMatches = computed<GlobMatch[]>(() => {
  const pattern = rawPattern.value;
  const placeholder = "{raw_symbol}";
  if (!pattern.includes(placeholder)) return [];

  const idx = pattern.indexOf(placeholder);
  const before = pattern.slice(0, idx);
  const after = pattern.slice(idx + placeholder.length);

  const symMapObj: Record<string, string> = {};
  for (const entry of symbolMap.value) {
    if (entry.key && entry.value) symMapObj[entry.key] = entry.value;
  }

  const tfPart = props.source.file_pattern.replace("{symbol}_", "").replace(".csv", "");

  return rawFiles.value
    .filter((f: FileInfo) => f.name.startsWith(before) && f.name.endsWith(after))
    .map((f: FileInfo) => {
      const prefix = f.name.slice(before.length, f.name.length - after.length);
      const symbol = symMapObj[prefix] ?? "";
      const outputName = symbol ? `${symbol}_${tfPart}.csv` : "—";
      return { filename: f.name, prefix, symbol, outputName, selected: true };
    });
});

// Track deselected files
const deselectedFiles = ref<Set<string>>(new Set());

function toggleFileSelection(filename: string) {
  const s = new Set(deselectedFiles.value);
  if (s.has(filename)) s.delete(filename);
  else s.add(filename);
  deselectedFiles.value = s;
}

const selectedMatches = computed(() =>
  globMatches.value.filter((m: GlobMatch) => !deselectedFiles.value.has(m.filename)),
);

const unmatchedFiles = computed(() => {
  const matchedNames = new Set(globMatches.value.map((m: GlobMatch) => m.filename));
  return rawFiles.value.filter((f: FileInfo) => !matchedNames.has(f.name));
});

function autoFillSymbolMap() {
  const existing = new Set(symbolMap.value.map((e: { key: string; value: string }) => e.key));
  for (const match of globMatches.value) {
    if (match.prefix && !existing.has(match.prefix)) {
      symbolMap.value.push({ key: match.prefix, value: match.prefix.toUpperCase() });
      existing.add(match.prefix);
    }
  }
  symbolMap.value = symbolMap.value.filter((e: { key: string; value: string }, i: number) =>
    e.key || e.value || i === symbolMap.value.length - 1,
  );
}

function addSymbolRow() {
  symbolMap.value.push({ key: "", value: "" });
}

function removeSymbolRow(i: number) {
  symbolMap.value.splice(i, 1);
  if (symbolMap.value.length === 0) symbolMap.value.push({ key: "", value: "" });
}

// ── Save + Prepare ──────────────────────────────────────────────────────────

const saving = ref(false);
const saveError = ref<string | null>(null);

const requiredMapped = computed(() =>
  ROLES.filter((r) => r.required).every((r) => columnMapping[r.role]),
);

const convertableCount = computed(() =>
  selectedMatches.value.filter((m: GlobMatch) => m.symbol).length,
);

async function saveConfig() {
  saving.value = true;
  saveError.value = null;
  try {
    const symMap: Record<string, string> = {};
    for (const e of symbolMap.value) {
      if (e.key && e.value) symMap[e.key] = e.value;
    }
    await $fetch(`/api/datasources/${props.source.name}`, {
      method: "PUT",
      body: {
        raw_pattern: rawPattern.value,
        date_col: columnMapping.T,
        open_col: columnMapping.O,
        high_col: columnMapping.H,
        low_col: columnMapping.L,
        close_col: columnMapping.C,
        volume_col: columnMapping.V,
        timestamp_unit: timestampUnit.value === "auto" ? "" : timestampUnit.value,
        timezone: timezone.value,
        symbol_map: symMap,
      },
    });
    emit("updated");
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : "Speichern fehlgeschlagen";
  } finally {
    saving.value = false;
  }
}

const preparing = ref(false);
const prepareStatus = ref<"idle" | "running" | "done" | "error">("idle");
const prepareResult = ref<string[] | null>(null);
const prepareError = ref<string | null>(null);

async function startPrepare() {
  await saveConfig();
  if (saveError.value) return;

  preparing.value = true;
  prepareStatus.value = "running";
  prepareResult.value = null;
  prepareError.value = null;

  try {
    const glob = rawPattern.value.replace("{raw_symbol}", "*");
    const excludes = [...deselectedFiles.value];
    const prepareUrl = `/api/datasources/${props.source.name}/prepare`;
    const { task_id } = await ($fetch as Function)(prepareUrl, {
      method: "POST",
      body: { glob_pattern: glob, excludes },
    }) as { task_id: string };
    await pollTask(task_id);
  } catch (e: unknown) {
    prepareError.value = e instanceof Error ? e.message : "Prepare fehlgeschlagen";
    prepareStatus.value = "error";
    preparing.value = false;
  }
}

async function pollTask(taskId: string) {
  const poll = async () => {
    const res = await $fetch<{ status: string; result: string[] | null; error: string | null }>(
      `/api/datasources/${props.source.name}/prepare/${taskId}`,
    );
    if (res.status === "running") {
      setTimeout(poll, 1000);
      return;
    }
    preparing.value = false;
    if (res.status === "done") {
      prepareStatus.value = "done";
      prepareResult.value = res.result;
      emit("updated");
    } else {
      prepareStatus.value = "error";
      prepareError.value = res.error ?? "Unbekannter Fehler";
    }
  };
  await poll();
}

// ── Role colors ─────────────────────────────────────────────────────────────

const roleColors: Record<ColumnRole, string> = {
  T: "text-purple-400",
  O: "text-green-400",
  H: "text-blue-400",
  L: "text-red-400",
  C: "text-yellow-400",
  V: "text-gray-400",
};

const roleBgColors: Record<ColumnRole, string> = {
  T: "bg-purple-500/10",
  O: "bg-green-500/10",
  H: "bg-blue-500/10",
  L: "bg-red-500/10",
  C: "bg-yellow-500/10",
  V: "bg-gray-500/10",
};

function clearRoleForCol(col: string) {
  const roles = Object.keys(columnMapping) as ColumnRole[];
  const existing = roles.find((r) => columnMapping[r] === col);
  if (existing) columnMapping[existing] = "";
}

function assignRoleToCol(role: ColumnRole, col: string) {
  columnMapping[role] = col;
}

// Build dropdown items for a column header
function cellBgClass(colIndex: number): string {
  const col = columns.value[colIndex];
  if (!col) return "";
  const role: ColumnRole | undefined = colRoleMap.value[col];
  return role ? roleBgColors[role] : "";
}

function colDropdownItems(col: string) {
  return [[
    { label: "—", onSelect: () => clearRoleForCol(col) },
    ...ROLES.map((r) => ({
      label: `${r.role} — ${r.label}`,
      onSelect: () => assignRoleToCol(r.role, col),
    })),
  ]];
}
</script>

<template>
  <div class="space-y-5">
    <!-- Step 1: Reference file for preview -->
    <div>
      <div class="text-xs text-gray-500 mb-2">1. Referenzdatei für Vorschau wählen</div>
      <USelect
        v-if="fileOptions.length"
        v-model="selectedFile"
        :items="fileOptions"
        class="font-mono"
      />
      <p v-else class="text-xs text-gray-600">Keine Rohdaten vorhanden.</p>
    </div>

    <!-- Data preview with column role assignment -->
    <div v-if="previewStatus === 'pending'" class="text-sm text-gray-500">Vorschau wird geladen…</div>

    <template v-else-if="columns.length">
      <div class="text-xs text-gray-500 mb-1">2. Spalten zuordnen — klicke auf einen Spaltenheader um die Rolle zu wählen</div>
      <div class="overflow-x-auto rounded border border-gray-800">
        <table class="w-full text-xs">
          <thead>
            <tr>
              <th
                v-for="col in columns"
                :key="col"
                class="px-2 py-1.5 text-left font-mono relative group cursor-pointer"
                :class="colRoleMap[col] ? [roleColors[colRoleMap[col]], roleBgColors[colRoleMap[col]]] : 'bg-gray-800 text-gray-400'"
              >
                <UDropdownMenu :items="colDropdownItems(col)">
                  <span class="flex items-center gap-1">
                    {{ col }}
                    <span v-if="colRoleMap[col]" class="text-[10px] font-bold opacity-80">
                      [{{ colRoleMap[col] }}]
                    </span>
                  </span>
                </UDropdownMenu>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in preview?.rows" :key="i" class="border-t border-gray-800">
              <td
                v-for="(cell, j) in row"
                :key="j"
                class="px-2 py-1 font-mono text-gray-300"
                :class="cellBgClass(j)"
              >
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Quick assign row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        <div v-for="r in ROLES" :key="r.role" class="flex items-center gap-1.5">
          <span class="text-xs font-bold shrink-0" :class="roleColors[r.role]">{{ r.role }}</span>
          <USelect
            :model-value="columnMapping[r.role]"
            :items="[{ label: '—', value: '_none' }, ...colOptions]"
            class="min-w-0 flex-1 text-xs"
            @update:model-value="columnMapping[r.role] = $event === '_none' ? '' : $event"
          />
        </div>
      </div>

      <!-- Timestamp -->
      <div class="space-y-3">
        <UFormField label="Timestamp-Format">
          <USelect v-model="timestampUnit" :items="timestampOptions" class="w-full" />
          <p v-if="timestampHint.format !== 'auto'" class="text-xs text-blue-400 mt-1">
            Erkannt: {{ timestampHint.label }}
          </p>
        </UFormField>
        <UFormField label="Zeitzone">
          <USelect v-model="timezone" :items="timezoneOptions" :ui="{ content: 'min-w-64' }" class="w-full font-mono" />
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
    </template>

    <!-- Step 3: File pattern + symbol mapping + file selection -->
    <div class="text-xs text-gray-500 mb-1">3. Dateien auswählen und Symbole zuordnen</div>

    <UFormField label="Rohdaten-Muster" hint="{raw_symbol} = Platzhalter">
      <UInput v-model="rawPattern" placeholder="{raw_symbol}_m15.csv" class="font-mono" />
    </UFormField>

    <!-- Symbol map -->
    <UFormField label="Symbol-Zuordnung">
      <div class="space-y-1.5">
        <div v-for="(entry, i) in symbolMap" :key="i" class="flex gap-2 items-center">
          <UInput
            v-model="entry.key"
            placeholder="Prefix"
            class="flex-1 font-mono text-xs"
          />
          <UIcon name="i-lucide-arrow-right" class="shrink-0 text-gray-600" />
          <UInput
            v-model="entry.value"
            placeholder="Symbol"
            class="flex-1 font-mono text-xs"
          />
          <UButton
            icon="i-heroicons-x-mark"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="removeSymbolRow(i)"
          />
        </div>
        <UButton icon="i-heroicons-plus" size="xs" variant="ghost" @click="addSymbolRow">
          Zeile
        </UButton>
      </div>
    </UFormField>

    <!-- File selection table -->
    <div v-if="globMatches.length" class="rounded border border-gray-800 overflow-hidden">
      <div class="bg-gray-800/50 px-3 py-1.5 flex items-center justify-between">
        <span class="text-xs text-gray-400">
          {{ selectedMatches.length }} / {{ globMatches.length }} Datei(en) ausgewählt
        </span>
        <UButton size="xs" variant="ghost" @click="autoFillSymbolMap">
          Symbol-Map füllen
        </UButton>
      </div>
      <div class="max-h-56 overflow-y-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-gray-800">
              <th class="w-8 px-2 py-1" />
              <th class="px-3 py-1 text-left text-gray-500">Datei</th>
              <th class="px-3 py-1 text-left text-gray-500">Prefix</th>
              <th class="px-3 py-1 text-left text-gray-500">Symbol</th>
              <th class="px-3 py-1 text-left text-gray-500">Ausgabe</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="match in globMatches"
              :key="match.filename"
              class="border-t border-gray-800/50"
              :class="{ 'opacity-40': deselectedFiles.has(match.filename) }"
            >
              <td class="px-2 py-1">
                <UCheckbox
                  :model-value="!deselectedFiles.has(match.filename)"
                  @update:model-value="toggleFileSelection(match.filename)"
                />
              </td>
              <td class="px-3 py-1 font-mono text-gray-400">{{ match.filename }}</td>
              <td class="px-3 py-1 font-mono text-gray-300">{{ match.prefix }}</td>
              <td class="px-3 py-1 font-mono" :class="match.symbol ? 'text-green-400' : 'text-gray-600'">
                {{ match.symbol || "—" }}
              </td>
              <td class="px-3 py-1 font-mono" :class="match.symbol ? 'text-blue-400' : 'text-gray-600'">
                {{ match.outputName }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="unmatchedFiles.length" class="border-t border-gray-800 px-3 py-1.5">
        <span class="text-xs text-yellow-500">
          {{ unmatchedFiles.length }} Datei(en) stimmen nicht mit dem Muster überein
        </span>
      </div>
    </div>
    <div v-else-if="rawFiles.length" class="text-xs text-yellow-500">
      Keine Dateien stimmen mit "{{ rawPattern }}" überein.
    </div>

    <!-- Errors / Results -->
    <UAlert
      v-if="saveError"
      color="error"
      variant="subtle"
      :title="saveError"
      icon="i-heroicons-exclamation-triangle"
    />
    <UAlert
      v-if="prepareStatus === 'done' && prepareResult"
      color="success"
      variant="subtle"
      :title="`${prepareResult.length} Symbol(e) konvertiert`"
      :description="prepareResult.join(', ')"
      icon="i-heroicons-check-circle"
    />
    <UAlert
      v-if="prepareStatus === 'error' && prepareError"
      color="error"
      variant="subtle"
      :title="prepareError"
      icon="i-heroicons-exclamation-triangle"
    />

    <!-- Actions -->
    <div class="flex gap-2">
      <UButton variant="soft" :loading="saving" @click="saveConfig">
        Speichern
      </UButton>
      <UButton
        :loading="preparing"
        :disabled="!requiredMapped || convertableCount === 0"
        @click="startPrepare"
      >
        Konvertieren ({{ convertableCount }} Dateien)
      </UButton>
    </div>
  </div>
</template>
