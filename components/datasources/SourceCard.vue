<script setup lang="ts">
import type { DataSource } from "~/types/datasource";
import { SOURCE_TYPE_ICONS } from "~/types/datasource";

const props = defineProps<{
  source: DataSource;
}>();

const emit = defineEmits<{
  delete: [name: string];
  upload: [name: string];
  deleteRaw: [sourceName: string, filename: string];
  deleteDatasource: [sourceName: string, filename: string];
  etl: [sourceName: string, filename: string];
}>();

const expanded = ref(false);
const confirmDelete = ref(false);
const fileTab = ref("raw");

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("de-DE");
}
</script>

<template>
  <div class="rounded-lg border border-gray-800 bg-gray-900">
    <!-- Header row -->
    <div
      class="flex cursor-pointer items-center gap-3 px-4 py-3"
      @click="expanded = !expanded"
    >
      <UIcon :name="SOURCE_TYPE_ICONS[source.type]" class="shrink-0 text-gray-400" />
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <span class="font-mono text-sm font-medium text-white">{{ source.name }}</span>
        <span v-if="source.description" class="truncate text-xs text-gray-500">
          — {{ source.description }}
        </span>
      </div>

      <!-- File counts for CSV -->
      <template v-if="source.type === 'csv'">
        <span class="shrink-0 text-xs text-gray-500">
          {{ (source as any).file_count ?? 0 }} Dateien
        </span>
        <span v-if="(source as any).raw_file_count" class="shrink-0 text-xs text-gray-600">
          · {{ (source as any).raw_file_count }} roh
        </span>
      </template>

      <!-- Actions -->
      <div class="flex shrink-0 items-center gap-1" @click.stop>
        <UButton
          v-if="source.type === 'csv'"
          icon="i-heroicons-arrow-up-tray"
          size="xs"
          variant="ghost"
          color="neutral"
          @click="emit('upload', source.name)"
        />
        <UButton
          v-if="!confirmDelete"
          icon="i-heroicons-trash"
          size="xs"
          variant="ghost"
          color="error"
          @click="confirmDelete = true"
        />
        <template v-else>
          <span class="text-xs text-red-400">Löschen?</span>
          <UButton size="xs" color="error" @click="emit('delete', source.name)">Ja</UButton>
          <UButton size="xs" variant="ghost" @click="confirmDelete = false">Nein</UButton>
        </template>
      </div>

      <UIcon
        :name="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        class="shrink-0 text-gray-600"
      />
    </div>

    <!-- Expanded detail -->
    <div v-if="expanded" class="border-t border-gray-800 px-4 py-3 space-y-4">
      <!-- Config fields -->
      <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        <template v-if="source.type === 'csv'">
          <div class="text-gray-500">Pfad</div>
          <div class="col-span-1 font-mono text-gray-300 sm:col-span-2">{{ (source as any).path }}</div>
          <div class="text-gray-500">Dateinamen</div>
          <div class="col-span-1 font-mono text-gray-300 sm:col-span-2">{{ (source as any).file_pattern }}</div>
        </template>
        <template v-else-if="source.type === 'rest'">
          <div class="text-gray-500">URL</div>
          <div class="col-span-1 font-mono text-gray-300 sm:col-span-2 break-all">{{ (source as any).base_url }}</div>
          <div class="text-gray-500">API-Key</div>
          <div class="col-span-1 font-mono text-gray-300 sm:col-span-2">{{ (source as any).api_key ? '••••••' : '—' }}</div>
          <template v-if="Object.keys((source as any).endpoints ?? {}).length">
            <div class="text-gray-500">Endpunkte</div>
            <div class="col-span-1 sm:col-span-2">
              <div
                v-for="(path, ep) in (source as any).endpoints"
                :key="ep"
                class="font-mono text-gray-300"
              >
                <span class="text-gray-500">{{ ep }}:</span> {{ path }}
              </div>
            </div>
          </template>
        </template>
        <template v-else-if="source.type === 'websocket'">
          <div class="text-gray-500">URL</div>
          <div class="col-span-1 font-mono text-gray-300 sm:col-span-2 break-all">{{ (source as any).url }}</div>
        </template>
        <template v-else-if="source.type === 'database'">
          <div class="text-gray-500">Verbindung</div>
          <div class="col-span-1 font-mono text-gray-300 sm:col-span-2 break-all">{{ (source as any).connection_string }}</div>
          <div class="text-gray-500">Treiber</div>
          <div class="col-span-1 text-gray-300 sm:col-span-2">{{ (source as any).driver }}</div>
        </template>
      </div>

      <!-- CSV file tabs -->
      <template v-if="source.type === 'csv'">
        <UTabs
          v-model="fileTab"
          :items="[
            { label: `Rohdaten (${(source as any).raw_files?.length ?? 0})`, value: 'raw' },
            { label: `Verarbeitete Daten (${(source as any).files?.length ?? 0})`, value: 'processed' },
          ]"
          :content="false"
        />

        <!-- Raw files -->
        <div v-if="fileTab === 'raw'" class="space-y-1">
          <div class="flex justify-end">
            <UButton
              icon="i-heroicons-arrow-up-tray"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="emit('upload', source.name)"
            >
              Hochladen
            </UButton>
          </div>
          <div v-if="(source as any).raw_files?.length" class="max-h-64 overflow-y-auto space-y-1">
            <div
              v-for="file in (source as any).raw_files"
              :key="file.name"
              class="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-800"
            >
              <UIcon name="i-heroicons-document" class="shrink-0 text-gray-600" />
              <span class="flex-1 font-mono text-xs text-gray-300">{{ file.name }}</span>
              <span class="text-xs text-gray-600">{{ formatSize(file.size) }}</span>
              <UButton
                icon="i-heroicons-arrow-path"
                size="xs"
                variant="ghost"
                color="neutral"
                title="Verarbeiten (ETL)"
                @click="emit('etl', source.name, file.name)"
              />
              <UButton
                icon="i-heroicons-x-mark"
                size="xs"
                variant="ghost"
                color="error"
                @click="emit('deleteRaw', source.name, file.name)"
              />
            </div>
          </div>
          <p v-else class="pl-2 text-xs text-gray-600">Keine Rohdaten hochgeladen.</p>
        </div>

        <!-- Processed files -->
        <div v-if="fileTab === 'processed'" class="space-y-1">
          <div v-if="(source as any).files?.length" class="max-h-64 overflow-y-auto space-y-1">
            <div
              v-for="file in (source as any).files"
              :key="file.name"
              class="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-800"
            >
              <UIcon name="i-heroicons-document-text" class="shrink-0 text-gray-600" />
              <span class="flex-1 font-mono text-xs text-gray-300">{{ file.name }}</span>
              <span class="text-xs text-gray-600">{{ formatSize(file.size) }}</span>
              <span class="text-xs text-gray-600">{{ formatDate(file.modified) }}</span>
              <UButton
                icon="i-heroicons-x-mark"
                size="xs"
                variant="ghost"
                color="error"
                @click="emit('deleteDatasource', source.name, file.name)"
              />
            </div>
          </div>
          <p v-else class="pl-2 text-xs text-gray-600">Noch keine Dateien verarbeitet.</p>
        </div>
      </template>
    </div>
  </div>
</template>
