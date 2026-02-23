<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  datasource: string;
  assetClasses: string[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const assetFilter = defineModel<string[]>("assetFilter", { default: () => [] });
const assetExclude = defineModel<string[]>("assetExclude", { default: () => [] });
</script>

<template>
  <USlideover :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <div>
        <h3 class="text-lg font-semibold text-white">{{ datasource }}</h3>
        <p class="text-sm text-gray-400 mt-1">Datasource-Konfiguration</p>
      </div>
    </template>

    <template #body>
      <div class="space-y-6 p-1">
        <UFormField label="Asset-Filter">
          <p class="text-xs text-gray-500 mb-2">
            Nur diese Asset-Klassen laden. Leer = alle.
          </p>
          <USelectMenu
            v-model="assetFilter"
            :items="assetClasses"
            multiple
            placeholder="Alle Assets"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Ausgeschlossene Assets">
          <p class="text-xs text-gray-500 mb-2">
            Diese Asset-Klassen überspringen.
          </p>
          <USelectMenu
            v-model="assetExclude"
            :items="assetClasses"
            multiple
            placeholder="Keine Ausnahmen"
            class="w-full"
          />
        </UFormField>

        <p v-if="!assetClasses.length" class="text-xs text-gray-500">
          Noch keine Asset-Klassen definiert. Im Assets-Tab anlegen.
        </p>
      </div>
    </template>

    <template #footer>
      <UButton variant="outline" @click="emit('update:open', false)">
        Schließen
      </UButton>
    </template>
  </USlideover>
</template>
