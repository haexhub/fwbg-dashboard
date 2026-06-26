<script setup lang="ts">
import type { ResearchBriefInput, ResearchBriefResponse } from "~/types/agents";

defineProps<{ open: boolean }>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();

const { criteriaList } = useAgentCriteria();
const toast = useToast();

const assetClass = ref("");
const strategyFamilyHint = ref("");
const freeTextBrief = ref("");
const submitting = ref(false);
const errorMessage = ref("");

// Existing asset classes are shown as quick-picks, not a hard constraint —
// the backend accepts any string and there may be none yet on a fresh install.
const knownAssetClasses = computed(() => criteriaList.value?.asset_classes ?? []);
const canSubmit = computed(() => assetClass.value.trim().length > 0);

function resetForm() {
  assetClass.value = "";
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
            <UInput v-model="assetClass" placeholder="z.B. FX_MAJORS" class="w-full" />
            <template v-if="knownAssetClasses.length" #hint>
              <div class="flex flex-wrap gap-1 mt-1">
                <UBadge
                  v-for="ac in knownAssetClasses"
                  :key="ac"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                  class="cursor-pointer"
                  @click="assetClass = ac"
                >
                  {{ ac }}
                </UBadge>
              </div>
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
