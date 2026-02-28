<script setup lang="ts">
import type { PluginInstance, PluginInfo, ParamSchema } from "~/types/strategy";

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
const localExit = ref<Record<string, unknown>>({});

const isExitStrategy = computed(() => props.instance?.phase === "exit_strategies");

watch(
  () => props.instance,
  (inst) => {
    if (inst) {
      localParams.value = { ...props.pluginInfo?.defaults, ...inst.params };
      if (isExitStrategy.value) {
        const exitMeta = (inst as Record<string, unknown>)._exit as Record<string, unknown> | undefined;
        localExit.value = {
          ct: (exitMeta?.ct as number[])?.join(", ") ?? "0.5",
          long_ct: (exitMeta?.long_ct as number[])?.join(", ") ?? "",
          short_ct: (exitMeta?.short_ct as number[])?.join(", ") ?? "",
          min_rrr: exitMeta?.min_rrr ?? 0,
          exit_modifier: exitMeta?.exit_modifier ?? "",
          exit_modifier_params: exitMeta?.exit_modifier_params
            ? JSON.stringify(exitMeta.exit_modifier_params)
            : "",
        };
      }
    }
  },
  { immediate: true }
);

const schema = computed<Record<string, ParamSchema>>(() => {
  return props.pluginInfo?.param_schema ?? {};
});

const paramNames = computed(() => Object.keys(schema.value));

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

    let exitModifierParams: Record<string, unknown> | undefined;
    const emParamsStr = String(localExit.value.exit_modifier_params ?? "").trim();
    if (emParamsStr) {
      try { exitModifierParams = JSON.parse(emParamsStr); } catch { /* ignore */ }
    }

    exitMeta = {
      ct: ct.length ? ct : [0.5],
      long_ct: longCtStr ? parseNumberList(longCtStr) : undefined,
      short_ct: shortCtStr ? parseNumberList(shortCtStr) : undefined,
      min_rrr: Number(localExit.value.min_rrr) || 0,
      exit_modifier: String(localExit.value.exit_modifier || "") || undefined,
      exit_modifier_params: exitModifierParams,
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
        <div v-if="!paramNames.length && !isExitStrategy" class="text-gray-400 text-sm py-4">
          This plugin has no configurable parameters.
        </div>

        <!-- Plugin params -->
        <StrategyParamField
          v-for="name in paramNames"
          :key="name"
          :name="name"
          :schema="schema[name]!"
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

          <UFormField label="Exit Modifier" description="Optionales Plugin (z.B. trailing_stop)">
            <UInput v-model="localExit.exit_modifier" placeholder="z.B. trailing_stop" />
          </UFormField>

          <UFormField v-if="localExit.exit_modifier" label="Exit Modifier Params" description="JSON-Objekt">
            <UTextarea v-model="localExit.exit_modifier_params" placeholder='{"breakeven_trigger": 0.5}' :rows="3" />
          </UFormField>
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
