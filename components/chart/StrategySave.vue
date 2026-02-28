<script setup lang="ts">
import type { ActiveIndicator } from "~/types/chart";

const props = defineProps<{
  open: boolean;
  source: string;
  symbol: string;
  timeframe: string;
  assetClass?: string;
  activeIndicators: ActiveIndicator[];
  defaultName?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const toast = useToast();
const { createStrategy } = useStrategies();

const strategyName = ref("");
const strategyDescription = ref("");
const status = ref<"idle" | "saving" | "saved" | "error">("idle");
const savedFilename = ref("");
const errorMessage = ref("");

const canSave = computed(
  () => strategyName.value.trim().length > 0 && (status.value === "idle" || status.value === "error"),
);

// De-duplicate indicators by FQN (same indicator can appear as plot + signal)
const uniqueIndicators = computed(() => {
  const seen = new Set<string>();
  return props.activeIndicators.filter((ind) => {
    if (seen.has(ind.fqn)) return false;
    seen.add(ind.fqn);
    return true;
  });
});

// Build non-default params display for an indicator
function displayParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return "Defaults";
  return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ");
}

async function save() {
  if (!canSave.value) return;
  status.value = "saving";
  errorMessage.value = "";

  // Build pipeline entries from de-duplicated indicators
  const indicators = uniqueIndicators.value.map((ind: ActiveIndicator) => ({
    name: ind.fqn.split(":")[1] ?? ind.name.replace(/ \(signal\)$/, ""),
    params: ind.params,
  }));

  try {
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
      exit_strategy: "fixed",
      exit_params: { tp_mult: [2.0], sl_mult: [1.0] },
      model: {
        type: "xgboost",
        architecture: "long_short_separate",
        trade_directions: ["long", "short"],
        hyperparameters: {},
      },
      optimization: { ct: [0.5] },
      validation: { method: "walk_forward", folds: 8 },
      filters: {},
      resources: {},
    });

    savedFilename.value = res.filename;
    status.value = "saved";
    toast.add({
      title: "Strategie erstellt",
      description: `"${strategyName.value}" wurde gespeichert.`,
      color: "success",
    });
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

// Reset state when slideover opens, pre-fill name from preview if available
watch(
  () => props.open,
  (open) => {
    if (open) {
      strategyName.value = props.defaultName ?? "";
      strategyDescription.value = "";
      status.value = "idle";
      savedFilename.value = "";
      errorMessage.value = "";
    }
  },
);
</script>

<template>
  <USlideover :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <div>
        <h3 class="text-lg font-semibold text-white">Strategie speichern</h3>
        <p class="text-xs text-gray-500 mt-0.5">
          Aktuelle Indikatoren als neue Strategie speichern
        </p>
      </div>
    </template>

    <template #body>
      <div class="space-y-5 p-1">
        <!-- Name -->
        <UFormField label="Name" required>
          <UInput
            v-model="strategyName"
            placeholder="z.B. Trend Momentum V1"
            :disabled="status === 'saving' || status === 'saved'"
            class="w-full"
          />
        </UFormField>

        <!-- Description -->
        <UFormField label="Beschreibung">
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
              </div>
              <p class="text-xs text-gray-500 mt-1 font-mono truncate">
                {{ displayParams(ind.params) }}
              </p>
            </div>
          </div>
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
            Strategie speichern
          </UButton>

          <template v-if="status === 'saved'">
            <UButton
              icon="i-lucide-external-link"
              variant="soft"
              block
              @click="openStrategy"
            >
              Strategie bearbeiten
            </UButton>
          </template>
        </div>
      </div>
    </template>
  </USlideover>
</template>
