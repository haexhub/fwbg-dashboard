<script setup lang="ts">
import { agentPluginStateColor } from "~/types/agents";
import type { AgentPluginDetail, VerificationRun } from "~/types/agents";

definePageMeta({ ssr: false });

const route = useRoute();
const pluginId = computed(() => Number(route.params.id));

const { getPluginDetail, getVerificationRuns } = useAgentPlugins();

const detail = ref<AgentPluginDetail | null>(null);
const verificationRuns = ref<VerificationRun[]>([]);
const loading = ref(true);
const notFound = ref(false);

const plugin = computed(() => detail.value?.plugin ?? null);

async function loadDetail() {
  loading.value = true;
  notFound.value = false;
  try {
    detail.value = await getPluginDetail(pluginId.value);
    verificationRuns.value = await getVerificationRuns(pluginId.value);
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) {
      notFound.value = true;
    } else {
      throw e;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(loadDetail);

const tabItems = [
  { label: "Overview", value: "overview" },
  { label: "Spec", value: "spec" },
  { label: "Transitions", value: "transitions" },
  { label: "Verification Runs", value: "verification" },
];
const selectedTab = ref("overview");

function formatDate(ts?: string | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="py-16 text-center text-gray-400">
      Lade Plugin...
    </div>

    <div v-else-if="notFound" class="py-16 text-center text-gray-400">
      Plugin nicht gefunden.
    </div>

    <template v-else-if="plugin">
      <!-- Header -->
      <div class="flex items-center gap-3">
        <NuxtLink to="/agents/plugins">
          <UButton icon="i-heroicons-arrow-left" variant="ghost" />
        </NuxtLink>
        <h2 class="text-xl font-semibold text-white font-mono">{{ plugin.slug }}</h2>
        <UBadge :color="agentPluginStateColor(plugin.current_state)" variant="subtle">
          {{ plugin.current_state }}
        </UBadge>
        <UBadge color="neutral" variant="subtle">{{ plugin.kind }}</UBadge>
      </div>

      <!-- Tabs -->
      <UTabs v-model="selectedTab" :items="tabItems" variant="link" />

      <!-- Overview -->
      <UCard v-if="selectedTab === 'overview'">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span class="text-gray-500">ID</span>
            <p class="text-white font-mono">{{ plugin.id }}</p>
          </div>
          <div>
            <span class="text-gray-500">Kind</span>
            <p class="text-white">{{ plugin.kind }}</p>
          </div>
          <div>
            <span class="text-gray-500">Erstellt</span>
            <p class="text-white">{{ formatDate(plugin.created_at) }}</p>
          </div>
          <div>
            <span class="text-gray-500">Aktualisiert</span>
            <p class="text-white">{{ formatDate(plugin.updated_at) }}</p>
          </div>
        </div>
        <div class="mt-4 space-y-1 text-xs text-gray-500">
          <p v-if="plugin.spec_path">Spec: <span class="font-mono">{{ plugin.spec_path }}</span></p>
          <p v-if="plugin.contract_path">Contract: <span class="font-mono">{{ plugin.contract_path }}</span></p>
          <p v-if="plugin.post_mortem_path">Post-Mortem: <span class="font-mono">{{ plugin.post_mortem_path }}</span></p>
        </div>
      </UCard>

      <!-- Spec: the API only exposes this metadata object, not the underlying
           spec file content (only its on-disk path). -->
      <UCard v-else-if="selectedTab === 'spec'">
        <pre class="text-xs text-gray-300 bg-gray-950 rounded p-3 overflow-x-auto">{{ JSON.stringify(plugin, null, 2) }}</pre>
      </UCard>

      <!-- Transitions -->
      <UCard v-else-if="selectedTab === 'transitions'" :ui="{ body: 'p-0 sm:p-0' }">
        <div v-if="!detail?.transitions.length" class="py-8 text-center text-gray-400">
          No transitions yet.
        </div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-500 border-b border-gray-800">
              <th class="px-4 py-2">From</th>
              <th class="px-4 py-2">To</th>
              <th class="px-4 py-2">Reason</th>
              <th class="px-4 py-2">By</th>
              <th class="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <tr v-for="t in detail?.transitions" :key="t.id">
              <td class="px-4 py-2 text-gray-400">{{ t.from_state ?? "-" }}</td>
              <td class="px-4 py-2">
                <UBadge :color="agentPluginStateColor(t.to_state)" variant="subtle" size="xs">
                  {{ t.to_state }}
                </UBadge>
              </td>
              <td class="px-4 py-2 text-gray-400">{{ t.reason || "-" }}</td>
              <td class="px-4 py-2 text-gray-400">{{ t.created_by }}</td>
              <td class="px-4 py-2 text-gray-400">{{ formatDate(t.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </UCard>

      <!-- Verification Runs -->
      <UCard v-else-if="selectedTab === 'verification'" :ui="{ body: 'p-0 sm:p-0' }">
        <div v-if="!verificationRuns.length" class="py-8 text-center text-gray-400">
          No verification runs yet.
        </div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-500 border-b border-gray-800">
              <th class="px-4 py-2">Status</th>
              <th class="px-4 py-2">Scenarios</th>
              <th class="px-4 py-2">Started</th>
              <th class="px-4 py-2">Ended</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <tr v-for="vr in verificationRuns" :key="vr.id">
              <td class="px-4 py-2">
                <UBadge :color="vr.status === 'passed' ? 'success' : vr.status === 'failed' ? 'error' : 'warning'" variant="subtle" size="xs">
                  {{ vr.status }}
                </UBadge>
              </td>
              <td class="px-4 py-2 text-gray-400">{{ vr.scenarios_passed }} / {{ vr.scenarios_run }}</td>
              <td class="px-4 py-2 text-gray-400">{{ formatDate(vr.started_at) }}</td>
              <td class="px-4 py-2 text-gray-400">{{ formatDate(vr.ended_at) }}</td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </template>
  </div>
</template>
