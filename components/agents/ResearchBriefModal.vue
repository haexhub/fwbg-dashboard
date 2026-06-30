<script setup lang="ts">
import type { ResearchBriefInput, ResearchBriefResponse } from "~/types/agents";

defineProps<{ open: boolean }>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();

const { criteriaList } = useAgentCriteria();
const { availableSymbols, status: assetsStatus } = useDataSourceAssets();
const toast = useToast();

const assetClass = ref<string | undefined>(undefined);
const strategyFamilyHint = ref("");
const freeTextBrief = ref("");
const submitting = ref(false);
const errorMessage = ref("");

// Dropdown combines: known asset-class criteria (from fwbg-agents) + actual symbols (from fwbg datasources).
// The select stays creatable so users can enter any string on a fresh install.
const knownAssetClasses = computed(() => criteriaList.value?.asset_classes ?? []);
const createdAssetClasses = ref<string[]>([]);
const assetClassOptions = computed(() => [
  ...new Set([...knownAssetClasses.value, ...availableSymbols.value, ...createdAssetClasses.value]),
]);
const canSubmit = computed(() => !!assetClass.value && assetClass.value.trim().length > 0);

function onCreateAssetClass(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  if (!assetClassOptions.value.includes(trimmed)) createdAssetClasses.value.push(trimmed);
  assetClass.value = trimmed;
}

function resetForm() {
  assetClass.value = undefined;
  strategyFamilyHint.value = "";
  freeTextBrief.value = "";
  createdAssetClasses.value = [];
  errorMessage.value = "";
}

function close() {
  emit("update:open", false);
  resetForm();
}

async function submit() {
  if (!canSubmit.value || !assetClass.value) return;
  submitting.value = true;
  errorMessage.value = "";
  try {
    const body: ResearchBriefInput = {
      asset_class: assetClass.value.trim(),
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
          <UFormField label="Asset / Asset Class" required>
            <USelectMenu
              v-model="assetClass"
              :items="assetClassOptions"
              :loading="assetsStatus === 'pending'"
              create-item
              placeholder="Symbol oder Klasse wählen (z.B. EURUSD, FX_MAJORS)"
              class="w-full"
              @create="onCreateAssetClass"
            />
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
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="close">Abbrechen</UButton>
            <UButton color="primary" :loading="submitting" :disabled="!canSubmit" @click="submit">
              Research starten
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
