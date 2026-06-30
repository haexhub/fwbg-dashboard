<script setup lang="ts">
import type { SourceType } from "~/types/datasource";
import { SOURCE_TYPE_LABELS, SOURCE_TYPE_ICONS } from "~/types/datasource";
import {
  DUKASCOPY_TIMEFRAMES,
  TIMEFRAME_GRANULARITY,
  earliestAvailable,
  type DukascopyInstrument,
  type DukascopyProgress,
  type DukascopyTimeframe,
} from "~/composables/useDukascopy";

const emit = defineEmits<{
  submit: [data: Record<string, unknown>];
  done: [];
  cancel: [];
}>();

// "dukascopy" is a dashboard-only pseudo-type: it creates a CSV source and
// pulls historical data into it. All other types map 1:1 to the backend.
type PickerType = SourceType | "dukascopy";

const step = ref<1 | 2>(1);
const selectedType = ref<PickerType | null>(null);

const sourceTypes: PickerType[] = ["csv", "rest", "websocket", "database", "dukascopy"];

function typeLabel(t: PickerType): string {
  return t === "dukascopy" ? "Dukascopy" : SOURCE_TYPE_LABELS[t];
}
function typeIcon(t: PickerType): string {
  return t === "dukascopy" ? "i-heroicons-arrow-down-tray" : SOURCE_TYPE_ICONS[t];
}

// Form state per type
const common = reactive({ name: "", description: "" });

const csvForm = reactive({
  file_pattern: "{symbol}_{timeframe}.csv",
});

const restForm = reactive({
  base_url: "",
  api_key: "",
  api_key_param: "apikey",
  api_key_header: "",
  rate_limit: 1.0,
  timeout: 30.0,
  endpoints: [{ key: "", value: "" }],
});

const wsForm = reactive({
  url: "",
  heartbeat_interval: 30.0,
  reconnect_delay: 5.0,
  max_reconnect_attempts: 10,
  subscribe_message_raw: "{}",
});

const dbForm = reactive({
  connection_string: "",
  driver: "sqlalchemy",
});

// ── Dukascopy ──
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
const today = new Date();
const todayIso = isoDate(today);
const oneYearAgo = new Date(today);
oneYearAgo.setFullYear(today.getFullYear() - 1);

const dukaForm = reactive({
  symbols: [] as string[],
  timeframe: "HOUR_1" as DukascopyTimeframe,
  start: isoDate(oneYearAgo),
  end: todayIso,
});
const downloading = ref(false);
const downloadProgress = ref<DukascopyProgress | null>(null);
const dukaError = ref<string | null>(null);

const { fetchInstruments, createSourceAndDownload } = useDukascopy();

// Available-instrument catalogue (loaded lazily when Dukascopy is picked).
const instruments = ref<DukascopyInstrument[]>([]);
const instrumentsLoading = ref(false);
const instrumentsError = ref<string | null>(null);

async function loadInstruments() {
  if (instruments.value.length || instrumentsLoading.value) return;
  instrumentsLoading.value = true;
  instrumentsError.value = null;
  try {
    instruments.value = await fetchInstruments();
  } catch (e) {
    instrumentsError.value =
      e instanceof Error ? e.message : "Instrumente konnten nicht geladen werden";
  } finally {
    instrumentsLoading.value = false;
  }
}

const instrumentBySymbol = computed(
  () => new Map(instruments.value.map((i) => [i.symbol, i])),
);

// Grouped into USelectMenu's T[][] shape: a disabled label header per group.
const instrumentMenuItems = computed(() => {
  const byGroup = new Map<string, { label: string; value: string }[]>();
  for (const inst of instruments.value) {
    const arr = byGroup.get(inst.group) ?? [];
    arr.push({ label: `${inst.symbol} · ${inst.description}`, value: inst.symbol });
    byGroup.set(inst.group, arr);
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, items]) => [
      { label: group, value: "", type: "label" as const, disabled: true },
      ...items,
    ]);
});

const selectedInstruments = computed(() =>
  dukaForm.symbols
    .map((s) => instrumentBySymbol.value.get(s))
    .filter((i): i is DukascopyInstrument => !!i),
);

