<script setup lang="ts">
import type { AccountInfo } from "~/types/settings";
import { BROKER_DEFINITIONS, currencyOptions } from "~/types/settings";

const props = defineProps<{
  modelValue: AccountInfo;
  accountName: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: AccountInfo];
  save: [];
}>();

const showPassword = ref(false);
const saving = ref(false);

const localInfo = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const brokerDef = computed(() =>
  BROKER_DEFINITIONS.find((b) => b.type === localInfo.value.broker_type)
);

const saveAccountInfo = async () => {
  saving.value = true;
  try {
    await $fetch(`/api/settings/${props.accountName}/info`, {
      method: "PUT",
      body: localInfo.value,
    });
    emit("save");
  } catch (error) {
    console.error("Failed to save account info:", error);
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- Account Info -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-white">Account Info</h2>
          <UBadge v-if="brokerDef" variant="subtle" size="xs">
            {{ brokerDef.label }}
          </UBadge>
        </div>
      </template>

      <div class="space-y-4">
        <UFormField label="Account Name">
          <UInput
            v-model="localInfo.metadata.account_name"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Waehrung">
          <USelect
            v-model="localInfo.metadata.currency"
            :items="currencyOptions"
            class="w-full"
          />
        </UFormField>

        <UFormField v-if="brokerDef?.envOptions" label="Umgebung">
          <USelect
            v-model="localInfo.metadata.env"
            :items="brokerDef.envOptions"
            class="w-full"
          />
        </UFormField>
      </div>
    </UCard>

    <!-- Money Management -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold text-white">Money Management</h2>
      </template>

      <div class="space-y-4">
        <UFormField label="Max Margin Usage">
          <UInput
            v-model.number="localInfo.money_management.max_margin_usage"
            type="number"
            step="0.01"
            min="0"
            max="1"
            class="w-full"
          />
          <template #hint>
            <span class="text-xs text-gray-500">
              {{ (localInfo.money_management.max_margin_usage * 100).toFixed(0) }}%
            </span>
          </template>
        </UFormField>

        <UFormField label="Min Lot Size">
          <UInput
            v-model.number="localInfo.money_management.min_lot_size"
            type="number"
            step="0.01"
            min="0.01"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Emergency Stop %">
          <UInput
            v-model.number="localInfo.money_management.emergency_stop_pct"
            type="number"
            step="0.01"
            min="0"
            max="1"
            class="w-full"
          />
          <template #hint>
            <span class="text-xs text-gray-500">
              Stoppt bei {{ (localInfo.money_management.emergency_stop_pct * 100).toFixed(0) }}% Verlust
            </span>
          </template>
        </UFormField>
      </div>
    </UCard>

    <!-- Credentials -->
    <UCard class="md:col-span-2">
      <template #header>
        <h2 class="text-lg font-semibold text-white">Zugangsdaten</h2>
      </template>

      <div class="space-y-4">
        <template v-if="brokerDef">
          <UFormField
            v-for="field in brokerDef.credentialFields"
            :key="field.key"
            :label="field.label"
          >
            <UInput
              :model-value="localInfo.credentials[field.key] ?? ''"
              :type="field.type === 'password' && !showPassword ? 'password' : 'text'"
              class="w-full font-mono"
              @update:model-value="localInfo.credentials[field.key] = $event as string"
            />
          </UFormField>
        </template>

        <div class="flex items-center gap-4">
          <UButton
            variant="ghost"
            size="sm"
            :icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
            @click="() => { showPassword = !showPassword }"
          >
            {{ showPassword ? "Verstecken" : "Anzeigen" }}
          </UButton>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton
            color="primary"
            :loading="saving"
            @click="saveAccountInfo"
          >
            Speichern
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
