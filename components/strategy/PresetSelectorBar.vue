<script setup lang="ts">
import type { PresetItem } from "~/types/preset";

const props = defineProps<{
  section: string;
  currentRef?: string;
  label?: string;
  modelValue?: Record<string, unknown>;
}>();

const emit = defineEmits<{
  apply: [id: string, content: Record<string, unknown>];
  detach: [];
}>();

const { presets, createPreset, savePreset, createVersion, updateMeta, deletePreset } = usePresets(props.section);

// ── Current selection ─────────────────────────────────────────────────────────

const selectedId = ref<string | null>(props.currentRef ?? null);
watch(() => props.currentRef, (val) => { selectedId.value = val ?? null; });

const selectedPreset = computed<PresetItem | null>(() =>
  presets.value.find((p) => p.id === selectedId.value) ?? null,
);

const displayLabel = computed(() => {
  if (!selectedPreset.value) return "Keine Konfiguration";
  const p = selectedPreset.value;
  const siblings = presets.value.filter((x) => x.meta.name === p.meta.name);
  return siblings.length > 1 ? `${p.meta.name} v${p.meta.version}` : p.meta.name;
});

function onSelect(id: string) {
  const preset = presets.value.find((p) => p.id === id);
  if (!preset) return;
  selectedId.value = id;
  emit("apply", preset.id, preset.content);
}

// ── Two-level dropdown items ──────────────────────────────────────────────────

const dropdownItems = computed(() => {
  const groups = new Map<string, PresetItem[]>();
  for (const p of presets.value) {
    if (!groups.has(p.meta.name)) groups.set(p.meta.name, []);
    groups.get(p.meta.name)!.push(p);
  }
  return [...groups.entries()].map(([name, versions]) => {
    const sorted = [...versions].sort((a, b) => a.meta.version - b.meta.version);
    if (sorted.length === 1) {
      // Single version: select directly
      return [{ label: name, onSelect: () => onSelect(sorted[0]!.id) }];
    }
    // Multiple versions: sub-menu (children must be array-of-arrays)
    return [{
      label: name,
      children: [sorted.map((v) => ({
        label: `Version ${v.meta.version}`,
        onSelect: () => onSelect(v.id),
      }))],
    }];
  }).flat();
});

// ── Dialog: Neu erstellen ────────────────────────────────────────────────────

const createOpen = ref(false);
const createName = ref("");
const createDesc = ref("");
const createError = ref("");
const createBusy = ref(false);

function openCreate() {
  createName.value = "";
  createDesc.value = "";
  createError.value = "";
  createOpen.value = true;
}

async function confirmCreate() {
  if (!createName.value.trim()) { createError.value = "Name erforderlich"; return; }
  if (!props.modelValue) return;
  createBusy.value = true;
  try {
    const item = await createPreset(createName.value.trim(), createDesc.value.trim(), props.modelValue);
    selectedId.value = item.id;
    emit("apply", item.id, item.content);
    createOpen.value = false;
  } catch (e: unknown) {
    createError.value = (e as Error)?.message ?? "Fehler beim Erstellen";
  } finally {
    createBusy.value = false;
  }
}

// ── Dialog: Speichern ────────────────────────────────────────────────────────

const saveOpen = ref(false);
const saveBusy = ref(false);
const saveError = ref("");

function openSave() {
  saveError.value = "";
  saveOpen.value = true;
}

async function confirmOverwrite() {
  if (!selectedId.value || !props.modelValue) return;
  saveBusy.value = true;
  try {
    await savePreset(selectedId.value, props.modelValue);
    saveOpen.value = false;
  } catch (e: unknown) {
    saveError.value = (e as Error)?.message ?? "Fehler beim Speichern";
  } finally {
    saveBusy.value = false;
  }
}

async function confirmNewVersion() {
  if (!selectedId.value || !props.modelValue) return;
  saveBusy.value = true;
  try {
    const item = await createVersion(selectedId.value, props.modelValue);
    selectedId.value = item.id;
    emit("apply", item.id, item.content);
    saveOpen.value = false;
  } catch (e: unknown) {
    saveError.value = (e as Error)?.message ?? "Fehler beim Erstellen der Version";
  } finally {
    saveBusy.value = false;
  }
}

// ── Dialog: Bearbeiten ───────────────────────────────────────────────────────

