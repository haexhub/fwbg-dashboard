<script setup lang="ts">
import type { TranscriptRound } from "~/types/agents";

const props = defineProps<{ runId: number; transcripts: TranscriptRound[] }>();

// A pydantic-ai message: { kind: "request"|"response", parts: [...] }.
interface Part {
  part_kind?: string;
  content?: unknown;
  tool_name?: string;
  args?: unknown;
}
interface Message {
  kind?: string;
  parts?: Part[];
}

const selectedRound = ref<number>(props.transcripts[0]?.round ?? 1);
const messages = ref<Message[] | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function load(round: number) {
  // No transcript for this round yet (e.g. a flow-envelope run, which never
  // has one, or a leaf run still mid-round) — skip the request instead of
  // hitting the API for a 404 the template already renders around.
  if (!props.transcripts.some((t) => t.round === round)) return;
  loading.value = true;
  error.value = null;
  try {
    messages.value = await $fetch<Message[]>(`/api/agents/runs/${props.runId}/transcript`, {
      query: { round },
    });
  } catch (e) {
    error.value = "Transkript konnte nicht geladen werden.";
    messages.value = null;
  } finally {
    loading.value = false;
  }
}

watch(selectedRound, (r) => load(r), { immediate: true });

// Re-load the current round when the transcript set grows (a new round landed
// while a run is in progress).
watch(
  () => props.transcripts.length,
  () => load(selectedRound.value)
);

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

function partLabel(kind: string | undefined): string {
  switch (kind) {
    case "system-prompt":
      return "System-Prompt";
    case "user-prompt":
      return "User-Prompt";
    case "tool-call":
      return "Tool-Call";
    case "tool-return":
      return "Tool-Ergebnis";
    case "text":
      return "Antwort";
    default:
      return kind ?? "Part";
  }
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="props.transcripts.length === 0" class="py-8 text-center text-gray-500 text-sm">
      Kein Transkript vorhanden (Run ohne LLM-Session oder von vor diesem Feature).
    </div>

    <template v-else>
      <div v-if="props.transcripts.length > 1" class="flex items-center gap-2">
        <span class="text-xs text-gray-500">Runde</span>
        <select
          v-model.number="selectedRound"
          class="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
        >
          <option v-for="t in props.transcripts" :key="t.round" :value="t.round">
            {{ t.round }}
          </option>
        </select>
      </div>

      <div v-if="loading" class="py-6 text-center text-gray-500 text-sm">Lade Transkript…</div>
      <div v-else-if="error" class="py-6 text-center text-red-400 text-sm">{{ error }}</div>

      <div v-else-if="messages" class="space-y-2">
        <template v-for="(msg, mi) in messages" :key="mi">
          <div
            v-for="(part, pi) in msg.parts ?? []"
            :key="`${mi}-${pi}`"
            class="rounded-lg border border-gray-800 p-3"
          >
            <p class="text-xs font-medium text-gray-400 mb-1">{{ partLabel(part.part_kind) }}</p>

            <!-- system/user prompts: collapsed to keep the session readable -->
            <details v-if="part.part_kind === 'system-prompt' || part.part_kind === 'user-prompt'">
              <summary class="cursor-pointer text-xs text-gray-500">anzeigen</summary>
              <pre class="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-xs text-gray-300">{{ part.content }}</pre>
            </details>

            <!-- tool call -->
            <div v-else-if="part.part_kind === 'tool-call'">
              <p class="text-xs font-mono text-gray-300">{{ part.tool_name }}</p>
              <pre class="mt-1 overflow-x-auto rounded bg-gray-900 p-2 text-xs text-gray-300">{{ pretty(part.args) }}</pre>
            </div>

            <!-- tool return -->
            <div v-else-if="part.part_kind === 'tool-return'">
              <p class="text-xs font-mono text-gray-300">{{ part.tool_name }}</p>
              <pre class="mt-1 overflow-x-auto rounded bg-gray-900 p-2 text-xs text-gray-300">{{ pretty(part.content) }}</pre>
            </div>

            <!-- text / final answer -->
            <pre v-else class="overflow-x-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-xs text-gray-200">{{ pretty(part.content) }}</pre>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
