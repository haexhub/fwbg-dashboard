<script setup lang="ts">
import type { AssetConfig } from "~/types/settings";

const props = defineProps<{
  assetName: string;
  modelValue: AssetConfig;
  accountName: string;
  expanded: boolean;
  saving: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: AssetConfig];
  "update:expanded": [value: boolean];
  save: [];
  delete: [];
}>();

const asset = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const hours = Array.from({ length: 24 }, (_, i) => i);
const newFeature = ref("");
const newDdLevel = ref("");
const newDdScale = ref(0.5);

const toggleExpanded = () => {
  emit("update:expanded", !props.expanded);
};

const toggleHour = (hour: number) => {
  const index = asset.value.good_hours.indexOf(hour);
  if (index >= 0) {
    asset.value.good_hours.splice(index, 1);
  } else {
    asset.value.good_hours.push(hour);
    asset.value.good_hours.sort((a, b) => a - b);
  }
};

const addFeature = () => {
  if (!newFeature.value) return;
  if (!asset.value.features.includes(newFeature.value)) {
    asset.value.features.push(newFeature.value);
  }
  newFeature.value = "";
};

const removeFeature = (feature: string) => {
  const index = asset.value.features.indexOf(feature);
  if (index >= 0) {
    asset.value.features.splice(index, 1);
  }
};

const addEnsemble = () => {
  asset.value.ensemble.push({
    tp_mult: asset.value.tp_mult,
    sl_mult: asset.value.sl_mult,
    conf_thresh: asset.value.conf_thresh + 0.05,
    weight: 0.25,
  });
};

const removeEnsemble = (index: number) => {
  asset.value.ensemble.splice(index, 1);
};

const addDdScaling = () => {
  if (!newDdLevel.value || newDdScale.value === undefined) return;
  asset.value.dd_scaling[newDdLevel.value] = newDdScale.value;
  newDdLevel.value = "";
  newDdScale.value = 0.5;
};

const removeDdScaling = (level: string) => {
  delete asset.value.dd_scaling[level];
};
</script>

