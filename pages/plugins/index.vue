<script setup lang="ts">
import {
  PIPELINE_PHASES,
  PHASE_LABELS,
  PHASE_ICONS,
  PHASE_COLORS,
} from "~/types/strategy";
import type { PluginInfo, PipelinePhase } from "~/types/strategy";

const pluginStore = usePluginStore();
const { plugins, pluginsByPhase, status } = storeToRefs(pluginStore);
pluginStore.load();

const searchQuery = ref("");
const selectedPhase = ref<PipelinePhase | "all">("all");

const filteredPlugins = computed(() => {
  let list = plugins.value ?? [];

  if (selectedPhase.value !== "all") {
    list = list.filter((p) => p.phase === selectedPhase.value);
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.fqn.toLowerCase().includes(q)
    );
  }

  return list;
});

const phaseOptions = computed(() => [
  { label: `All (${plugins.value?.length ?? 0})`, value: "all" },
  ...PIPELINE_PHASES.map((phase) => ({
    label: `${PHASE_LABELS[phase]} (${pluginsByPhase.value[phase]?.length ?? 0})`,
    value: phase,
  })),
]);
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">Plugins</h2>
      <div class="flex gap-2">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search plugins..."
          class="w-64"
        />
        <USelect
          v-model="selectedPhase"
          :items="phaseOptions"
          value-key="value"
          class="w-48"
        />
      </div>
    </div>

    <div v-if="status === 'pending'" class="py-8 text-center text-gray-400">
      Loading plugins...
    </div>

    <div v-else class="grid gap-3">
      <UCard
        v-for="plugin in filteredPlugins"
        :key="plugin.fqn"
        class="hover:ring-1 hover:ring-gray-700 transition-all"
      >
        <div class="flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <UIcon :name="PHASE_ICONS[plugin.phase]" class="text-gray-400" />
              <span class="font-medium text-white">{{ plugin.name }}</span>
              <UBadge
                :color="PHASE_COLORS[plugin.phase] as any"
                variant="subtle"
                size="xs"
              >
                {{ PHASE_LABELS[plugin.phase] }}
              </UBadge>
              <span
                v-if="plugin.signal_columns?.length"
                class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400"
              >
                SIG
              </span>
              <span class="text-xs text-gray-500">{{ plugin.namespace }}</span>
            </div>
            <p v-if="plugin.description" class="text-sm text-gray-400 mt-1">
              {{ plugin.description }}
            </p>
            <div class="flex gap-4 mt-2 text-xs text-gray-500">
              <span>v{{ plugin.version }}</span>
              <span>{{ Object.keys(plugin.param_schema).length }} params</span>
              <span>{{ plugin.fqn }}</span>
            </div>
          </div>
          <NuxtLink :to="`/plugins/${encodeURIComponent(plugin.fqn)}`">
            <UButton
              icon="i-heroicons-arrow-right"
              variant="ghost"
            />
          </NuxtLink>
        </div>
      </UCard>
    </div>
  </div>
</template>