const editOpen = ref(false);
const editName = ref("");
const editDesc = ref("");
const editError = ref("");
const editBusy = ref(false);

function openEdit() {
  if (!selectedPreset.value) return;
  editName.value = selectedPreset.value.meta.name;
  editDesc.value = selectedPreset.value.meta.description ?? "";
  editError.value = "";
  editOpen.value = true;
}

async function confirmEdit() {
  if (!editName.value.trim()) { editError.value = "Name erforderlich"; return; }
  if (!selectedId.value) return;
  editBusy.value = true;
  try {
    await updateMeta(selectedId.value, editName.value.trim(), editDesc.value.trim());
    editOpen.value = false;
  } catch (e: unknown) {
    editError.value = (e as Error)?.message ?? "Fehler beim Speichern";
  } finally {
    editBusy.value = false;
  }
}

// ── Dialog: Löschen ──────────────────────────────────────────────────────────

const deleteOpen = ref(false);
const deleteBusy = ref(false);

function openDelete() {
  deleteOpen.value = true;
}

async function confirmDeleteOne() {
  if (!selectedId.value) return;
  deleteBusy.value = true;
  try {
    const id = selectedId.value;
    await deletePreset(id, "one");
    if (props.currentRef === id) emit("detach");
    selectedId.value = null;
    deleteOpen.value = false;
  } finally {
    deleteBusy.value = false;
  }
}

