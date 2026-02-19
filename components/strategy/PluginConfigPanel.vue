<script setup lang="ts">
import type { PluginInstance, PluginInfo, ParamSchema } from "~/types/strategy";

const props = defineProps<{
  instance: PluginInstance | null;
  pluginInfo: PluginInfo | undefined;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [params: Record<string, unknown>];
}>();

// Local copy of params for editing
const localParams = ref<Record<string, unknown>>({});

watch(
  () => props.instance,
  (inst) => {
    if (inst) {
      localParams.value = { ...inst.params };
    }
  },
  { immediate: true }
);

const schema = computed<Record<string, ParamSchema>>(() => {
  return props.pluginInfo?.param_schema ?? {};
});

const paramNames = computed(() => Object.keys(schema.value));

function handleSave() {
  emit("save", { ...localParams.value });
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
        <div v-if="!paramNames.length" class="text-gray-400 text-sm py-4">
          This plugin has no configurable parameters.
        </div>

        <StrategyParamField
          v-for="name in paramNames"
          :key="name"
          :name="name"
          :schema="schema[name]!"
          :model-value="localParams[name]"
          @update:model-value="localParams[name] = $event"
        />
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
