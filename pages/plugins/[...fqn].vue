<script setup lang="ts">
import { PHASE_LABELS, PHASE_ICONS, PHASE_COLORS } from "~/types/strategy";
import type { PluginInfo, PluginTestResult } from "~/types/strategy";

const route = useRoute();
const fqn = computed(() => (route.params.fqn as string[]).join("/"));

const { getPlugin } = usePlugins();
const plugin = computed(() => getPlugin(fqn.value));

const testResult = ref<PluginTestResult | null>(null);
const testing = ref(false);

async function runTests() {
  testing.value = true;
  testResult.value = null;
  try {
    testResult.value = await $fetch<PluginTestResult>(
      `/api/strategy/plugins/${encodeURIComponent(fqn.value)}/tests`,
      { method: "POST" }
    );
  } catch (e: any) {
    testResult.value = {
      fqn: fqn.value,
      has_tests: false,
      status: "failed",
      message: e.message ?? "Request failed",
    };
  } finally {
    testing.value = false;
  }
}

const paramEntries = computed(() => {
  if (!plugin.value) return [];
  return Object.entries(plugin.value.param_schema);
});

// ── Plugin docs (README) ──
const { data: docs } = useFetch<{ has_docs: boolean; readme: string | null }>(
  () => `/api/strategy/plugins/${encodeURIComponent(fqn.value)}/docs`,
  { watch: [fqn] }
);
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink to="/plugins">
          <UButton icon="i-heroicons-arrow-left" variant="ghost" />
        </NuxtLink>
        <h2 class="text-xl font-semibold text-white">
          {{ plugin?.name ?? fqn }}
        </h2>
        <UBadge
          v-if="plugin"
          :color="(PHASE_COLORS[plugin.phase] as any)"
          variant="subtle"
        >
          {{ PHASE_LABELS[plugin.phase] }}
        </UBadge>
      </div>
      <UButton
        icon="i-heroicons-play"
        :loading="testing"
        @click="runTests"
      >
        Run Tests
      </UButton>
    </div>

    <div v-if="!plugin" class="py-16 text-center text-gray-400">
      Plugin "{{ fqn }}" not found. Make sure the fwbg API is running.
    </div>

    <template v-else>
      <!-- Plugin Info -->
      <UCard>
        <template #header>
          <h3 class="text-sm font-medium text-gray-400">Plugin Details</h3>
        </template>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span class="text-gray-500">FQN</span>
            <p class="text-white font-mono">{{ plugin.fqn }}</p>
          </div>
          <div>
            <span class="text-gray-500">Version</span>
            <p class="text-white">{{ plugin.version }}</p>
          </div>
          <div>
            <span class="text-gray-500">Namespace</span>
            <p class="text-white">{{ plugin.namespace }}</p>
          </div>
          <div>
            <span class="text-gray-500">Phase</span>
            <p class="text-white">{{ PHASE_LABELS[plugin.phase] }}</p>
          </div>
        </div>
        <p v-if="plugin.description" class="text-gray-400 mt-4">
          {{ plugin.description }}
        </p>
      </UCard>

      <!-- Parameter Schema -->
      <UCard v-if="paramEntries.length">
        <template #header>
          <h3 class="text-sm font-medium text-gray-400">
            Parameters ({{ paramEntries.length }})
          </h3>
        </template>
        <div class="divide-y divide-gray-800">
          <div
            v-for="[name, schema] in paramEntries"
            :key="name"
            class="py-3 grid grid-cols-12 gap-4 text-sm"
          >
            <div class="col-span-3">
              <span class="font-mono text-white">{{ name }}</span>
            </div>
            <div class="col-span-2">
              <UBadge color="neutral" variant="subtle" size="xs">
                {{ schema.type }}
              </UBadge>
            </div>
            <div class="col-span-2 text-gray-400">
              <span v-if="Array.isArray(schema.default)">
                [{{ schema.default.join(', ') }}]
              </span>
              <span v-else>{{ schema.default }}</span>
            </div>
            <div class="col-span-2 text-gray-500 text-xs">
              <span v-if="schema.min != null || schema.max != null">
                {{ schema.min ?? '...' }} – {{ schema.max ?? '...' }}
              </span>
            </div>
            <div class="col-span-3 text-gray-500 text-xs">
              {{ schema.description }}
            </div>
          </div>
        </div>
      </UCard>

      <!-- README -->
      <UCard v-if="docs?.readme">
        <template #header>
          <h3 class="text-sm font-medium text-gray-400">README</h3>
        </template>
        <MDC
          :value="docs.readme"
          class="prose prose-invert prose-sm max-w-none
            prose-headings:text-white prose-headings:font-semibold
            prose-p:text-gray-300 prose-p:leading-relaxed
            prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
            prose-code:text-emerald-400 prose-code:bg-gray-900 prose-code:px-1 prose-code:rounded
            prose-pre:bg-gray-950 prose-pre:border prose-pre:border-gray-800
            prose-strong:text-white
            prose-ul:text-gray-300 prose-ol:text-gray-300
            prose-li:marker:text-gray-500
            prose-hr:border-gray-800
            prose-blockquote:border-blue-500 prose-blockquote:text-gray-400"
        />
      </UCard>

      <!-- Test Results -->
      <UCard v-if="testResult">
        <template #header>
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-medium text-gray-400">Test Results</h3>
            <UBadge
              :color="testResult.status === 'passed' ? 'success' : testResult.status === 'failed' ? 'error' : 'warning'"
              variant="subtle"
              size="xs"
            >
              {{ testResult.status }}
            </UBadge>
          </div>
        </template>
        <div v-if="testResult.message" class="text-sm text-gray-400">
          {{ testResult.message }}
        </div>
        <pre
          v-if="testResult.stdout"
          class="text-xs text-gray-300 bg-gray-950 rounded p-3 overflow-x-auto whitespace-pre-wrap mt-2"
        >{{ testResult.stdout }}</pre>
        <pre
          v-if="testResult.stderr"
          class="text-xs text-red-400 bg-gray-950 rounded p-3 overflow-x-auto whitespace-pre-wrap mt-2"
        >{{ testResult.stderr }}</pre>
      </UCard>
    </template>
  </div>
</template>
