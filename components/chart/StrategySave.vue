<script setup lang="ts">
import type { ActiveIndicator } from "~/types/chart";
import type { SignalRules } from "~/types/strategy";

const props = defineProps<{
  open: boolean;
  source: string;
  symbol: string;
  timeframe: string;
  assetClass?: string;
  activeIndicators: ActiveIndicator[];
  defaultName?: string;
  /** When set, enables update mode for an existing strategy */
  strategyFilename?: string;
  /** Signal rules configured in the separate signal config sidebar */
  signalRules?: SignalRules;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const toast = useToast();
const { createStrategy, loadStrategy, saveStrategy } = useStrategies();

const strategyName = ref("");
const strategyDescription = ref("");
const status = ref<"idle" | "saving" | "saved" | "error">("idle");
const savedFilename = ref("");
const errorMessage = ref("");
const isUpdateMode = ref(false);
const existingConfig = ref<import("~/types/strategy").StrategyConfig | null>(null);

const canSave = computed(
  () => (isUpdateMode.value || strategyName.value.trim().length > 0) && (status.value === "idle" || status.value === "error"),
);

const hasSignalRules = computed(() => {
  const sr = props.signalRules;
  return sr && (sr.long?.conditions?.length || sr.short?.conditions?.length);
});

// De-duplicate indicators by FQN, but merge isSignal flag
const uniqueIndicators = computed(() => {
  const map = new Map<string, ActiveIndicator & { hasSignal: boolean }>();
  for (const ind of props.activeIndicators) {
    const existing = map.get(ind.fqn);
    if (existing) {
      if (ind.isSignal) existing.hasSignal = true;
    } else {
      map.set(ind.fqn, { ...ind, hasSignal: !!ind.isSignal });
    }
  }
  return [...map.values()];
});

// Build non-default params display for an indicator
function displayParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return "Defaults";
  return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ");
}

function buildIndicatorEntries() {
  return uniqueIndicators.value.map((ind: ActiveIndicator & { hasSignal: boolean }) => ({
    name: ind.fqn.split(":")[1] ?? ind.name.replace(/ \(signal\)$/, ""),
    params: ind.params,
    ...(ind.hasSignal ? { is_signal: true } : {}),
  }));
}

async function save() {
  if (!canSave.value) return;
  status.value = "saving";
  errorMessage.value = "";

  const indicators = buildIndicatorEntries();

  try {
    // When signal rules are configured, use signal model type
    const modelConfig = hasSignalRules.value
      ? {
          type: "signal",
          architecture: "long_short_separate",
          trade_directions: ["long", "short"],
          hyperparameters: {},
        }
      : {
          type: "xgboost",
          architecture: "long_short_separate",
          trade_directions: ["long", "short"],
          hyperparameters: {},
        };

    if (isUpdateMode.value && existingConfig.value && props.strategyFilename) {
      const existingModel = existingConfig.value.model ?? {};
      const updatedModel = hasSignalRules.value
        ? { ...existingModel, type: "signal" }
        : existingModel;

      const updated = {
        ...existingConfig.value,
        pipeline: {
          ...existingConfig.value.pipeline,
          indicators,
        },
        model: updatedModel,
        ...(hasSignalRules.value ? { signal_rules: props.signalRules } : {}),
      };
      await saveStrategy(props.strategyFilename, updated);
      savedFilename.value = props.strategyFilename;
      toast.add({
        title: "Strategie aktualisiert",
        description: `"${existingConfig.value.name}" wurde aktualisiert.`,
        color: "success",
      });
    } else {
      const res = await createStrategy(strategyName.value.trim(), {
        description: strategyDescription.value.trim() || undefined,
        datasource: props.source,
        assets: { filter: [props.symbol] },
        pipeline: {
          indicators,
          preprocessing: [],
          feature_selection: [],
          data_loading: [],
        },
        exit_strategies: [
          { name: "fixed", params: { tp_mult: 2.0, sl_mult: 1.0 }, ct: [0.5] },
        ],
        model: modelConfig,
        ...(hasSignalRules.value ? { signal_rules: props.signalRules } : {}),
        optimization: {},
        validation: { method: "walk_forward", folds: 8 },
        filters: {},
        resources: {},
      });
      savedFilename.value = res.filename;
      toast.add({
        title: "Strategie erstellt",
        description: `"${strategyName.value}" wurde gespeichert.`,
        color: "success",
      });
    }

    status.value = "saved";
  } catch (e: unknown) {
    status.value = "error";
    const err = e as { statusMessage?: string; message?: string; data?: { detail?: string; message?: string } };
    errorMessage.value =
      err?.data?.detail ?? err?.data?.message ?? err?.statusMessage ?? err?.message ?? "Fehler beim Speichern";
  }
}

function openStrategy() {
  if (savedFilename.value) {
    navigateTo(`/strategy/${savedFilename.value}/pipeline`);
  }
}

