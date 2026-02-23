<script setup lang="ts">
import type { SourceType } from "~/types/datasource";
import { SOURCE_TYPE_LABELS, SOURCE_TYPE_ICONS } from "~/types/datasource";

const emit = defineEmits<{
  submit: [data: Record<string, unknown>];
  cancel: [];
}>();

const step = ref<1 | 2>(1);
const selectedType = ref<SourceType | null>(null);

const sourceTypes: SourceType[] = ["csv", "rest", "websocket", "database"];

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

function addEndpoint() {
  restForm.endpoints.push({ key: "", value: "" });
}
function removeEndpoint(i: number) {
  restForm.endpoints.splice(i, 1);
}

function selectType(t: SourceType) {
  selectedType.value = t;
  step.value = 2;
}

function back() {
  step.value = 1;
}

function submit() {
  if (!selectedType.value || !common.name) return;

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
          <UIcon :name="SOURCE_TYPE_ICONS[t]" class="text-2xl text-gray-300" />
          <span class="text-sm font-medium text-white">{{ SOURCE_TYPE_LABELS[t] }}</span>
        </button>
      </div>
    </template>

    <!-- Step 2: Fill in form -->
    <template v-else-if="step === 2 && selectedType">
      <div class="flex items-center gap-2">
        <UButton icon="i-heroicons-arrow-left" variant="ghost" size="xs" @click="back" />
        <UIcon :name="SOURCE_TYPE_ICONS[selectedType]" class="text-gray-400" />
        <span class="text-sm font-medium text-gray-300">{{ SOURCE_TYPE_LABELS[selectedType] }}</span>
      </div>

      <div class="space-y-3">
        <!-- Common fields -->
        <UFormField label="Name">
          <UInput v-model="common.name" placeholder="meine_quelle" class="font-mono" />
        </UFormField>
        <UFormField label="Beschreibung">
          <UInput v-model="common.description" placeholder="Optional" />
        </UFormField>

        <!-- CSV fields -->
        <template v-if="selectedType === 'csv'">
          <UFormField label="Dateiname-Muster">
            <UInput v-model="csvForm.file_pattern" placeholder="{symbol}_{timeframe}.csv" class="font-mono" />
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
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <UButton variant="ghost" @click="emit('cancel')">Abbrechen</UButton>
        <UButton
          :disabled="!common.name"
          @click="submit"
        >
          Hinzufügen
        </UButton>
      </div>
    </template>
  </div>
</template>
