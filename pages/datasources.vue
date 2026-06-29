<script setup lang="ts">
import type { DataSource, SourceType } from "~/types/datasource";
import { SOURCE_TYPE_LABELS, SOURCE_TYPE_ICONS } from "~/types/datasource";

const { data: rawSources, refresh } = await useFetch<Record<string, unknown>[]>(
  "/api/datasources",
);

const sources = computed<DataSource[]>(() => {
  if (!rawSources.value) return [];
  return rawSources.value as unknown as DataSource[];
});

const sourceTypes: SourceType[] = ["csv", "rest", "websocket", "database"];

function sourcesOfType(type: SourceType) {
  return sources.value.filter((s) => s.type === type);
}

// ── Add source slideover ────────────────────────────────────────────────────
const slideoverOpen = ref(false);
const saving = ref(false);
const saveError = ref<string | null>(null);

async function handleSubmit(data: Record<string, unknown>) {
  saving.value = true;
  saveError.value = null;
  try {
    await $fetch("/api/datasources", { method: "POST", body: data });
    slideoverOpen.value = false;
    await refresh();
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : "Fehler beim Speichern";
  } finally {
    saving.value = false;
  }
}

// Dukascopy creates the source + downloads itself; just close and refresh.
async function handleDone() {
  slideoverOpen.value = false;
  await refresh();
}

// ── Delete source ───────────────────────────────────────────────────────────
async function handleDelete(name: string) {
  await $fetch(`/api/datasources/${name}`, { method: "DELETE" });
  await refresh();
}

// ── Upload raw files ────────────────────────────────────────────────────────
const uploadTarget = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const uploadError = ref<string | null>(null);

function openUpload(sourceName: string) {
  uploadTarget.value = sourceName;
  uploadError.value = null;
  nextTick(() => fileInput.value?.click());
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length || !uploadTarget.value) return;

  uploading.value = true;
  uploadError.value = null;
  try {
    const formData = new FormData();
    for (const file of Array.from(input.files)) {
      formData.append("files", file);
    }
    await $fetch(`/api/datasources/${uploadTarget.value}/raw`, {
      method: "POST",
      body: formData,
    });
    await refresh();
  } catch (e: unknown) {
    uploadError.value = e instanceof Error ? e.message : "Upload fehlgeschlagen";
  } finally {
    uploading.value = false;
    input.value = "";
  }
}

// ── Delete raw file ─────────────────────────────────────────────────────────
async function handleDeleteRaw(sourceName: string, filename: string) {
  await $fetch(`/api/datasources/${sourceName}/raw/${filename}`, { method: "DELETE" });
  await refresh();
}

// ── Delete datasource file ──────────────────────────────────────────────────
async function handleDeleteDatasource(sourceName: string, filename: string) {
  await $fetch(`/api/datasources/${sourceName}/datasource/${filename}`, { method: "DELETE" });
  await refresh();
}

// ── ETL modal ───────────────────────────────────────────────────────────────
const etlSource = ref<string | null>(null);
const etlFile = ref<string | null>(null);
const etlOpen = computed(() => !!etlSource.value && !!etlFile.value);

function openETL(sourceName: string, filename: string) {
  etlSource.value = sourceName;
  etlFile.value = filename;
}

function closeETL() {
  etlSource.value = null;
  etlFile.value = null;
}

async function handleETLDone() {
  closeETL();
  await refresh();
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-circle-stack" class="text-xl text-gray-400" />
        <h2 class="text-xl font-semibold text-white">Datenquellen</h2>
      </div>
      <UButton icon="i-heroicons-plus" @click="slideoverOpen = true">
        Hinzufügen
      </UButton>
    </div>

    <!-- Upload error -->
    <UAlert
      v-if="uploadError"
      color="error"
      variant="subtle"
      :title="uploadError"
      icon="i-heroicons-exclamation-triangle"
      :close-button="{ icon: 'i-heroicons-x-mark' }"
      @close="uploadError = null"
    />

    <!-- Groups by type -->
    <div v-for="type in sourceTypes" :key="type" class="space-y-2">
      <div class="flex items-center gap-2">
        <UIcon :name="SOURCE_TYPE_ICONS[type]" class="text-gray-500" />
        <h3 class="text-sm font-medium text-gray-400">{{ SOURCE_TYPE_LABELS[type] }}</h3>
        <UBadge variant="subtle" color="neutral" size="xs">
          {{ sourcesOfType(type).length }}
        </UBadge>
      </div>

      <template v-if="sourcesOfType(type).length">
        <DatasourcesSourceCard
          v-for="source in sourcesOfType(type)"
          :key="source.name"
          :source="source"
          @delete="handleDelete"
          @upload="openUpload"
          @delete-raw="handleDeleteRaw"
          @delete-datasource="handleDeleteDatasource"
          @etl="openETL"
          @updated="refresh"
        />
      </template>
      <p v-else class="pl-6 text-xs text-gray-600">
        Keine {{ SOURCE_TYPE_LABELS[type] }}-Quellen konfiguriert.
      </p>
    </div>

    <!-- Hidden file input for raw upload -->
    <input
      ref="fileInput"
      type="file"
      multiple
      class="hidden"
      @change="handleFileChange"
    />

    <!-- Add Source Slideover -->
    <USlideover v-model:open="slideoverOpen" title="Datenquelle hinzufügen">
      <template #body>
        <div class="p-4">
          <UAlert
            v-if="saveError"
            color="error"
            variant="subtle"
            :title="saveError"
            class="mb-4"
          />
          <DatasourcesAddSourceForm
            @submit="handleSubmit"
            @done="handleDone"
            @cancel="slideoverOpen = false"
          />
        </div>
      </template>
    </USlideover>

    <!-- ETL Modal -->
    <UModal v-model:open="etlOpen" title="Datei verarbeiten">
      <template #body>
        <div class="p-4">
          <DatasourcesETLForm
            v-if="etlSource && etlFile"
            :source-name="etlSource"
            :filename="etlFile"
            @done="handleETLDone"
            @cancel="closeETL"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