async function confirmDeleteAll() {
  if (!selectedId.value) return;
  deleteBusy.value = true;
  try {
    const id = selectedId.value;
    await deletePreset(id, "all");
    if (props.currentRef) emit("detach");
    selectedId.value = null;
    deleteOpen.value = false;
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <div class="mb-4">
    <!-- Preset-Bar -->
    <div class="flex items-center gap-2 px-1 py-2 border-b border-gray-800">
      <UIcon name="i-heroicons-bookmark" class="w-4 h-4 text-gray-500 shrink-0" />
      <span class="text-xs text-gray-500 shrink-0">Konfiguration:</span>

      <!-- Zweistufiges Dropdown -->
      <UDropdownMenu :items="dropdownItems" :content="{ side: 'bottom', align: 'start' }">
        <UButton
          variant="outline"
          color="neutral"
          trailing-icon="i-heroicons-chevron-down"
          class="flex-1 min-w-0 justify-between font-normal truncate"
        >
          <span class="truncate">{{ displayLabel }}</span>
        </UButton>
      </UDropdownMenu>

      <!-- Speichern: nur wenn eine Konfiguration aktiv -->
      <UButton
        v-if="currentRef && modelValue"
        variant="ghost"
        color="neutral"
        icon="i-lucide-save"
        title="Aktuelle Konfiguration speichern"
        @click="openSave"
      />

      <!-- Bearbeiten: nur wenn eine Konfiguration ausgewählt -->
      <UButton
        v-if="selectedId"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-pencil"
        title="Name und Beschreibung bearbeiten"
        @click="openEdit"
      />

      <!-- Neu erstellen -->
      <UButton
        v-if="modelValue"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-plus"
        title="Als neue Konfiguration speichern"
        @click="openCreate"
      />

      <!-- Löschen: nur wenn eine Konfiguration ausgewählt -->
      <UButton
        v-if="selectedId"
        variant="ghost"
        color="error"
        icon="i-heroicons-trash"
        title="Konfiguration löschen"
        @click="openDelete"
      />
    </div>

    <!-- Inline-Eingabe nach "Neu" entfällt — Dialog stattdessen -->

    <ClientOnly>
      <!-- Dialog: Neu erstellen -->
      <UModal :open="createOpen" @update:open="createOpen = $event">
        <template #header>
          <h3 class="text-base font-semibold text-white">Neue Konfiguration erstellen</h3>
        </template>
        <template #body>
          <div class="space-y-3">
            <UFormField label="Name" required>
              <UInput
                v-model="createName"
                placeholder="z.B. XGBoost Depth 4"
                class="w-full"
                autofocus
                @keydown.enter="confirmCreate"
                @keydown.escape="createOpen = false"
              />
            </UFormField>
            <UFormField label="Beschreibung (optional)">
              <UInput
                v-model="createDesc"
                placeholder="Kurze Beschreibung der Konfiguration"
                class="w-full"
              />
            </UFormField>
            <p v-if="createError" class="text-xs text-red-400">{{ createError }}</p>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="() => { createOpen = false }">Abbrechen</UButton>
            <UButton :loading="createBusy" @click="confirmCreate">Erstellen</UButton>
          </div>
        </template>
      </UModal>

      <!-- Dialog: Speichern -->
      <UModal :open="saveOpen" @update:open="saveOpen = $event">
        <template #header>
          <h3 class="text-base font-semibold text-white">Konfiguration speichern</h3>
        </template>
        <template #body>
          <p class="text-sm text-gray-300 mb-4">
            Wie soll <span class="font-mono text-white">{{ selectedPreset?.meta.name }}</span> gespeichert werden?
          </p>
          <div class="flex flex-col gap-3">
            <UButton
              variant="outline"
              color="neutral"
              class="justify-start"
              :loading="saveBusy"
              @click="confirmOverwrite"
            >
              <template #leading>
                <UIcon name="i-lucide-save" class="w-4 h-4" />
              </template>
              Überschreiben
              <span class="ml-auto text-xs text-gray-500">v{{ selectedPreset?.meta.version }}</span>
            </UButton>
            <UButton
              variant="outline"
              color="neutral"
              class="justify-start"
              :loading="saveBusy"
              @click="confirmNewVersion"
            >
              <template #leading>
                <UIcon name="i-heroicons-document-plus" class="w-4 h-4" />
              </template>
              Neue Version erstellen
              <span class="ml-auto text-xs text-gray-500">v{{ (selectedPreset?.meta.version ?? 0) + 1 }}</span>
            </UButton>
          </div>
          <p v-if="saveError" class="text-xs text-red-400 mt-3">{{ saveError }}</p>
        </template>
        <template #footer>
          <div class="flex justify-end">
            <UButton variant="ghost" @click="() => { saveOpen = false }">Abbrechen</UButton>
          </div>
        </template>
      </UModal>

      <!-- Dialog: Bearbeiten -->
      <UModal :open="editOpen" @update:open="editOpen = $event">
        <template #header>
          <h3 class="text-base font-semibold text-white">Konfiguration bearbeiten</h3>
        </template>
        <template #body>
          <div class="space-y-3">
            <UFormField label="Name" required>
              <UInput
                v-model="editName"
                placeholder="z.B. XGBoost Depth 4"
                class="w-full"
                autofocus
                @keydown.enter="confirmEdit"
                @keydown.escape="editOpen = false"
              />
            </UFormField>
            <UFormField label="Beschreibung (optional)">
              <UInput
                v-model="editDesc"
                placeholder="Kurze Beschreibung der Konfiguration"
                class="w-full"
              />
            </UFormField>
            <p v-if="editError" class="text-xs text-red-400">{{ editError }}</p>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="() => { editOpen = false }">Abbrechen</UButton>
            <UButton :loading="editBusy" @click="confirmEdit">Speichern</UButton>
          </div>
        </template>
      </UModal>

      <!-- Dialog: Löschen -->
      <UModal :open="deleteOpen" @update:open="deleteOpen = $event">
        <template #header>
          <h3 class="text-base font-semibold text-white">Konfiguration löschen</h3>
        </template>
        <template #body>
          <p class="text-sm text-gray-300 mb-4">
            Was soll gelöscht werden?
          </p>
          <div class="flex flex-col gap-3">
            <UButton
              variant="outline"
              color="error"
              class="justify-start"
              :loading="deleteBusy"
              @click="confirmDeleteOne"
            >
              <template #leading>
                <UIcon name="i-heroicons-trash" class="w-4 h-4" />
              </template>
              Diese Version löschen
              <span class="ml-auto text-xs opacity-60">v{{ selectedPreset?.meta.version }}</span>
            </UButton>
            <UButton
              variant="outline"
              color="error"
              class="justify-start"
              :loading="deleteBusy"
              @click="confirmDeleteAll"
            >
              <template #leading>
                <UIcon name="i-heroicons-trash" class="w-4 h-4" />
              </template>
              Alle Versionen von „{{ selectedPreset?.meta.name }}" löschen
            </UButton>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end">
            <UButton variant="ghost" @click="() => { deleteOpen = false }">Abbrechen</UButton>
          </div>
        </template>
      </UModal>
    </ClientOnly>
  </div>
</template>