<template>
  <UCard class="overflow-hidden">
    <!-- Asset Header -->
    <template #header>
      <div class="flex items-center justify-between">
        <button
          type="button"
          class="flex items-center gap-3 cursor-pointer hover:opacity-80"
          @click="toggleExpanded"
        >
          <UIcon
            :name="expanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
            class="text-gray-400"
          />
          <h3 class="text-lg font-semibold text-white">
            {{ assetName }}
          </h3>
          <UBadge color="neutral" variant="subtle">
            {{ asset.features.length }} Features
          </UBadge>
        </button>
        <div class="flex gap-2">
          <UButton
            :loading="saving"
            size="sm"
            color="primary"
            @click="emit('save')"
          >
            Speichern
          </UButton>
          <UButton
            size="sm"
            color="error"
            variant="ghost"
            icon="i-heroicons-trash"
            @click="emit('delete')"
          />
        </div>
      </div>
    </template>

    <!-- Asset Content (Expanded) -->
    <div v-if="expanded" class="space-y-6">
      <!-- Basic Settings -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <UFormField label="Kelly Risk">
          <UInput
            v-model.number="asset.kelly_risk"
            type="number"
            step="0.001"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Point Value">
          <UInput
            v-model.number="asset.point_value"
            type="number"
            step="0.0001"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Spread">
          <UInput
            v-model.number="asset.spread"
            type="number"
            step="0.0001"
            class="w-full"
          />
        </UFormField>

        <UFormField label="TP Mult">
          <UInput
            v-model.number="asset.tp_mult"
            type="number"
            class="w-full"
          />
        </UFormField>

        <UFormField label="SL Mult">
          <UInput
            v-model.number="asset.sl_mult"
            type="number"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Conf Thresh">
          <UInput
            v-model.number="asset.conf_thresh"
            type="number"
            step="0.01"
            min="0.5"
            max="1"
            class="w-full"
          />
        </UFormField>
      </div>

      <!-- Features -->
      <div>
        <h4 class="text-sm font-medium text-gray-400 mb-2">Features</h4>
        <div class="flex flex-wrap gap-2 mb-2">
          <UBadge
            v-for="feature in asset.features"
            :key="feature"
            color="primary"
            variant="subtle"
            class="cursor-pointer"
            @click="removeFeature(feature)"
          >
            {{ feature }}
            <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
          </UBadge>
        </div>
        <div class="flex gap-2">
          <UInput
            v-model="newFeature"
            placeholder="Feature hinzufügen..."
            size="sm"
            @keyup.enter="addFeature"
          />
          <UButton
            size="sm"
            icon="i-heroicons-plus"
            @click="addFeature"
          />
        </div>
      </div>

      <!-- Good Hours -->
      <div>
        <h4 class="text-sm font-medium text-gray-400 mb-2">Trading Hours</h4>
        <div class="grid grid-cols-12 gap-1">
          <button
            v-for="hour in hours"
            :key="hour"
            :class="[
              'w-full aspect-square rounded text-xs font-medium transition-colors',
              asset.good_hours.includes(hour)
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-500 hover:bg-gray-700',
            ]"
            @click="toggleHour(hour)"
          >
            {{ hour }}
          </button>
        </div>
      </div>

      <!-- Ensemble Models -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-sm font-medium text-gray-400">Ensemble Models</h4>
          <UButton
            size="xs"
            icon="i-heroicons-plus"
            @click="addEnsemble"
          >
            Hinzufügen
          </UButton>
        </div>
        <div class="space-y-2">
          <div
            v-for="(ensemble, idx) in asset.ensemble"
            :key="idx"
            class="flex items-center gap-2 p-2 bg-gray-900 rounded"
          >
            <UFormField label="TP" class="w-20">
              <UInput
                v-model.number="ensemble.tp_mult"
                type="number"
                size="sm"
              />
            </UFormField>
            <UFormField label="SL" class="w-20">
              <UInput
                v-model.number="ensemble.sl_mult"
                type="number"
                size="sm"
              />
            </UFormField>
            <UFormField label="Conf" class="w-24">
              <UInput
                v-model.number="ensemble.conf_thresh"
                type="number"
                step="0.01"
                size="sm"
              />
            </UFormField>
            <UFormField label="Weight" class="w-24">
              <UInput
                v-model.number="ensemble.weight"
                type="number"
                step="0.01"
                size="sm"
              />
            </UFormField>
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="i-heroicons-trash"
              class="mt-5"
              @click="removeEnsemble(idx)"
            />
          </div>
          <p v-if="asset.ensemble.length === 0" class="text-gray-500 text-sm">
            Keine Ensemble-Modelle konfiguriert
          </p>
        </div>
      </div>

      <!-- Drawdown Scaling -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-sm font-medium text-gray-400">Drawdown Scaling</h4>
        </div>
        <div class="space-y-2">
          <div
            v-for="(scale, level) in asset.dd_scaling"
            :key="level"
            class="flex items-center gap-2 p-2 bg-gray-900 rounded"
          >
            <span class="text-white w-24">{{ level }}%</span>
            <span class="text-gray-400">→</span>
            <span class="text-white">{{ scale }}x</span>
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="i-heroicons-trash"
              @click="removeDdScaling(level as string)"
            />
          </div>
        </div>
        <div class="flex gap-2 mt-2">
          <UInput
            v-model="newDdLevel"
            placeholder="Level %"
            size="sm"
            class="w-24"
          />
          <UInput
            v-model.number="newDdScale"
            type="number"
            step="0.05"
            placeholder="Scale"
            size="sm"
            class="w-24"
          />
          <UButton
            size="sm"
            icon="i-heroicons-plus"
            @click="addDdScaling"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
