<script setup lang="ts">
import type { SignalRules, SignalRuleSet, SignalPreviewResponse } from "~/types/strategy";

const props = defineProps<{
  modelValue?: SignalRules;
  strategyName: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: SignalRules];
}>();

const strategyNameRef = computed(() => props.strategyName);
const { columnItems, signalColumnItems, loading: columnsLoading, fetch: fetchColumns } = useSignalColumns(
  strategyNameRef,
);

onMounted(fetchColumns);

const rules = computed({
  get: () => props.modelValue ?? {},
  set: (v) => emit("update:modelValue", v),
});

const emptyRuleSet = (): SignalRuleSet => ({
  operator: "AND",
  conditions: [],
});

const longRules = computed({
  get: () => rules.value.long ?? emptyRuleSet(),
  set: (v) => emit("update:modelValue", { ...rules.value, long: v }),
});

const shortRules = computed({
  get: () => rules.value.short ?? emptyRuleSet(),
  set: (v) => emit("update:modelValue", { ...rules.value, short: v }),
});

// Preview
const preview = ref<{ long: number; short: number } | null>(null);
const previewLoading = ref(false);

async function fetchPreviewForDirection(dir: "long" | "short"): Promise<SignalPreviewResponse> {
  const r = dir === "long" ? longRules.value : shortRules.value;
  if (!r.conditions.length) return { match_count: 0, total_bars: 0, timestamps: [] };
  return $fetch<SignalPreviewResponse>("/api/signal-composer/preview", {
    method: "POST",
    body: {
      strategy_name: props.strategyName,
      rules: r,
      direction: dir,
    },
  });
}

async function loadPreview() {
  previewLoading.value = true;
  try {
    const [longRes, shortRes] = await Promise.all([
      fetchPreviewForDirection("long"),
      fetchPreviewForDirection("short"),
    ]);
    preview.value = { long: longRes.match_count, short: shortRes.match_count };
  } catch {
    preview.value = null;
  } finally {
    previewLoading.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="columnsLoading" class="text-sm text-gray-500">
      Spalten werden geladen...
    </div>

    <template v-else>
      <StrategySignalRuleGroup
        v-model="longRules"
        label="LONG"
        :column-items="columnItems"
        :signal-column-items="signalColumnItems"
      />

      <StrategySignalRuleGroup
        v-model="shortRules"
        label="SHORT"
        :column-items="columnItems"
        :signal-column-items="signalColumnItems"
      />

      <!-- Preview -->
      <div class="flex items-center gap-3">
        <UButton
          variant="soft"
          size="sm"
          :loading="previewLoading"
          icon="i-heroicons-eye"
          @click="loadPreview"
        >
          Preview
        </UButton>
        <span v-if="preview" class="text-sm text-gray-400">
          <span class="text-green-400">{{ preview.long }} Long</span> /
          <span class="text-red-400">{{ preview.short }} Short</span> Matches
        </span>
      </div>
    </template>
  </div>
</template>
