<script setup lang="ts">
import type { AgentConfig, AgentConfigListResponse } from "~/types/agents";
import { CONFIGURABLE_AGENT_LABELS } from "~/types/agents";

definePageMeta({ ssr: false });

const toast = useToast();
const { data, refresh, status, error } = await useFetch<AgentConfigListResponse>(
  "/api/agents/config",
);

const availableModels = computed(() => data.value?.available_models ?? []);

// Per-agent editable copy (model + prompt), keyed by agent name. Seeded from
// the server's effective values; user edits are preserved across refreshes.
const edits = reactive<Record<string, { model: string; prompt: string }>>({});
watchEffect(() => {
  for (const a of data.value?.agents ?? []) {
    if (!edits[a.name]) edits[a.name] = { model: a.model, prompt: a.prompt };
  }
});

const savingName = ref<string | null>(null);

function isDirty(a: AgentConfig): boolean {
  const e = edits[a.name];
  return !!e && (e.model !== a.model || e.prompt !== a.prompt);
}

function extractError(e: unknown): string {
  const err = e as { statusMessage?: string; data?: { detail?: string } };
  return err?.data?.detail ?? err?.statusMessage ?? "Aktion fehlgeschlagen";
}

async function save(a: AgentConfig) {
  const e = edits[a.name];
  if (!e) return;
  savingName.value = a.name;
  try {
    await $fetch(`/api/agents/config/${a.name}`, {
      method: "PUT",
      body: { model: e.model, prompt: e.prompt },
    });
    await refresh();
    toast.add({
      title: `${CONFIGURABLE_AGENT_LABELS[a.name] ?? a.name} gespeichert`,
      color: "success",
    });
  } catch (err) {
    toast.add({ title: "Fehler", description: extractError(err), color: "error" });
  } finally {
    savingName.value = null;
  }
}

async function resetToDefault(a: AgentConfig) {
  savingName.value = a.name;
  try {
    await $fetch(`/api/agents/config/${a.name}`, {
      method: "PUT",
      body: { model: "", prompt: "" },
    });
    await refresh();
    const fresh = data.value?.agents.find((x) => x.name === a.name);
    if (fresh) edits[a.name] = { model: fresh.model, prompt: fresh.prompt };
    toast.add({ title: "Auf Default zurückgesetzt", color: "success" });
  } catch (err) {
    toast.add({ title: "Fehler", description: extractError(err), color: "error" });
  } finally {
    savingName.value = null;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <NuxtLink to="/agents">
        <UButton icon="i-heroicons-arrow-left" variant="ghost" />
      </NuxtLink>
      <h2 class="text-xl font-semibold text-white">Agenten konfigurieren</h2>
    </div>

    <UAlert
      color="info"
      variant="subtle"
      icon="i-heroicons-information-circle"
      title="Modell & Persona pro Agent"
      description="Wähle pro Agent ein Claude-Modell und passe optional den System-Prompt (Persona) an. Platzhalter wie {{ asset_class }} müssen erhalten bleiben. Änderungen greifen beim nächsten Agent-Run."
    />

    <div v-if="error" class="py-12 text-center text-gray-400">
      fwbg-agents nicht erreichbar — Agenten-Konfiguration kann nicht geladen werden.
    </div>
    <div v-else-if="status === 'pending'" class="py-12 text-center text-gray-400">
      Lade Konfiguration…
    </div>

    <UCard v-for="a in data?.agents ?? []" v-else :key="a.name">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-cpu-chip" class="w-5 h-5 text-primary" />
            <span class="text-base font-semibold text-white">
              {{ CONFIGURABLE_AGENT_LABELS[a.name] ?? a.name }}
            </span>
            <UBadge v-if="a.has_model_override" color="primary" variant="subtle" size="xs">
              Modell angepasst
            </UBadge>
            <UBadge v-if="a.has_prompt_override" color="warning" variant="subtle" size="xs">
              Persona angepasst
            </UBadge>
          </div>
          <code class="text-xs text-gray-500 font-mono">{{ a.name }}</code>
        </div>
      </template>

      <div v-if="edits[a.name]" class="space-y-4">
        <UFormField label="Modell">
          <USelect
            v-model="edits[a.name].model"
            :items="availableModels"
            class="w-full sm:w-80"
          />
          <template #hint>
            <span class="text-xs text-gray-500">Default: {{ a.default_model }}</span>
          </template>
        </UFormField>

        <UFormField label="Persona / System-Prompt">
          <UTextarea
            v-model="edits[a.name].prompt"
            :rows="12"
            class="w-full font-mono text-xs"
            spellcheck="false"
          />
        </UFormField>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <UButton
            v-if="a.has_model_override || a.has_prompt_override"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-arrow-uturn-left"
            :loading="savingName === a.name"
            @click="resetToDefault(a)"
          >
            Auf Default zurücksetzen
          </UButton>
          <UButton
            color="primary"
            icon="i-heroicons-check"
            :loading="savingName === a.name"
            :disabled="!isDirty(a)"
            @click="save(a)"
          >
            Speichern
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
