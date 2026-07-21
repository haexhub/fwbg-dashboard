<script setup lang="ts">
import type { AgentRunEvent } from "~/types/agents";
import { agentLabel } from "~/types/agents";

const props = defineProps<{ events: AgentRunEvent[] }>();

// Untrusted web content flows through several event payloads (research_results
// titles, tool results). Everything here renders as text — never v-html.

function shortModel(m: unknown): string {
  return String(m ?? "").replace(/^claude-/, "").replace(/-\d{8}$/, "");
}

function pretty(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

function time(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString("de-DE");
  } catch {
    return ts;
  }
}

// Keys already rendered structurally per type — hidden from the generic dump.
const KNOWN_KEYS = new Set(["seq", "ts", "type", "agent_run_id", "agent_name", "round"]);

function extraPayload(e: AgentRunEvent): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(e).filter(([k]) => !KNOWN_KEYS.has(k))
  );
}
</script>

<template>
  <div v-if="props.events.length === 0" class="py-8 text-center text-gray-500 text-sm">
    Noch keine Timeline-Ereignisse für diesen Run.
  </div>

  <ol v-else class="space-y-2">
    <li
      v-for="e in props.events"
      :key="`${e.agent_run_id ?? 0}:${e.seq}`"
      class="rounded-lg border border-gray-800 p-3 text-xs"
      :class="e.type === 'implementer_round_failed' || e.type === 'agent_run_failed' ? 'border-red-900/60' : ''"
    >
      <div class="flex items-center gap-2 mb-1">
        <span class="font-mono text-gray-500 shrink-0">{{ time(e.ts) }}</span>
        <span
          v-if="e.agent_name"
          class="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-gray-400"
        >{{ agentLabel(e.agent_name as string) }}</span>
        <span class="font-medium text-gray-300">{{ e.type }}</span>
        <span v-if="e.round" class="text-gray-600">Runde {{ e.round }}</span>
      </div>

      <!-- flow_phase -->
      <div v-if="e.type === 'flow_phase'" class="flex items-center gap-2 text-gray-400">
        <span class="text-gray-500">▸</span>
        <span class="text-primary-400 font-medium">{{ e.phase }}</span>
        <span v-if="e.title" class="text-gray-400 truncate">· {{ e.title }}</span>
      </div>

      <!-- research_search -->
      <div v-else-if="e.type === 'research_search'" class="flex items-center gap-2">
        <span class="text-gray-500">🔍</span>
        <span class="font-mono text-gray-300 break-all">{{ e.query }}</span>
      </div>

      <!-- research_results -->
      <div v-else-if="e.type === 'research_results'" class="space-y-1">
        <p class="text-gray-500">Quellen ({{ (e.urls as unknown[])?.length ?? 0 }})</p>
        <a
          v-for="u in (e.urls as { url: string; title: string }[])"
          :key="u.url"
          :href="u.url"
          target="_blank"
          rel="noopener"
          class="block text-blue-400 hover:text-blue-300 truncate"
          :title="u.url"
        >
          {{ u.title || u.url }}
        </a>
      </div>

      <!-- hypothesis_ready -->
      <div v-else-if="e.type === 'hypothesis_ready'" class="space-y-1">
        <p class="text-emerald-400 font-medium">{{ e.title }}</p>
        <p class="text-gray-500">
          {{ e.strategy_family }} · {{ e.asset_class }}
        </p>
        <p class="text-gray-400">{{ e.summary }}</p>
      </div>

      <!-- llm_tool_call / llm_tool_result -->
      <details v-else-if="e.type === 'llm_tool_call' || e.type === 'llm_tool_result'">
        <summary class="cursor-pointer text-gray-400">
          {{ e.type === "llm_tool_call" ? "→" : "←" }} {{ e.tool_name }}
        </summary>
        <pre class="mt-1 overflow-x-auto rounded bg-gray-900 p-2 text-gray-300">{{ pretty(e.args ?? e.result) }}</pre>
      </details>

      <!-- llm_round_done -->
      <div v-else-if="e.type === 'llm_round_done'" class="text-gray-400">
        {{ shortModel(e.model) }} · {{ e.input_tokens }}→{{ e.output_tokens }} Tokens
      </div>

      <!-- implementer_round_failed -->
      <div v-else-if="e.type === 'implementer_round_failed'" class="text-red-400 break-all">
        {{ e.error }}
      </div>

      <!-- backtest_submitted / progress / done -->
      <div v-else-if="e.type?.startsWith('backtest_')" class="space-y-1">
        <NuxtLink
          v-if="e.fwbg_run_id"
          :to="`/runs/${e.fwbg_run_id}`"
          class="text-blue-400 hover:text-blue-300 font-mono"
        >
          Backtest {{ e.fwbg_run_id }} →
        </NuxtLink>
        <span v-if="e.status" class="text-gray-400 ml-2">{{ e.status }}</span>
        <pre
          v-if="e.metrics"
          class="mt-1 overflow-x-auto rounded bg-gray-900 p-2 text-gray-300"
        >{{ pretty(e.metrics) }}</pre>
      </div>

      <!-- agent_run_failed -->
      <div v-else-if="e.type === 'agent_run_failed'" class="text-red-400 break-all">
        {{ e.error }}
      </div>

      <!-- generic fallback -->
      <pre
        v-else-if="Object.keys(extraPayload(e)).length"
        class="overflow-x-auto rounded bg-gray-900 p-2 text-gray-400"
      >{{ pretty(extraPayload(e)) }}</pre>
    </li>
  </ol>
</template>
