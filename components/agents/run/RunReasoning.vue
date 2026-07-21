<script setup lang="ts">
// Live LLM reasoning stream (llm_delta events, live-only via SSE). Shows the
// model's in-flight thinking / answer per round while a session runs; once a
// round finishes the buffer is cleared upstream and RunTranscript takes over.
interface ReasoningRound {
  runId: number;
  round: number;
  thinking: string;
  text: string;
}

const props = defineProps<{ rounds: ReasoningRound[] }>();

// All content is model output rendered as text — never v-html.
</script>

<template>
  <div v-if="props.rounds.length" class="space-y-2">
    <div
      v-for="r in props.rounds"
      :key="`${r.runId}:${r.round}`"
      class="rounded-lg border border-primary-900/50 bg-primary-950/20 p-3 text-xs"
    >
      <p class="mb-1 flex items-center gap-2 text-gray-400">
        <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-primary-400" />
        Live · Runde {{ r.round }}
      </p>
      <div v-if="r.thinking" class="mb-2">
        <p class="text-gray-500">Denkt …</p>
        <pre class="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-gray-400">{{ r.thinking }}</pre>
      </div>
      <div v-if="r.text">
        <p class="text-gray-500">Antwort …</p>
        <pre class="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-gray-200">{{ r.text }}</pre>
      </div>
    </div>
  </div>
</template>
