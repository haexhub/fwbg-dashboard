<script setup lang="ts">
import { researchCardItem, type ResearchCardItem } from "~/utils/researchForms";

const props = defineProps<{
  open: boolean;
  strategyId: number;
  strategySlug: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  attached: [];
}>();

const { attachResearchCard } = useAgentStrategies();
const { listCards } = useResearch();
const toast = useToast();

const items = ref<ResearchCardItem[]>([]);
const researchId = ref<string | undefined>(undefined);
const loading = ref(false);
const submitting = ref(false);
const errorMessage = ref("");

function extractErrorMessage(e: unknown): string {
  const err = e as { statusMessage?: string; message?: string; data?: { detail?: string; message?: string } };
  return err?.data?.detail ?? err?.data?.message ?? err?.statusMessage ?? err?.message ?? "Zuordnen fehlgeschlagen";
}

async function loadCards() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const { cards } = await listCards();
    items.value = cards.map(researchCardItem);
  } catch (e) {
    errorMessage.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    researchId.value = undefined;
    void loadCards();
  },
);

function close() {
  emit("update:open", false);
}

async function submit() {
  if (!researchId.value) return;
  submitting.value = true;
  errorMessage.value = "";
  try {
    await attachResearchCard(props.strategyId, researchId.value);
    toast.add({
      title: "Karte zugeordnet",
      description: `"${props.strategySlug}" läuft jetzt gegen ${researchId.value}.`,
      color: "success",
    });
    emit("attached");
    close();
  } catch (e) {
    errorMessage.value = extractErrorMessage(e);
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
          <span class="text-lg font-bold text-white">Research-Karte zuordnen</span>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-gray-400">
            Jeder Backtest von <span class="font-mono text-white">{{ strategySlug }}</span> und
            seinen Iterationen zählt danach als Trial dieser Karte.
          </p>

          <UFormField label="Aktive Karte" required>
            <USelectMenu
              v-model="researchId"
              :items="items"
              value-key="value"
              :loading="loading"
              placeholder="Karte wählen..."
              class="w-full"
            />
          </UFormField>

          <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="close">Abbrechen</UButton>
            <UButton :loading="submitting" :disabled="!researchId" @click="submit">
              Zuordnen
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
