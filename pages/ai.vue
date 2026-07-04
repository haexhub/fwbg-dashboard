<script setup lang="ts">
const route = useRoute();

const initialMessage = computed<string | undefined>(() => {
  const runId = route.query.runId as string | undefined;
  const strategy = route.query.strategy as string | undefined;
  if (!runId && !strategy) return undefined;

  const parts: string[] = [];
  if (runId && strategy) {
    parts.push(`Analysiere Run \`${runId}\` der Strategie \`${strategy}\`.`);
  } else if (runId) {
    parts.push(`Analysiere Run \`${runId}\`.`);
  } else if (strategy) {
    parts.push(`Analysiere die Strategie \`${strategy}\`.`);
  }
  parts.push("Lade zunächst die Ergebnisse und erkläre mir dann die wichtigsten KPIs sowie konkrete Verbesserungsvorschläge.");
  return parts.join(" ");
});

useSeoMeta({ title: "AI Assistent – FWBG" });
</script>

<template>
  <div class="h-[calc(100vh-8rem)] flex flex-col">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-gray-100">AI Assistent</h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Strategien konfigurieren, Runs starten und Ergebnisse analysieren
        </p>
      </div>
      <div class="flex items-center gap-2 text-xs text-gray-600">
        <UIcon name="i-heroicons-cpu-chip" class="w-3.5 h-3.5" />
        <span>Claude · OpenAI · Gemini · DeepSeek</span>
      </div>
    </div>

    <AiLlmConnectionCard class="mb-4" />

    <div class="flex-1 rounded-xl border border-gray-800 overflow-hidden min-h-0">
      <AiChat :initial-message="initialMessage" />
    </div>
  </div>
</template>