// Earliest date all selected assets have data for, at the chosen timeframe.
const minDate = computed(() =>
  earliestAvailable(selectedInstruments.value, dukaForm.timeframe),
);

// Which selected asset limits the range (has the latest history start).
const limitingInstrument = computed(() => {
  const md = minDate.value;
  if (!md) return null;
  const g = TIMEFRAME_GRANULARITY[dukaForm.timeframe];
  return selectedInstruments.value.find((i) => i.historyStart[g] === md) ?? null;
});

// Keep the start date within the available range when the selection changes.
watch(minDate, (md) => {
  if (md && dukaForm.start < md) dukaForm.start = md;
});

function addEndpoint() {
  restForm.endpoints.push({ key: "", value: "" });
}
function removeEndpoint(i: number) {
  restForm.endpoints.splice(i, 1);
}

function selectType(t: PickerType) {
  selectedType.value = t;
  step.value = 2;
  if (t === "dukascopy") loadInstruments();
}

function back() {
  step.value = 1;
}

const toast = useToast();

async function handleDukascopy() {
  const symbols = dukaForm.symbols;
  if (!common.name || symbols.length === 0) return;
  downloading.value = true;
  downloadProgress.value = null;
  dukaError.value = null;
  try {
    const task = await createSourceAndDownload(
      {
        name: common.name,
        description: common.description,
        symbols,
        timeframe: dukaForm.timeframe,
        start: dukaForm.start,
        end: dukaForm.end,
      },
      (t) => {
        downloadProgress.value = t.progress ?? null;
      },
    );
    if (task.status === "error") {
      dukaError.value = task.error ?? "Download fehlgeschlagen";
      return;
    }
    const results = task.result ?? [];
    const total = results.reduce((n, r) => n + r.rows, 0);
    const measured = results.filter((r) => typeof r.spread === "number" && r.spread! > 0);
    const spreadNote = measured.length
      ? ` Spread (p90): ${measured.map((r) => `${r.symbol} ${r.spread}`).join(", ")}.`
      : "";
    toast.add({
      title: "Dukascopy-Daten geladen",
      description: `${results.length} Symbol(e), ${total} Bars (Mid-Preis).${spreadNote} Pro-Asset anpassbar unter „Spreads".`,
      color: "success",
    });
    emit("done");
  } catch (e) {
    dukaError.value = e instanceof Error ? e.message : "Download fehlgeschlagen";
  } finally {
    downloading.value = false;
    downloadProgress.value = null;
  }
}

function submit() {
  if (!selectedType.value || !common.name) return;

  if (selectedType.value === "dukascopy") {
    handleDukascopy();
    return;
  }

  const base = {
    type: selectedType.value,
    name: common.name,
    description: common.description,
  };

  let extra: Record<string, unknown> = {};

  if (selectedType.value === "csv") {
    extra = {
      file_pattern: csvForm.file_pattern,
      timeframe_map: {},
    };
  } else if (selectedType.value === "rest") {
    const endpoints: Record<string, string> = {};
    for (const ep of restForm.endpoints) {
      if (ep.key) endpoints[ep.key] = ep.value;
    }
    extra = {
      base_url: restForm.base_url,
      api_key: restForm.api_key,
      api_key_param: restForm.api_key_param,
      api_key_header: restForm.api_key_header,
      rate_limit: restForm.rate_limit,
      timeout: restForm.timeout,
      endpoints,
      headers: {},
    };
  } else if (selectedType.value === "websocket") {
    let subscribe_message: unknown = {};
    try {
      subscribe_message = JSON.parse(wsForm.subscribe_message_raw);
    } catch {
      subscribe_message = {};
    }
    extra = {
      url: wsForm.url,
      heartbeat_interval: wsForm.heartbeat_interval,
      reconnect_delay: wsForm.reconnect_delay,
      max_reconnect_attempts: wsForm.max_reconnect_attempts,
      subscribe_message,
      headers: {},
    };
  } else if (selectedType.value === "database") {
    extra = {
      connection_string: dbForm.connection_string,
      driver: dbForm.driver,
    };
  }

  emit("submit", { ...base, ...extra });
}
</script>

