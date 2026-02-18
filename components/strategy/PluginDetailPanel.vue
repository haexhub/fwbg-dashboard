<script setup lang="ts">
import { PHASE_LABELS, PHASE_COLORS } from "~/types/strategy";
import type { PluginInfo, ParamSchema } from "~/types/strategy";

const props = defineProps<{
  plugin: PluginInfo | null;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const paramEntries = computed(() => {
  if (!props.plugin) return [];
  return Object.entries(props.plugin.param_schema);
});

function formatDefault(schema: ParamSchema): string {
  const val = schema.default;
  if (val == null) return "-";
  if (Array.isArray(val)) return `[${val.join(", ")}]`;
  if (typeof val === "boolean") return val ? "true" : "false";
  return String(val);
}

function formatType(schema: ParamSchema): string {
  if (schema.type === "choice" && schema.choices?.length) {
    return `choice: ${schema.choices.join(" | ")}`;
  }
  return schema.type;
}

function formatRange(schema: ParamSchema): string | null {
  if (schema.min == null && schema.max == null) return null;
  const min = schema.min ?? "...";
  const max = schema.max ?? "...";
  const step = schema.step ? `, step ${schema.step}` : "";
  return `${min} – ${max}${step}`;
}
</script>

<template>
  <USlideover
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div v-if="plugin">
        <div class="flex items-center gap-2">
          <h3 class="text-lg font-semibold text-white">
            {{ plugin.name }}
          </h3>
          <UBadge
            :color="(PHASE_COLORS[plugin.phase] as any)"
            variant="subtle"
            size="xs"
          >
            {{ PHASE_LABELS[plugin.phase] }}
          </UBadge>
        </div>
        <div class="flex gap-2 mt-1.5 text-xs text-gray-500">
          <span>v{{ plugin.version }}</span>
          <span>&middot;</span>
          <span>{{ plugin.namespace }}</span>
          <span>&middot;</span>
          <span class="font-mono">{{ plugin.fqn }}</span>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="plugin" class="space-y-6">
        <!-- Description -->
        <div v-if="plugin.description">
          <p class="text-sm text-gray-300 leading-relaxed">
            {{ plugin.description }}
          </p>
        </div>

        <!-- Properties -->
        <div class="flex gap-3">
          <UBadge v-if="plugin.stateful" color="warning" variant="subtle" size="xs">
            stateful
          </UBadge>
          <UBadge v-if="plugin.cacheable" color="success" variant="subtle" size="xs">
            cacheable
          </UBadge>
          <UBadge v-if="!plugin.stateful" color="neutral" variant="subtle" size="xs">
            stateless
          </UBadge>
        </div>

        <!-- Parameters -->
        <div>
          <h4 class="text-sm font-medium text-gray-400 mb-3">
            Parameters
            <span class="text-gray-600">({{ paramEntries.length }})</span>
          </h4>

          <div v-if="!paramEntries.length" class="text-sm text-gray-500">
            No configurable parameters.
          </div>

          <div class="space-y-3">
            <div
              v-for="[name, schema] in paramEntries"
              :key="name"
              class="rounded-md border border-gray-800 bg-gray-900/50 p-3"
            >
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-sm font-mono text-white">{{ name }}</span>
                <span class="text-xs text-gray-500 shrink-0">{{ formatType(schema) }}</span>
              </div>

              <p v-if="schema.description" class="text-xs text-gray-400 mt-1">
                {{ schema.description }}
              </p>

              <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                <span>
                  Default: <span class="text-gray-400 font-mono">{{ formatDefault(schema) }}</span>
                </span>
                <span v-if="formatRange(schema)">
                  Range: <span class="text-gray-400">{{ formatRange(schema) }}</span>
                </span>
                <span v-if="schema.required === false" class="text-yellow-600">
                  optional
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
