<script setup lang="ts">
import type { PresetItem } from "~/types/preset";

const SECTIONS = [
  { key: "models", label: "Models" },
  { key: "pipelines", label: "Pipelines" },
  { key: "exit_params", label: "Exit Params" },
  { key: "validations", label: "Validation" },
  { key: "filters", label: "Filter" },
  { key: "resources", label: "Resources" },
  { key: "grids", label: "Grids" },
  { key: "regime_filters", label: "Regime Filters" },
  { key: "risk_params", label: "Risk Params" },
];

const activeSection = ref(SECTIONS[0]!.key);

const { presets, status, refresh, createPreset, savePreset, deletePreset } = usePresets(
  computed(() => activeSection.value).value,
);

// Re-fetch when section changes
watch(activeSection, () => refresh());

const selected = ref<PresetItem | null>(null);
const editMode = ref<"none" | "create" | "edit">("none");
const editName = ref("");
const editJson = ref("");
const editError = ref("");
const saving = ref(false);

watch([activeSection, presets], () => {
  selected.value = presets.value[0] ?? null;
  editMode.value = "none";
});

function selectPreset(preset: PresetItem) {
  selected.value = preset;
  editMode.value = "none";
}

function startCreate() {
  editMode.value = "create";
  editName.value = "";
  editJson.value = "{}";
  editError.value = "";
  selected.value = null;
}

function startEdit(preset: PresetItem) {
  selected.value = preset;
  editMode.value = "edit";
  editName.value = preset.meta.name;
  editJson.value = JSON.stringify(preset.content, null, 2);
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
      const item = await createPreset(editName.value.trim(), "", parsed);
      selected.value = presets.value.find(p => p.id === item.id) ?? null;
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

async function removePreset(preset: PresetItem) {
  await deletePreset(preset.id, "one");
  if (selected.value?.id === preset.id) {
    selected.value = presets.value[0] ?? null;
  }
}

const previewJson = computed(() =>
  selected.value && editMode.value === "none"
    ? JSON.stringify(selected.value.content, null, 2)
    : "",
);
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">Presets</h2>
    </div>

    <!-- Section tabs -->
    <div class="flex gap-1 flex-wrap">
      <UButton
        v-for="s in SECTIONS"
        :key="s.key"
        :variant="activeSection === s.key ? 'soft' : 'ghost'"
        @click="activeSection = s.key"
      >
        {{ s.label }}
      </UButton>
    </div>

    <!-- Content -->
    <div class="flex gap-4 flex-1 min-h-0">
      <!-- List -->
      <div class="w-56 shrink-0 flex flex-col gap-1 overflow-y-auto">
        <div v-if="status === 'pending'" class="text-sm text-gray-500 p-2">Laden…</div>
        <button
          v-for="preset in presets"
          :key="preset.id"
          class="flex items-center justify-between px-3 py-2 rounded text-sm text-left transition-colors"
          :class="selected?.id === preset.id && editMode === 'none'
            ? 'bg-primary-600 text-white'
            : 'text-gray-300 hover:bg-gray-800'"
          @click="selectPreset(preset)"
        >
          <span class="truncate font-mono">{{ preset.meta.name }}</span>
          <div class="flex gap-1 shrink-0 ml-2">
            <UButton icon="i-heroicons-pencil-square" variant="ghost" color="neutral" @click.stop="startEdit(preset)" />
            <UButton icon="i-heroicons-trash" variant="ghost" color="error" @click.stop="removePreset(preset)" />
          </div>
        </button>

        <div v-if="!presets.length && status !== 'pending'" class="text-xs text-gray-500 px-2 py-1">
          Keine Presets.
        </div>

        <UButton variant="soft" icon="i-heroicons-plus" class="mt-2" @click="startCreate">
          Neues Preset
        </UButton>
      </div>

      <!-- Editor / Preview -->
      <div class="flex-1 min-w-0">
        <!-- Create / Edit -->
        <template v-if="editMode !== 'none'">
          <UCard>
            <template #header>
              <h3 class="text-base font-medium text-white">
                {{ editMode === 'create' ? 'Neues Preset' : `Bearbeiten: ${editName}` }}
              </h3>
            </template>
            <div class="space-y-3">
              <UFormField v-if="editMode === 'create'" label="Name">
                <UInput v-model="editName" placeholder="preset_name" class="w-full font-mono" />
              </UFormField>
              <UFormField label="Inhalt (JSON)">
                <UTextarea v-model="editJson" :rows="20" class="w-full font-mono text-xs" />
              </UFormField>
              <p v-if="editError" class="text-xs text-red-400">{{ editError }}</p>
              <div class="flex gap-2">
                <UButton :loading="saving" @click="saveEdit">Speichern</UButton>
                <UButton variant="ghost" @click="editMode = 'none'">Abbrechen</UButton>
              </div>
            </div>
          </UCard>
        </template>

        <!-- Preview -->
        <template v-else>
          <UCard v-if="selected">
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-base font-medium text-white font-mono">{{ selected.meta.name }}</h3>
                <UButton variant="soft" icon="i-heroicons-pencil-square" @click="startEdit(selected)">
                  Bearbeiten
                </UButton>
              </div>
            </template>
            <pre class="text-xs text-gray-300 overflow-auto max-h-[calc(100vh-20rem)] whitespace-pre-wrap">{{ previewJson }}</pre>
          </UCard>
          <div v-else class="text-sm text-gray-500 pt-4">Preset auswählen oder neu erstellen.</div>
        </template>
      </div>
    </div>
  </div>
</template>