<template>
  <div class="space-y-4">
    <!-- Step 1: Select type -->
    <template v-if="step === 1">
      <p class="text-sm text-gray-400">Welche Art von Datenquelle möchtest du hinzufügen?</p>
      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="t in sourceTypes"
          :key="t"
          class="flex flex-col items-center gap-2 rounded-lg border border-gray-700 p-4 text-center hover:border-gray-500 hover:bg-gray-800 transition-colors"
          @click="selectType(t)"
        >
          <UIcon :name="typeIcon(t)" class="text-2xl text-gray-300" />
          <span class="text-sm font-medium text-white">{{ typeLabel(t) }}</span>
        </button>
      </div>
    </template>

    <!-- Step 2: Fill in form -->
    <template v-else-if="step === 2 && selectedType">
      <div class="flex items-center gap-2">
        <UButton icon="i-heroicons-arrow-left" variant="ghost" @click="back" />
        <UIcon :name="typeIcon(selectedType)" class="text-gray-400" />
        <span class="text-sm font-medium text-gray-300">{{ typeLabel(selectedType) }}</span>
      </div>

      <div class="space-y-3">
        <!-- Common fields -->
        <UFormField label="Name" class="w-full">
          <UInput v-model="common.name" placeholder="meine_quelle" class="font-mono w-full" />
        </UFormField>
        <UFormField label="Beschreibung" class="w-full">
          <UTextarea v-model="common.description" placeholder="Optional" :rows="3" class="w-full" />
        </UFormField>

        <!-- CSV fields -->
        <template v-if="selectedType === 'csv'">
          <UFormField label="Dateiname-Muster" class="w-full">
            <UInput v-model="csvForm.file_pattern" placeholder="{symbol}_{timeframe}.csv" class="font-mono w-full" />
          </UFormField>
          <p class="text-xs text-gray-500">
            Ordner wird automatisch unter <span class="font-mono">data/{{ common.name || '…' }}/</span> angelegt.
          </p>
        </template>

        <!-- REST fields -->
        <template v-else-if="selectedType === 'rest'">
          <UFormField label="Basis-URL">
            <UInput v-model="restForm.base_url" placeholder="https://api.example.com" />
          </UFormField>
          <UFormField label="API-Key">
            <UInput v-model="restForm.api_key" type="password" placeholder="Optional" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Key-Parameter">
              <UInput v-model="restForm.api_key_param" placeholder="apikey" />
            </UFormField>
            <UFormField label="Key-Header">
              <UInput v-model="restForm.api_key_header" placeholder="X-Api-Key (optional)" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Rate Limit (s)">
              <UInput v-model.number="restForm.rate_limit" type="number" step="0.1" />
            </UFormField>
            <UFormField label="Timeout (s)">
              <UInput v-model.number="restForm.timeout" type="number" />
            </UFormField>
          </div>
          <UFormField label="Endpunkte">
            <div class="space-y-2">
              <div
                v-for="(ep, i) in restForm.endpoints"
                :key="i"
                class="flex gap-2"
              >
                <UInput v-model="ep.key" placeholder="Name" class="w-28 font-mono" />
                <UInput v-model="ep.value" placeholder="/v1/bars/{symbol}" class="flex-1 font-mono" />
                <UButton
                  icon="i-heroicons-x-mark"
                  variant="ghost"
                  size="xs"
                  @click="removeEndpoint(i)"
                />
              </div>
              <UButton
                icon="i-heroicons-plus"
                variant="ghost"
                size="xs"
                @click="addEndpoint"
              >
                Endpunkt
              </UButton>
            </div>
          </UFormField>
        </template>

        <!-- WebSocket fields -->
        <template v-else-if="selectedType === 'websocket'">
          <UFormField label="URL">
            <UInput v-model="wsForm.url" placeholder="wss://stream.example.com/ws" />
          </UFormField>
          <UFormField label="Subscribe-Nachricht (JSON)">
            <UTextarea
              v-model="wsForm.subscribe_message_raw"
              :rows="4"
              class="font-mono text-xs"
              placeholder='{"method": "SUBSCRIBE", "params": ["{symbol}"]}'
            />
          </UFormField>
          <div class="grid grid-cols-3 gap-3">
            <UFormField label="Heartbeat (s)">
              <UInput v-model.number="wsForm.heartbeat_interval" type="number" />
            </UFormField>
            <UFormField label="Reconnect (s)">
              <UInput v-model.number="wsForm.reconnect_delay" type="number" />
            </UFormField>
            <UFormField label="Max Versuche">
              <UInput v-model.number="wsForm.max_reconnect_attempts" type="number" />
            </UFormField>
          </div>
        </template>

        <!-- Database fields -->
        <template v-else-if="selectedType === 'database'">
          <UFormField label="Connection String">
            <UInput
              v-model="dbForm.connection_string"
              placeholder="postgresql://user:pass@host/db"
              class="font-mono"
            />
          </UFormField>
          <UFormField label="Treiber">
            <UInput v-model="dbForm.driver" placeholder="sqlalchemy" />
          </UFormField>
        </template>

        <!-- Dukascopy fields -->
        <template v-else-if="selectedType === 'dukascopy'">
          <p class="text-xs text-gray-500">
            Lädt historische OHLC-Daten direkt von Dukascopy in diese Quelle —
            fertig zum Backtesten, ohne ETL. Bid + Ask werden geladen, die Kurse als
            Mid-Preis gespeichert und der reale Spread gemessen (fürs Backtesting).
          </p>
          <UFormField label="Assets" class="w-full">
            <USelectMenu
              v-model="dukaForm.symbols"
              :items="instrumentMenuItems"
              value-key="value"
              multiple
              :loading="instrumentsLoading"
              :disabled="instrumentsLoading || !!instrumentsError"
              placeholder="Assets wählen oder suchen (z.B. EURUSD, BTCUSD)…"
              class="w-full"
            />
            <template #hint>
              <span class="text-xs text-gray-500">{{ dukaForm.symbols.length }} gewählt</span>
            </template>
          </UFormField>
          <UAlert
            v-if="instrumentsError"
            color="error"
            variant="subtle"
            :title="instrumentsError"
          />
          <UFormField label="Timeframe" class="w-full">
            <USelect v-model="dukaForm.timeframe" :items="[...DUKASCOPY_TIMEFRAMES]" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Von">
              <UInput
                v-model="dukaForm.start"
                type="date"
                :min="minDate ?? undefined"
                :max="dukaForm.end"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Bis">
              <UInput
                v-model="dukaForm.end"
                type="date"
                :min="dukaForm.start"
                :max="todayIso"
                class="w-full"
              />
            </UFormField>
          </div>
          <p v-if="minDate" class="text-xs text-gray-500">
            Frühester verfügbarer Zeitpunkt für {{ dukaForm.timeframe }}:
            <span class="font-mono text-gray-400">{{ minDate }}</span>
            <template v-if="limitingInstrument && dukaForm.symbols.length > 1">
              (begrenzt durch {{ limitingInstrument.symbol }})
            </template>
          </p>
          <p class="text-xs text-gray-500">
            Der reale Spread wird gemessen (p90, konservativ) und pro Asset gespeichert —
            unter „Spreads" kannst du ihn jederzeit manuell überschreiben.
          </p>
          <div v-if="downloading" class="space-y-1 pt-1">
            <UProgress :model-value="downloadProgress?.percent ?? null" :max="100" />
            <p class="text-xs text-gray-500">
              <template v-if="downloadProgress">
                Lädt {{ downloadProgress.symbol }}<template v-if="downloadProgress.symbol_total > 1"> ({{ downloadProgress.symbol_index }}/{{ downloadProgress.symbol_total }})</template>
                — {{ downloadProgress.phase === 'write' ? 'verarbeite' : downloadProgress.phase === 'bid' ? 'lade Bid' : 'lade Ask' }} · {{ downloadProgress.percent }} %
              </template>
              <template v-else>Download wird gestartet…</template>
            </p>
          </div>
          <UAlert v-if="dukaError" color="error" variant="subtle" :title="dukaError" />
        </template>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <UButton variant="ghost" :disabled="downloading" @click="emit('cancel')">Abbrechen</UButton>
        <UButton
          :loading="downloading"
          :disabled="!common.name || (selectedType === 'dukascopy' && dukaForm.symbols.length === 0)"
          @click="submit"
        >
          {{ selectedType === 'dukascopy' ? 'Herunterladen' : 'Hinzufügen' }}
        </UButton>
      </div>
    </template>
  </div>
</template>
