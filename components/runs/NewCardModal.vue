<script setup lang="ts">
import type { ResearchCard } from "~/types/research";
import type { NewCardForm } from "~/utils/researchForms";

defineProps<{ open: boolean }>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [card: ResearchCard];
}>();

const { createCard } = useResearch();
const toast = useToast();

function emptyForm(): NewCardForm {
  return { title: "", tags: [], hypothesis: "", mechanism: "", cutoff: "" };
}

const form = reactive<NewCardForm>(emptyForm());
const creating = ref(false);
const errorLines = ref<string[]>([]);

const input = computed(() => buildNewCardInput(form));

async function create() {
  const body = input.value;
  if (!body) return;
  creating.value = true;
  errorLines.value = [];
  try {
    const { card, warning } = await createCard(body);
    // The card is written; only its commit failed. Use it, never create it again.
    if (warning) {
      toast.add({ title: `${card.id} created, not committed`, description: warning, color: "warning" });
    }
    Object.assign(form, emptyForm());
    emit("created", card);
    emit("update:open", false);
  } catch (err) {
    errorLines.value = fetchErrorLines(err, "Could not create the card");
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <UModal title="New Research Card" :open="open" @update:open="emit('update:open', $event)">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Title" required>
          <UInput v-model="form.title" class="w-full" />
        </UFormField>

        <UFormField label="Tags" required>
          <UInputTags v-model="form.tags" add-on-blur add-on-paste class="w-full" />
          <template #help>Enter to add a tag; at least one.</template>
        </UFormField>

        <UFormField label="Hypothesis" required>
          <UTextarea v-model="form.hypothesis" :rows="3" class="w-full" />
          <template #help>What edge do you expect?</template>
        </UFormField>

        <UFormField label="Mechanism" required>
          <UTextarea v-model="form.mechanism" :rows="3" class="w-full" />
          <template #help>Why should the edge exist?</template>
        </UFormField>

        <UFormField label="Holdout Cutoff (optional)">
          <UInput v-model="form.cutoff" type="date" class="w-full" />
          <template #help>
            Runs develop up to this date; data after it stays unseen until the holdout look.
            Leave empty for fwbg's default.
          </template>
        </UFormField>

        <UAlert v-if="errorLines.length" color="error" variant="subtle" title="Card not created">
          <template #description>
            <p v-for="(line, i) in errorLines" :key="i" class="break-words">{{ line }}</p>
          </template>
        </UAlert>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" @click="emit('update:open', false)">Cancel</UButton>
        <UButton color="primary" :loading="creating" :disabled="!input" @click="create">
          Create Card
        </UButton>
      </div>
    </template>
  </UModal>
</template>
