<script setup lang="ts">
import type { ResearchCard } from "~/types/research";
import type { ResearchCardItem, RunStartForm } from "~/utils/researchForms";

const props = defineProps<{
  open: boolean;
  strategyName: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  started: [jobId: string];
}>();

const { startRun } = useRuns();
const { listCards } = useResearch();

const form = reactive<RunStartForm>({
  researchId: undefined,
  note: "",
  reason: "",
  holdout: false,
  assetClasses: [],
  customAssets: "",
  description: "",
});
const cardItems = ref<ResearchCardItem[]>([]);
const loadingCards = ref(false);
const newCardOpen = ref(false);
const starting = ref(false);
const error = ref<{ title: string; lines: string[] }>();

const body = computed(() => buildRunStartBody(props.strategyName, form));

const assetClassOptions = [
  { label: "FOREX", value: "FOREX" },
  { label: "INDEX", value: "INDEX" },
  { label: "COMMODITY", value: "COMMODITY" },
  { label: "CRYPTO", value: "CRYPTO" },
];

function toggleAssetClass(value: string) {
  if (form.assetClasses.includes(value)) {
    form.assetClasses = form.assetClasses.filter((c) => c !== value);
  } else {
    form.assetClasses.push(value);
  }
}

async function loadCards() {
  loadingCards.value = true;
  try {
    const { cards } = await listCards();
    cardItems.value = cards.map(researchCardItem);
  } catch (err) {
    error.value = {
      title: "Cards not loaded",
      lines: fetchErrorLines(err, "Could not load the research cards"),
    };
  } finally {
    loadingCards.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    error.value = undefined;
    // loadCards reports its own errors in the alert.
    void loadCards();
  },
  { immediate: true },
);

function selectCreatedCard(card: ResearchCard) {
  if (!cardItems.value.some((item) => item.value === card.id)) {
    cardItems.value = [...cardItems.value, researchCardItem(card)];
  }
  form.researchId = card.id;
}

async function handleStart() {
  if (!body.value) return;
  starting.value = true;
  error.value = undefined;
  try {
    const result = await startRun(body.value);
    emit("started", result.job_id);
    emit("update:open", false);
  } catch (err) {
    error.value = { title: "Run not started", lines: fetchErrorLines(err, "Could not start the run") };
  } finally {
    starting.value = false;
  }
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <h3 class="text-lg font-semibold text-white">Start Run</h3>
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="text-sm text-gray-400">
          Strategy:
          <span class="text-white font-medium">{{ strategyName }}</span>
        </div>

        <UFormField label="Research Card" required>
          <div class="flex items-center gap-2">
            <USelectMenu
              v-model="form.researchId"
              :items="cardItems"
              value-key="value"
              :loading="loadingCards"
              placeholder="Select an active card..."
              class="flex-1 min-w-0"
            />
            <UButton
              icon="i-heroicons-plus"
              variant="outline"
              size="sm"
              @click="newCardOpen = true"
            >
              New Card
            </UButton>
          </div>
          <template #help>Every run counts as a trial of this card.</template>
        </UFormField>

        <UFormField label="Note" required>
          <UInput v-model="form.note" placeholder="What does this run try?" class="w-full" />
          <template #help>One line; line breaks become spaces.</template>
        </UFormField>

        <UFormField label="Reason (optional)">
          <UInput v-model="form.reason" class="w-full" />
          <template #help>
            Only for a deliberate repeat: the same config again or a further holdout look.
          </template>
        </UFormField>

        <UCheckbox
          v-model="form.holdout"
          label="Holdout look"
          description="Develops up to the card's cutoff and evaluates once after it; a further look needs a reason."
        />

        <UFormField label="Description (optional)">
          <UInput v-model="form.description" placeholder="Run description..." class="w-full" />
        </UFormField>

        <UFormField label="Asset Classes">
          <div class="flex gap-2 flex-wrap">
            <UButton
              v-for="opt in assetClassOptions"
              :key="opt.value"
              :variant="form.assetClasses.includes(opt.value) ? 'solid' : 'outline'"
              size="sm"
              @click="toggleAssetClass(opt.value)"
            >
              {{ opt.label }}
            </UButton>
          </div>
          <template #help>Leave empty to test all configured assets</template>
        </UFormField>

        <UFormField label="Specific Assets (optional)">
          <UInput
            v-model="form.customAssets"
            placeholder="EURUSD, GBPUSD, GOLD..."
            class="w-full"
          />
          <template #help>Comma-separated. Overrides asset class filter.</template>
        </UFormField>

        <UAlert v-if="error" color="error" variant="subtle" :title="error.title">
          <template #description>
            <div class="max-h-48 overflow-y-auto">
              <p v-for="(line, i) in error.lines" :key="i" class="break-words">{{ line }}</p>
            </div>
          </template>
        </UAlert>
      </div>

      <RunsNewCardModal v-model:open="newCardOpen" @created="selectCreatedCard" />
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="outline" @click="emit('update:open', false)">
          Cancel
        </UButton>
        <UButton :loading="starting" :disabled="!body" @click="handleStart">
          Start Run
        </UButton>
      </div>
    </template>
  </UModal>
</template>
