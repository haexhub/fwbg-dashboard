<script setup lang="ts">
import type { PluginInstance, PluginInfo, ParamSchema, ExitModifierInfo } from "~/types/strategy";

const props = defineProps<{
  instance: PluginInstance | null;
  pluginInfo: PluginInfo | undefined;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [params: Record<string, unknown>, exitMeta?: Record<string, unknown>];
}>();

// Local copy of params for editing
const localParams = ref<Record<string, unknown>>({});

// Exit-strategy-specific fields (CT, min_rrr, exit_modifier)
interface ExitFields {
  ct: string;
  long_ct: string;
  short_ct: string;
  min_rrr: number;
  exit_modifier: string;
}
const localExit = ref<ExitFields>({ ct: "0.5", long_ct: "", short_ct: "", min_rrr: 0, exit_modifier: "" });

// Exit modifier params as structured object
const localModifierParams = ref<Record<string, unknown>>({});

const isExitStrategy = computed(() => props.instance?.phase === "exit_strategies");

// Fetch available exit modifiers
const { data: exitModifiers } = useFetch<ExitModifierInfo[]>("/api/exit-modifiers", {
  default: () => [],
});

// Dropdown items for exit modifier selection
const MODIFIER_NONE = "__none__";

const modifierItems = computed(() => [
  { label: "Kein Modifier", value: MODIFIER_NONE },
  ...exitModifiers.value.map((m: ExitModifierInfo) => ({
    label: m.name,
    value: m.name,
  })),
]);

// Currently selected modifier's schema
const selectedModifierInfo = computed(() =>
  exitModifiers.value.find((m: ExitModifierInfo) => m.name === localExit.value.exit_modifier),
);

const modifierParamSchema = computed<Record<string, ParamSchema>>(() =>
  selectedModifierInfo.value?.param_schema ?? {},
);

const modifierParamEntries = computed(() => Object.entries(modifierParamSchema.value));

// When modifier selection changes, initialize params with defaults
watch(
  () => localExit.value.exit_modifier,
  (newModifier: string, oldModifier: string) => {
    if (newModifier !== oldModifier) {
      const info = exitModifiers.value.find((m: ExitModifierInfo) => m.name === newModifier);
      if (info) {
        localModifierParams.value = { ...info.defaults, ...localModifierParams.value };
      } else {
        localModifierParams.value = {};
      }
    }
  },
);

watch(
  () => props.instance,
  (inst) => {
    if (inst) {
      localParams.value = { ...props.pluginInfo?.defaults, ...inst.params };
      if (isExitStrategy.value) {
        const exitMeta = (inst as unknown as Record<string, unknown>)._exit as Record<string, unknown> | undefined;
        localExit.value = {
          ct: (exitMeta?.ct as number[])?.join(", ") ?? "0.5",
          long_ct: (exitMeta?.long_ct as number[])?.join(", ") ?? "",
          short_ct: (exitMeta?.short_ct as number[])?.join(", ") ?? "",
          min_rrr: (exitMeta?.min_rrr as number) ?? 0,
          exit_modifier: (exitMeta?.exit_modifier as string) ?? "",
        };
        localModifierParams.value = (exitMeta?.exit_modifier_params as Record<string, unknown>) ?? {};
      }
    }
  },
  { immediate: true },
);

const schema = computed<Record<string, ParamSchema>>(() => {
  return props.pluginInfo?.param_schema ?? {};
});

const paramEntries = computed(() => Object.entries(schema.value));

function parseNumberList(str: string): number[] {
  return str.split(",").map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n));
}