// Reset state when slideover opens, load existing strategy if available
watch(
  () => props.open,
  async (open: boolean) => {
    if (open) {
      status.value = "idle";
      savedFilename.value = "";
      errorMessage.value = "";
      existingConfig.value = null;
      isUpdateMode.value = false;

      if (props.strategyFilename) {
        try {
          existingConfig.value = await loadStrategy(props.strategyFilename);
          strategyName.value = existingConfig.value.name;
          strategyDescription.value = existingConfig.value.description ?? "";
          isUpdateMode.value = true;
        } catch {
          // Strategy not found — fall back to create mode
          strategyName.value = props.defaultName ?? "";
          strategyDescription.value = "";
        }
      } else {
        strategyName.value = props.defaultName ?? "";
        strategyDescription.value = "";
      }
    }
  },
);
</script>

<template>
  <USlideover :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <div>
        <h3 class="text-lg font-semibold text-white">
          {{ isUpdateMode ? 'Strategie aktualisieren' : 'Strategie speichern' }}
        </h3>
        <p class="text-xs text-gray-500 mt-0.5">
          {{ isUpdateMode
            ? `Indikatoren in "${existingConfig?.name}" aktualisieren`
            : 'Aktuelle Indikatoren als neue Strategie speichern'
          }}
        </p>
      </div>
    </template>

    <template #body>
      <div class="space-y-5 p-1">
        <!-- Mode toggle when strategy is loaded -->
        <div v-if="strategyFilename" class="flex gap-2">
          <UButton
            :variant="isUpdateMode ? 'solid' : 'outline'"
            size="sm"
            @click="() => { isUpdateMode = true }"
          >
            Aktualisieren
          </UButton>
          <UButton
            :variant="!isUpdateMode ? 'solid' : 'outline'"
            size="sm"
            @click="() => { isUpdateMode = false }"
          >
            Neue Strategie
          </UButton>
        </div>

        <!-- Name -->
        <UFormField v-if="!isUpdateMode" label="Name" required>
          <UInput
            v-model="strategyName"
            placeholder="z.B. Trend Momentum V1"
            :disabled="status === 'saving' || status === 'saved'"
            class="w-full"
          />
        </UFormField>

        <!-- Description -->
        <UFormField v-if="!isUpdateMode" label="Beschreibung">
          <UTextarea
            v-model="strategyDescription"
            placeholder="Kurze Beschreibung der Strategie..."
            :disabled="status === 'saving' || status === 'saved'"
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <!-- Asset Info -->
        <div>
          <div class="text-sm text-gray-400 mb-2">Asset</div>
          <div class="flex gap-2">
            <UBadge :label="source" variant="subtle" />
            <UBadge :label="symbol" variant="subtle" color="primary" />
            <UBadge :label="timeframe" variant="subtle" color="success" />
          </div>
        </div>

        <!-- Indicator List -->
        <div>
          <div class="text-sm text-gray-400 mb-2">
            Indikatoren ({{ uniqueIndicators.length }})
          </div>
          <div class="space-y-2">
            <div
              v-for="ind in uniqueIndicators"
              :key="ind.fqn"
              class="rounded-md bg-gray-800/60 border border-gray-700/40 px-3 py-2"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-white">{{ ind.name }}</span>
                <UBadge :label="ind.fqn" variant="subtle" size="xs" />
                <UBadge v-if="ind.hasSignal" label="Signal" variant="subtle" color="success" size="xs" />
              </div>
              <p class="text-xs text-gray-500 mt-1 font-mono truncate">
                {{ displayParams(ind.params) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Signal Rules Status -->
        <div v-if="hasSignalRules" class="rounded-md bg-indigo-900/30 border border-indigo-700/40 px-3 py-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-bolt" class="text-indigo-400" />
            <span class="text-sm text-indigo-300">Signal Rules konfiguriert</span>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Setzt automatisch das Signal-Modell.
          </p>
        </div>

        <!-- Error -->
        <div v-if="status === 'error'" class="rounded-md bg-red-900/30 border border-red-700/40 p-3">
          <p class="text-sm text-red-300">{{ errorMessage }}</p>
        </div>

        <!-- Actions -->
        <div class="flex flex-col gap-2">
          <UButton
            v-if="status !== 'saved'"
            :loading="status === 'saving'"
            :disabled="!canSave"
            icon="i-lucide-save"
            block
            @click="save"
          >
            {{ isUpdateMode ? 'Strategie aktualisieren' : 'Strategie speichern' }}
          </UButton>

          <UButton
            v-if="status === 'saved' || (isUpdateMode && status !== 'saving')"
            icon="i-lucide-external-link"
            variant="soft"
            block
            @click="openStrategy"
          >
            Im Editor öffnen
          </UButton>
        </div>
      </div>
    </template>
  </USlideover>
</template>
