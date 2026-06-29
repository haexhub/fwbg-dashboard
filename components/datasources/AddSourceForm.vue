<script setup lang="ts">
import type { SourceType } from "~/types/datasource";
import { SOURCE_TYPE_LABELS, SOURCE_TYPE_ICONS } from "~/types/datasource";
import { DUKASCOPY_TIMEFRAMES } from "~/composables/useDukascopy";

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
const oneYearAgo = new Date(today);
oneYearAgo.setFullYear(today.getFullYear() - 1);

const dukaForm = reactive({
  symbols: "",
  timeframe: "HOUR_1" as (typeof DUKASCOPY_TIMEFRAMES)[number],
  start: isoDate(oneYearAgo),
  end: isoDate(today),
  offer_side: "bid",
});
const downloading = ref(false);
const dukaError = ref<string | null>(null);

function addEndpoint() {
  restForm.endpoints.push({ key: "", value: "" });
}
function removeEndpoint(i: number) {
  restForm.endpoints.splice(i, 1);
}

function selectType(t: PickerType) {
  selectedType.value = t;
  step.value = 2;
}

function back() {
  step.value = 1;
}

const { createSourceAndDownload } = useDukascopy();
const toast = useToast();

async function handleDukascopy() {
  const symbols = dukaForm.symbols
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!common.name || symbols.length === 0) return;
  downloading.value = true;
  dukaError.value = null;
  try {
    const task = await createSourceAndDownload({
      name: common.name,
      description: common.description,
      symbols,
      timeframe: dukaForm.timeframe,
      start: dukaForm.start,
      end: dukaForm.end,
      offer_side: dukaForm.offer_side,
    });
    if (task.status === "error") {
      dukaError.value = task.error ?? "Download fehlgeschlagen";
      return;
    }
    const total = (task.result ?? []).reduce((n, r) => n + r.rows, 0);
    toast.add({
      title: "Dukascopy-Daten geladen",
      description: `${task.result?.length ?? 0} Symbol(e), ${total} Bars.`,
      color: "success",
    });
    emit("done");
  } catch (e) {
    dukaError.value = e instanceof Error ? e.message : "Download fehlgeschlagen";
  } finally {
    downloading.value = false;
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
            fertig zum Backtesten, ohne ETL.
          </p>
          <UFormField label="Symbole" class="w-full">
            <UInput
              v-model="dukaForm.symbols"
              placeholder="EURUSD, GBPUSD, USDJPY"
              class="font-mono w-full"
            />
            <template #hint>
              <span class="text-xs text-gray-500">Komma- oder leerzeichengetrennt.</span>
            </template>
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Timeframe">
              <USelect v-model="dukaForm.timeframe" :items="[...DUKASCOPY_TIMEFRAMES]" class="w-full" />
            </UFormField>
            <UFormField label="Seite">
              <USelect
                v-model="dukaForm.offer_side"
                :items="[{ label: 'Bid', value: 'bid' }, { label: 'Ask', value: 'ask' }]"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Von">
              <UInput v-model="dukaForm.start" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Bis">
              <UInput v-model="dukaForm.end" type="date" class="w-full" />
            </UFormField>
          </div>
          <UAlert v-if="dukaError" color="error" variant="subtle" :title="dukaError" />
        </template>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <UButton variant="ghost" :disabled="downloading" @click="emit('cancel')">Abbrechen</UButton>
        <UButton
          :loading="downloading"
          :disabled="!common.name || (selectedType === 'dukascopy' && !dukaForm.symbols.trim())"
          @click="submit"
        >
          {{ selectedType === 'dukascopy' ? 'Herunterladen' : 'Hinzufügen' }}
        </UButton>
      </div>
    </template>
  </div>
</template>
