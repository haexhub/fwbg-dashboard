<script setup lang="ts">
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
      <AiChat />
    </div>
  </div>
</template>
