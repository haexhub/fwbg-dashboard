<script setup lang="ts">
import type { PresetItem } from "~/types/preset";

const props = defineProps<{
  open: boolean;
  section: string;
  currentRef?: string;
  label?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  apply: [id: string, content: Record<string, unknown>];
}>();

const { presets, status, refresh, createPreset, savePreset, deletePreset } = usePresets(props.section);

const selectedId = ref<string | undefined>(undefined);
const editMode = ref<"none" | "create" | "edit">("none");
const editName = ref("");
const editJson = ref("");
const editError = ref("");
const saving = ref(false);

const selected = computed(() =>
  presets.value.find((p) => p.id === selectedId.value) ?? undefined,
);

const selectItems = computed(() =>
  presets.value.map((p) => ({ label: p.meta.name, value: p.id })),
);

// Auto-select current preset on open
watch(() => props.open, (val) => {
  if (val) {
    refresh();
    editMode.value = "none";
    selectedId.value = props.currentRef ?? presets.value[0]?.id ?? undefined;
  }
});

watch(presets, (list) => {
  if (!selectedId.value && list.length) {
    selectedId.value = props.currentRef ?? list[0]?.id ?? undefined;
  }
});

function startCreate() {
  editMode.value = "create";
  editName.value = "";
  editJson.value = "{}";
  editError.value = "";
}

function startEdit() {
  if (!selected.value) return;
  editMode.value = "edit";
  editName.value = selected.value.meta.name;
  editJson.value = JSON.stringify(selected.value.content, null, 2);
  editError.value = "";
}

async function saveEdit() {
  editError.value = "";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(editJson.value);
  } catch {
    editError.value = "Ungültiges JSON";
    return;
  }

  saving.value = true;
  try {
    if (editMode.value === "create") {
      const name = editName.value.trim();
      const item = await createPreset(name, "", parsed);
      selectedId.value = item.id;
    } else if (selected.value) {
      await savePreset(selected.value.id, parsed);
    }
    editMode.value = "none";
  } catch (e: unknown) {
    editError.value = (e as Error)?.message ?? "Fehler beim Speichern";
  } finally {
    saving.value = false;
  }
}

async function removeSelected() {
  if (!selected.value) return;
  await deletePreset(selected.value.id, "one");
  selectedId.value = presets.value[0]?.id ?? undefined;
}

function applySelected() {
  if (!selected.value) return;
  emit("apply", selected.value.id, selected.value.content as Record<string, unknown>);
  emit("update:open", false);
}

</script>

<template>
  <UModal :open="open" @update:open="$emit('update:open', $event)">
    <template #header>
      <h3 class="text-base font-semibold text-white">
        Preset wählen — {{ label ?? section }}
      </h3>
    </template>

    <template #body>
    <div class="space-y-4">
      <!-- Selector row -->
      <div class="flex items-center gap-2">
        <USelect
          v-model="selectedId"
          :items="selectItems"
          value-key="value"
          :loading="status === 'pending'"
          placeholder="Preset auswählen…"
          class="flex-1"
          :disabled="editMode !== 'none'"
          @update:model-value="editMode = 'none'"
        />
        <UButton
          icon="i-heroicons-pencil-square"
          variant="ghost"
          size="sm"
          color="neutral"
          :disabled="!selected || editMode !== 'none'"
          title="Bearbeiten"
          @click="startEdit"
        />
        <UButton
          icon="i-heroicons-trash"
          variant="ghost"
          size="sm"
          color="error"
          :disabled="!selected || editMode !== 'none'"
          title="Löschen"
          @click="removeSelected"
        />
        <UButton
          icon="i-heroicons-plus"
          variant="soft"
          size="sm"
          :disabled="editMode !== 'none'"
          @click="startCreate"
        >
          Neu
        </UButton>
      </div>

      <!-- Editor (create / edit only) -->
      <template v-if="editMode !== 'none'">
        <UFormField v-if="editMode === 'create'" label="Name">
          <UInput v-model="editName" placeholder="preset_name" class="w-full font-mono" />
        </UFormField>
        <UFormField label="Inhalt (JSON)">
          <UTextarea
            v-model="editJson"
            :rows="12"
            class="w-full font-mono text-xs"
          />
        </UFormField>
        <p v-if="editError" class="text-xs text-red-400">{{ editError }}</p>
        <div class="flex gap-2">
          <UButton :loading="saving" @click="saveEdit">Speichern</UButton>
          <UButton variant="ghost" @click="() => { editMode = 'none' }">Abbrechen</UButton>
        </div>
      </template>

      <div v-else-if="!presets.length && status !== 'pending'" class="text-sm text-gray-500 py-2 text-center">
        Keine Presets vorhanden.
      </div>
    </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" @click="$emit('update:open', false)">Abbrechen</UButton>
        <UButton :disabled="!selected || editMode !== 'none'" @click="applySelected">
          Anwenden
        </UButton>
      </div>
    </template>
  </UModal>
</template>
