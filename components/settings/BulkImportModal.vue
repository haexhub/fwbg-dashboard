<script setup lang="ts">
import type { AssetsConfig } from "~/types/settings";

const props = defineProps<{
  open: boolean;
  accountName: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  imported: [];
}>();

const bulkImportJson = ref("");
const bulkImportMode = ref<"merge" | "replace">("merge");
const bulkImporting = ref(false);
const bulkImportError = ref<string | null>(null);

const handleFileUpload = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    bulkImportJson.value = e.target?.result as string;
    bulkImportError.value = null;
  };
  reader.onerror = () => {
    bulkImportError.value = "Fehler beim Lesen der Datei";
  };
  reader.readAsText(file);
};

const executeBulkImport = async () => {
  if (!props.accountName || !bulkImportJson.value) return;

  bulkImporting.value = true;
  bulkImportError.value = null;

  try {
    const assets = JSON.parse(bulkImportJson.value) as AssetsConfig;

    const result = await $fetch<{
      success: boolean;
      imported: number;
      total: number;
      errors?: string[];
    }>(`/api/settings/${props.accountName}/assets/bulk`, {
      method: "POST",
      body: {
        assets,
        mode: bulkImportMode.value,
      },
    });

    emit("imported");
    close();

    const message = result.errors?.length
      ? `${result.imported} Assets importiert (${result.errors.length} Fehler)`
      : `${result.imported} Assets erfolgreich importiert`;
    alert(message);
  } catch (error) {
    if (error instanceof SyntaxError) {
      bulkImportError.value = "Ungültiges JSON-Format";
    } else {
      bulkImportError.value = error instanceof Error ? error.message : String(error);
    }
  } finally {
    bulkImporting.value = false;
  }
};

const close = () => {
  emit("update:open", false);
  bulkImportJson.value = "";
  bulkImportError.value = null;
};
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard class="w-full max-w-2xl">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-arrow-up-tray" class="w-6 h-6 text-primary" />
            <span class="text-lg font-bold text-white">Assets importieren</span>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-gray-400 text-sm">
            Importiere Assets aus einer JSON-Datei. Das Format muss dem assets.json Format entsprechen.
          </p>

          <!-- File Upload -->
          <UFormField label="JSON-Datei auswählen">
            <input
              type="file"
              accept=".json,application/json"
              class="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/80 cursor-pointer"
              @change="handleFileUpload"
            />
          </UFormField>

          <!-- Or paste JSON -->
          <UFormField label="Oder JSON direkt einfügen">
            <UTextarea
              v-model="bulkImportJson"
              placeholder='{"EURUSD": {...}, "GBPUSD": {...}}'
              :rows="8"
              class="w-full font-mono text-xs"
            />
          </UFormField>

          <!-- Import Mode -->
          <UFormField label="Import-Modus">
            <div class="flex gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="bulkImportMode"
                  type="radio"
                  value="merge"
                  class="text-primary"
                />
                <span class="text-white">Zusammenführen</span>
                <span class="text-gray-500 text-xs">(bestehende Assets behalten)</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="bulkImportMode"
                  type="radio"
                  value="replace"
                  class="text-primary"
                />
                <span class="text-white">Ersetzen</span>
                <span class="text-gray-500 text-xs">(alle Assets überschreiben)</span>
              </label>
            </div>
          </UFormField>

          <!-- Error message -->
          <div v-if="bulkImportError" class="text-red-500 text-sm">
            {{ bulkImportError }}
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="close">
              Abbrechen
            </UButton>
            <UButton
              color="primary"
              :loading="bulkImporting"
              :disabled="!bulkImportJson"
              @click="executeBulkImport"
            >
              Importieren
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
