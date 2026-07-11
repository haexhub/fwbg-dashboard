<script setup lang="ts">
import type { AgentEvent } from "~/composables/useAgentEvents";

const { events, connected, connect, disconnect } = useAgentEvents();

onMounted(connect);
onUnmounted(disconnect);

function relativeTime(ts: string): string {
  const diffSec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diffSec < 5) return "now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function summarize(event: AgentEvent): string {
  const { ts, type, ...rest } = event;
  return JSON.stringify(rest);
}

function runIdOf(event: AgentEvent): number | null {
  const id = (event as { agent_run_id?: unknown }).agent_run_id;
  return typeof id === "number" ? id : null;
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-400">Live Event Feed</h3>
        <UBadge :color="connected ? 'success' : 'error'" variant="subtle" size="xs">
          {{ connected ? "Connected" : "Disconnected" }}
        </UBadge>
      </div>
    </template>

    <div v-if="!events.length" class="py-8 text-center text-gray-500 text-sm">
      Waiting for events...
    </div>

    <div v-else class="space-y-2 max-h-96 overflow-y-auto">
      <div
        v-for="(event, idx) in events"
        :key="`${event.ts}-${idx}`"
        class="flex items-start gap-2 text-sm"
      >
        <span class="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-white font-medium">{{ event.type }}</span>
            <span class="text-xs text-gray-500">{{ relativeTime(event.ts) }}</span>
            <NuxtLink
              v-if="runIdOf(event) !== null"
              :to="`/agents/runs/${runIdOf(event)}`"
              class="text-xs text-blue-400 hover:text-blue-300"
            >
              Run #{{ runIdOf(event) }}
            </NuxtLink>
          </div>
          <p class="text-xs text-gray-500 font-mono truncate">{{ summarize(event) }}</p>
        </div>
      </div>
    </div>
  </UCard>
</template>
