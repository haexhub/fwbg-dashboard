<script setup lang="ts">
import type { ResearchBriefInput, ResearchBriefResponse } from "~/types/agents";

defineProps<{ open: boolean }>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();

const { criteriaList } = useAgentCriteria();
const toast = useToast();

const assetClass = ref<string | undefined>(undefined);
const strategyFamilyHint = ref("");
const freeTextBrief = ref("");
const submitting = ref(false);
const errorMessage = ref("");

// Known asset classes (from existing criteria) populate the dropdown. The list
// can be empty on a fresh install and the backend accepts any string, so the
// menu stays creatable — operators can type a new class and add it on the fly.
const customAssetClasses = ref<string[]>([]);
const assetClassItems = computed(() => [
  ...new Set([...(criteriaList.value?.asset_classes ?? []), ...customAssetClasses.value]),
]);
const canSubmit = computed(() => !!assetClass.value && assetClass.value.trim().length > 0);

function onCreateAssetClass(value: string) {
  const next = value.trim();
  if (!next) return;
  if (!assetClassItems.value.includes(next)) customAssetClasses.value.push(next);
  assetClass.value = next;
}

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
          <UFormField label="Asset Class" required>
            <USelectMenu
              v-model="assetClass"
              :items="assetClassItems"
              create-item
              placeholder="Asset-Klasse wählen oder eingeben (z.B. FX_MAJORS)"
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
