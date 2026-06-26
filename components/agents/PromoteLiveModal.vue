<script setup lang="ts">
import type { PromoteLiveInput } from "~/types/agents";

const props = defineProps<{
  open: boolean;
  strategyId: number;
  strategySlug: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  promoted: [];
}>();

const { promoteLive } = useAgentStrategies();
const toast = useToast();

const slugConfirmation = ref("");
const operatorNote = ref("");
const submitting = ref(false);
const errorMessage = ref("");

const canSubmit = computed(
  () => slugConfirmation.value === props.strategySlug && operatorNote.value.trim().length > 0,
);

function resetForm() {
  slugConfirmation.value = "";
  operatorNote.value = "";
  errorMessage.value = "";
}

function close() {
  emit("update:open", false);
  resetForm();
}

async function submit() {
  if (!canSubmit.value) return;
  submitting.value = true;
  errorMessage.value = "";
  try {
    const input: PromoteLiveInput = {
      human_approval: true,
      operator_note: operatorNote.value.trim(),
    };
    await promoteLive(props.strategyId, input);
    toast.add({
      title: "Promoted to Live",
      description: `"${props.strategySlug}" tradet jetzt live.`,
      color: "success",
    });
    emit("promoted");
    close();
  } catch (e) {
    const err = e as { statusMessage?: string; message?: string; data?: { detail?: string; message?: string } };
    errorMessage.value =
      err?.data?.detail ?? err?.data?.message ?? err?.statusMessage ?? err?.message ?? "Promote-to-Live fehlgeschlagen";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard class="w-full max-w-lg ring-1 ring-red-700/50">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-red-400" />
            <span class="text-lg font-bold text-white">Promote to Live</span>
          </div>
        </template>

        <div class="space-y-4">
          <UAlert
            color="error"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            title="Echtgeld-Warnung"
            description="Diese Strategie tradet danach mit echtem Geld und echtem Kapitalrisiko. Diese Aktion ist nicht umkehrbar. Stelle sicher, dass die Paper-Trading-Performance die Live-Kriterien erfüllt, bevor du fortfährst."
          />

          <UFormField :label="`Gib &quot;${strategySlug}&quot; ein, um zu bestätigen`" required>
            <UInput v-model="slugConfirmation" :placeholder="strategySlug" class="w-full font-mono" />
          </UFormField>

          <UFormField label="Operator Note" required>
            <UTextarea
              v-model="operatorNote"
              :rows="3"
              placeholder="Begründung für die Promotion..."
              class="w-full"
            />
          </UFormField>

          <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="close">Abbrechen</UButton>
            <UButton color="error" :loading="submitting" :disabled="!canSubmit" @click="submit">
              Promote to Live
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