function handleSave() {
  let exitMeta: Record<string, unknown> | undefined;

  if (isExitStrategy.value) {
    const ctStr = String(localExit.value.ct ?? "0.5");
    const ct = parseNumberList(ctStr);
    const longCtStr = String(localExit.value.long_ct ?? "");
    const shortCtStr = String(localExit.value.short_ct ?? "");

    exitMeta = {
      ct: ct.length ? ct : [0.5],
      long_ct: longCtStr ? parseNumberList(longCtStr) : undefined,
      short_ct: shortCtStr ? parseNumberList(shortCtStr) : undefined,
      min_rrr: Number(localExit.value.min_rrr) || 0,
      exit_modifier: String(localExit.value.exit_modifier || "") || undefined,
      exit_modifier_params: localExit.value.exit_modifier
        ? { ...localModifierParams.value }
        : undefined,
    };
  }

  emit("save", { ...localParams.value }, exitMeta);
  emit("update:open", false);
}

function handleReset() {
  if (props.pluginInfo) {
    localParams.value = { ...props.pluginInfo.defaults };
  }
}
</script>

<template>
  <USlideover
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div>
        <h3 class="text-lg font-semibold text-white">
          {{ instance?.name ?? "Plugin Config" }}
        </h3>
        <p v-if="pluginInfo?.description" class="text-sm text-gray-400 mt-1">
          {{ pluginInfo.description }}
        </p>
        <div v-if="pluginInfo" class="flex gap-2 mt-2 text-xs text-gray-500">
          <span>v{{ pluginInfo.version }}</span>
          <span>{{ pluginInfo.namespace }}</span>
          <span>{{ pluginInfo.fqn }}</span>
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <div v-if="!paramEntries.length && !isExitStrategy" class="text-gray-400 text-sm py-4">
          This plugin has no configurable parameters.
        </div>

        <!-- Plugin params -->
        <StrategyParamField
          v-for="[name, paramSchema] in paramEntries"
          :key="name"
          :name="name"
          :schema="paramSchema"
          :model-value="localParams[name]"
          @update:model-value="localParams[name] = $event"
        />

        <!-- Exit strategy specific fields -->
        <template v-if="isExitStrategy">
          <USeparator label="Optimizer-Parameter" />

          <UFormField label="Confidence Thresholds (CT)" description="Kommagetrennte Werte, z.B. 0.45, 0.5, 0.55">
            <UInput v-model="localExit.ct" placeholder="0.5" />
          </UFormField>

          <UFormField label="Long CT" description="Optional: Separate CT für Long (leer = CT verwenden)">
            <UInput v-model="localExit.long_ct" placeholder="leer = gemeinsam" />
          </UFormField>

          <UFormField label="Short CT" description="Optional: Separate CT für Short (leer = CT verwenden)">
            <UInput v-model="localExit.short_ct" placeholder="leer = gemeinsam" />
          </UFormField>

          <UFormField label="Min Risk-Reward-Ratio" description="Filtert diese Instanz wenn TP/SL < Schwelle">
            <UInput v-model="localExit.min_rrr" type="number" step="0.1" placeholder="0" class="w-32" />
          </UFormField>

          <USeparator label="Exit Modifier" />

          <UFormField label="Exit Modifier" :description="selectedModifierInfo?.description || 'Optionales Modifier-Plugin (z.B. Trailing Stop)'">
            <USelect
              :model-value="String(localExit.exit_modifier || MODIFIER_NONE)"
              :items="modifierItems"
              value-key="value"
              class="w-full"
              @update:model-value="localExit.exit_modifier = $event === MODIFIER_NONE ? '' : $event"
            />
          </UFormField>

          <!-- Exit modifier params (schema-driven) -->
          <template v-if="localExit.exit_modifier && modifierParamEntries.length">
            <StrategyParamField
              v-for="[name, paramSchema] in modifierParamEntries"
              :key="`mod-${name}`"
              :name="name"
              :schema="paramSchema"
              :model-value="localModifierParams[name]"
              @update:model-value="localModifierParams[name] = $event"
            />
          </template>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center gap-2 w-full">
        <UButton @click="handleSave">
          Apply
        </UButton>
        <UButton variant="outline" @click="emit('update:open', false)">
          Cancel
        </UButton>
        <div class="flex-1" />
        <UButton variant="ghost" @click="handleReset">
          Reset to Defaults
        </UButton>
      </div>
    </template>
  </USlideover>
</template>
