<script setup lang="ts">
import type { ResearchBriefInput, ResearchBriefResponse } from "~/types/agents";

defineProps<{ open: boolean }>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();

// Strategy-first: research is asset-agnostic by default. The optional asset
// class is constrained to fwbg's registry (single source of truth) — no
// free-text, so it can never drift from what the backend accepts at intake.
const { classes, status: classesStatus } = useAssetClasses();
const toast = useToast();

const assetClass = ref<string | undefined>(undefined);
const strategyFamilyHint = ref("");
const freeTextBrief = ref("");
const submitting = ref(false);
const errorMessage = ref("");

// Always submittable: no asset class = asset-agnostic research.
const scopeLabel = computed(() =>
  assetClass.value ? assetClass.value : "asset-agnostisch",
);

function resetForm() {
  assetClass.value = undefined;
  strategyFamilyHint.value = "";
  freeTextBrief.value = "";
  errorMessage.value = "";
}

function close() {
  emit("update:open", false);
  resetForm();
}

async function submit() {
  submitting.value = true;
  errorMessage.value = "";
  try {
    const body: ResearchBriefInput = {
      asset_class: assetClass.value?.trim() || undefined,
      strategy_family_hint: strategyFamilyHint.value.trim() || undefined,
      free_text_brief: freeTextBrief.value.trim() || undefined,
    };
    const result = await $fetch<ResearchBriefResponse>("/api/agents/research/brief", {
      method: "POST",
      body,
    });
    toast.add({
      title: "Research gestartet",
      description: `Agent-Run #${result.agent_run_id} läuft. ${result.message}`,
      color: "success",
    });
    emit("created");
    close();
    // Open the run straight away so its live timeline/reasoning is visible.
    await navigateTo(`/agents/runs/${result.agent_run_id}`);
  } catch (e) {
    const err = e as { statusMessage?: string; message?: string; data?: { detail?: string; message?: string } };
    errorMessage.value =
      err?.data?.detail ?? err?.data?.message ?? err?.statusMessage ?? err?.message ?? "Research konnte nicht gestartet werden";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard class="w-full max-w-lg">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-sparkles" class="w-6 h-6 text-primary" />
            <span class="text-lg font-bold text-white">New Research</span>
          </div>
        </template>

        <div class="space-y-4">
          <UFormField label="Asset Class (optional)">
            <div class="flex items-center gap-2">
              <USelectMenu
                v-model="assetClass"
                :items="classes"
                :loading="classesStatus === 'pending'"
                placeholder="Asset-agnostisch (empfohlen)"
                class="w-full"
              />
              <UButton
                v-if="assetClass"
                icon="i-heroicons-x-mark"
                variant="ghost"
                color="neutral"
                size="sm"
                aria-label="Auswahl löschen"
                @click="assetClass = undefined"
              />
            </div>
            <template #help>
              Leer lassen für asset-agnostische Recherche — der Researcher findet
              Edges frei und empfiehlt danach ein Universe. Nur setzen, um bewusst
              auf eine Klasse einzuschränken.
            </template>
          </UFormField>

          <UFormField label="Strategy Family (optional)">
            <UInput v-model="strategyFamilyHint" placeholder="z.B. mean_reversion" class="w-full" />
          </UFormField>

          <UFormField label="Free-Text Brief (optional)">
            <UTextarea
              v-model="freeTextBrief"
              :rows="4"
              placeholder="Zusätzlicher Kontext für den Researcher-Agenten..."
              class="w-full"
            />
          </UFormField>

          <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />
        </div>

        <template #footer>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-gray-500">
              Scope: <span class="text-gray-300 font-medium">{{ scopeLabel }}</span>
            </span>
            <div class="flex gap-2">
              <UButton variant="ghost" @click="close">Abbrechen</UButton>
              <UButton color="primary" :loading="submitting" @click="submit">
                Research starten
              </UButton>
            </div>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
